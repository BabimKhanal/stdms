import { serve } from "@hono/node-server";
import { env } from "./env";
import { app } from "./app";
import { attachNotificationSocket } from "./modules/notifications/socket";
import { appPool, ownerPool } from "./db/client";
import { redis } from "./lib/redis";

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  console.log(`✓ API listening on http://localhost:${info.port}`);
  console.log(`  liveness: http://localhost:${info.port}/live`);
  console.log(`  readiness: http://localhost:${info.port}/ready`);
});

const notificationSocket = attachNotificationSocket(server);
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "shutdown_started", signal }));
  const force = setTimeout(() => process.exit(1), 15_000);
  force.unref();
  notificationSocket.clients.forEach((client) => client.close(1001, "Server shutting down"));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.allSettled([appPool.end(), ownerPool.end(), redis.quit()]);
  clearTimeout(force);
  console.log(JSON.stringify({ level: "info", event: "shutdown_complete", signal }));
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
