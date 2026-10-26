import type { DB } from "../db/client";
import type { AppVariables } from "./context";

export type { DB } from "../db/client";
export type { AppVariables, AuthUser } from "./context";

/** Hono application type: `new Hono<AppEnv>()`. */
export type AppEnv = { Variables: AppVariables };
