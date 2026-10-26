import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/types";
import { badRequest } from "../../lib/errors";
import { parse, ok } from "../../lib/http";
import { requireAuth, requireOrg } from "../../middleware/guards";
import { env } from "../../env";

const signInput = z.object({
  resourceType: z.enum(["auto", "image", "video", "raw"]).default("auto"),
  folder: z.enum(["students", "users", "assignments", "content", "documents", "branding"]).default("documents"),
});

export const uploadRoutes = new Hono<AppEnv>();
uploadRoutes.use("*", requireAuth, requireOrg);

uploadRoutes.post("/sign", async (c) => {
  const input = parse(signInput, await c.req.json());
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw badRequest("Cloudinary is not configured on the API");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `education/${c.get("orgId")}/${input.folder}`;
  const signatureBase = `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  return ok(c, { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, timestamp, signature, folder, resourceType: input.resourceType });
});
