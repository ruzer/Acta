// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import express, { type Request } from "express";
import { clientIp } from "../../app/backend/src/common/client-ip";
import { loadConfig } from "../../app/backend/src/common/config";
const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});
function request(hops: number, peer: string, forwarded?: string) {
  const app = express().set("trust proxy", hops);
  return Object.assign(Object.create(app.request), {
    app,
    socket: { remoteAddress: peer },
    headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
  }) as Request;
}
describe("client IP trust boundary", () => {
  it("ignores a forged header from a direct, untrusted connection", () => {
    expect(clientIp(request(0, "192.0.2.10", "198.51.100.5"))).toBe(
      "192.0.2.10",
    );
  });
  it("respects only the configured number of proxy hops", () => {
    expect(clientIp(request(1, "192.0.2.10", "198.51.100.5"))).toBe(
      "198.51.100.5",
    );
    expect(
      clientIp(request(1, "192.0.2.10", "203.0.113.99, 198.51.100.5")),
    ).toBe("198.51.100.5");
    expect(
      clientIp(request(2, "192.0.2.10", "203.0.113.99, 198.51.100.5")),
    ).toBe("203.0.113.99");
  });
  it.each([
    undefined,
    "",
    "unknown",
    "198.51.100.5:123",
    "[2001:db8::1]",
    "198.51.100.5, invalid",
  ])(
    "falls back to the TCP peer for missing/invalid header %s",
    (forwarded) => {
      expect(clientIp(request(1, "::ffff:192.0.2.10", forwarded))).toBe(
        "192.0.2.10",
      );
    },
  );
  it.each([
    ["::ffff:192.0.2.10", "192.0.2.10"],
    ["::FFFF:c000:20a", "192.0.2.10"],
    ["2001:0DB8:0:0:0:0:0:1", "2001:db8::1"],
    ["2001:db8::1", "2001:db8::1"],
    ["fe80::1%en0", "fe80::1"],
  ])("normalizes %s before hashing", (address, expected) => {
    expect(clientIp(request(1, "192.0.2.1", address))).toBe(expected);
    expect(clientIp(request(0, address))).toBe(expected);
  });
});
describe("proxy configuration", () => {
  function env() {
    Object.assign(process.env, {
      DATABASE_URL: "postgresql://example",
      ORGANIZATION_CODE: "EXAMPLE",
      APP_ORIGIN: "http://localhost:4317",
      COOKIE_SECURE: "false",
    });
  }
  it("defaults to no trusted hop outside Compose", () => {
    env();
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(loadConfig().TRUSTED_PROXY_HOPS).toBe(0);
  });
  it.each(["0", "1", "2", "3"])("accepts %s hops", (value) => {
    env();
    process.env.TRUSTED_PROXY_HOPS = value;
    expect(loadConfig().TRUSTED_PROXY_HOPS).toBe(Number(value));
  });
  it.each(["-1", "4", "1.5", "true", "1; unsafe", "NaN"])(
    "refuses invalid hops %s without echoing the value",
    (value) => {
      env();
      process.env.TRUSTED_PROXY_HOPS = value;
      expect(() => loadConfig()).toThrow("Configuración incompleta o inválida");
    },
  );
});

describe("nginx trusted CIDR input", () => {
  it.each(["", "192.0.2.10/32", "192.0.2.0/24, 2001:db8::/32"])(
    "renders only configured sources: %s",
    (cidrs) => {
      const result = render(cidrs);
      expect(result.status).toBe(0);
      if (cidrs) {
        for (const cidr of cidrs.split(","))
          expect(result.stdout).toContain(`set_real_ip_from ${cidr.trim()};`);
        expect(result.stdout).toContain("real_ip_header X-Forwarded-For;");
        expect(result.stdout).toContain("real_ip_recursive on;");
      } else expect(result.stdout).toBe("");
    },
  );
  it.each([
    "0.0.0.0/33",
    "2001:db8::/129",
    "999.2.3.4/32",
    "192.0.2/24",
    "proxy.example/32",
    "192.0.2.1",
    "192.0.2.1/32,",
    ",192.0.2.1/32",
    "192.0.2.1/32,,192.0.2.2/32",
    "192.0.2.1/32; include /tmp/anything",
    "192.0.2.1/32\ninclude",
  ])("refuses malformed configuration %s", (cidrs) => {
    const result = render(cidrs);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("lista CIDR inválida");
    expect(result.stdout).toBe("");
  });
});

function render(cidrs: string) {
  return spawnSync(
    "sh",
    [
      "-c",
      '. "$1"; printf "%s" "$ACTA_REAL_IP_DIRECTIVES"',
      "sh",
      "docker/19-trusted-proxies.envsh",
    ],
    { encoding: "utf8", env: { ...process.env, TRUSTED_PROXY_CIDRS: cidrs } },
  );
}
