import { serve } from "@hono/node-server";
import { env } from "./env";
import { app } from "./app";
import { attachNotificationSocket } from "./modules/notifications/socket";

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  console.log(`✓ API listening on http://localhost:${info.port}`);
  console.log(`  health: http://localhost:${info.port}/health`);
});

attachNotificationSocket(server);
