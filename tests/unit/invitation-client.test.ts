import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
const access = () => ({
  invitationId: randomUUID(),
  csrfToken: "c".repeat(64),
  expiresAt: "2026-12-01T00:00:00.000Z",
  allowEvidence: true,
  work: {
    projectName: "Example project",
    progress: {
      total: 0,
      enabled: 0,
      sent: 0,
      drafts: 0,
      pending: 0,
      excluded: 0,
      undetermined: 0,
    },
    continueQuestionId: null,
    sections: [],
  },
});
beforeEach(() => {
  vi.resetModules();
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});
it("removes the capability fragment before requests and never stores it in browser state or storage", async () => {
  const token = randomBytes(32).toString("base64url"),
    response = access();
  window.history.replaceState({}, "", "/invite#" + token);
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  const { openInvitation } =
    await import("../../app/frontend/src/invitation-api");
  expect(location.hash).toBe("");
  expect(fetch).not.toHaveBeenCalled();
  const [a, b] = await Promise.all([openInvitation(), openInvitation()]);
  expect(a).toEqual(b);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/invitations/access/exchange");
  expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify({ token }));
  expect(JSON.stringify(window.history.state)).not.toContain(token);
  expect(window.history.state.actaInvitationId).toBe(response.invitationId);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
it("binds every request to the expected invitation and keeps CSRF separate from the account client", async () => {
  const response = access();
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(response), { status: 200 })),
    );
  vi.stubGlobal("fetch", fetch);
  const { setCsrf } = await import("../../app/frontend/src/api");
  setCsrf("account-csrf");
  const { InvitationClient } =
    await import("../../app/frontend/src/invitation-api");
  const client = new InvitationClient();
  await client.open("", response.invitationId);
  expect(fetch.mock.calls[0][1].headers["X-Invitation-Id"]).toBe(
    response.invitationId,
  );
  await client.request("invitationAccess");
  expect(fetch.mock.calls[1][1].headers["X-CSRF-Token"]).toBe(
    response.csrfToken,
  );
  expect(fetch.mock.calls[1][1].headers["X-CSRF-Token"]).not.toBe(
    "account-csrf",
  );
  expect(fetch.mock.calls[1][1].referrerPolicy).toBe("no-referrer");
});
it("invitation expiry does not activate account login recovery", async () => {
  const event = vi.fn();
  window.addEventListener("session-expired", event);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "401",
          message: "Invitación no disponible.",
          requestId: randomUUID(),
        }),
        { status: 401 },
      ),
    ),
  );
  const { InvitationClient } =
    await import("../../app/frontend/src/invitation-api");
  await expect(new InvitationClient().open("", randomUUID())).rejects.toThrow(
    "Invitación no disponible.",
  );
  expect(event).not.toHaveBeenCalled();
  window.removeEventListener("session-expired", event);
});
it("exchanges a reopened same-document link and removes its fragment before the request", async () => {
  const first = randomBytes(32).toString("base64url");
  const second = randomBytes(32).toString("base64url");
  window.history.replaceState({}, "", "/invite#" + first);
  const response = access();
  const fetch = vi.fn().mockImplementation(() => {
    expect(location.hash).toBe("");
    return Promise.resolve(
      new Response(JSON.stringify(response), { status: 201 }),
    );
  });
  vi.stubGlobal("fetch", fetch);
  const { openInvitation, captureInvitationFragment } =
    await import("../../app/frontend/src/invitation-api");
  await openInvitation();
  window.history.replaceState(window.history.state, "", "/invite#" + second);
  expect(captureInvitationFragment()).toBe(true);
  await Promise.all([openInvitation(), openInvitation()]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ token: second }));
  expect(JSON.stringify(history.state)).not.toContain(second);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
it("an older in-flight exchange cannot replace the newly opened invitation", async () => {
  const a = access(),
    b = access();
  let completeFirst!: (value: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          completeFirst = resolve;
        }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(b), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(b), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const { InvitationClient } =
    await import("../../app/frontend/src/invitation-api");
  const client = new InvitationClient();
  const older = client.open(randomBytes(32).toString("base64url"), "");
  const rejected = expect(older).rejects.toThrow("El enlace cambió");
  expect(
    (await client.open(randomBytes(32).toString("base64url"), "")).invitationId,
  ).toBe(b.invitationId);
  completeFirst(new Response(JSON.stringify(a), { status: 201 }));
  await rejected;
  await client.request("invitationAccess");
  expect(fetch.mock.calls[2][1].headers["X-Invitation-Id"]).toBe(
    b.invitationId,
  );
  expect(fetch.mock.calls[2][1].headers["X-CSRF-Token"]).toBe(b.csrfToken);
});
