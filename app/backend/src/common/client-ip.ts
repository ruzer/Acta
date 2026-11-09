import { isIP, SocketAddress } from "node:net";
import type { Request } from "express";

function normalized(address: string | undefined) {
  if (!address || !isIP(address)) return undefined;
  const parsed = SocketAddress.parse(
    isIP(address) === 6 ? `[${address.split("%")[0]}]` : address,
  );
  return parsed?.address.replace(/^::ffff:/, "");
}

export function clientIp(request: Pick<Request, "ip" | "socket">): string {
  // Express applies the configured trust boundary; never read forwarding headers here.
  return (
    normalized(request.ip) ??
    normalized(request.socket.remoteAddress) ??
    "unknown"
  );
}
