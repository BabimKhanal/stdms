import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { appPool } from "../../db/client";
import { verifyAccessToken } from "../../lib/jwt";

type Client = { socket: WebSocket; userId: string; orgId: string };
const clients = new Set<Client>();

async function authenticate(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const token = url.searchParams.get("token");
  if (!token) return null;
  try {
    const claims = verifyAccessToken(token);
    const result = await appPool.query<{ id: string; organisation_id: string | null }>(
      "SELECT id, organisation_id FROM users WHERE id = $1 AND status = 'active'",
      [claims.sub],
    );
    const user = result.rows[0];
    if (!user?.organisation_id || (claims.org && claims.org !== user.organisation_id)) return null;
    return { userId: user.id, orgId: user.organisation_id };
  } catch {
    return null;
  }
}

export function publishNotification(notification: { id: string; userId: string; organisationId: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; readAt: Date | null; createdAt: Date }) {
  const message = JSON.stringify({ type: "notification", data: notification });
  for (const client of clients) {
    if (client.userId === notification.userId && client.orgId === notification.organisationId && client.socket.readyState === 1) client.socket.send(message);
  }
}

type UpgradeServer = { on(event: "upgrade", listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown };

export function attachNotificationSocket(server: UpgradeServer) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws/notifications") return;
    const principal = await authenticate(request);
    if (!principal) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const client: Client = { socket: ws, ...principal };
      clients.add(client);
      ws.send(JSON.stringify({ type: "ready" }));
      ws.on("close", () => clients.delete(client));
      ws.on("error", () => clients.delete(client));
    });
  });
  return wss;
}
