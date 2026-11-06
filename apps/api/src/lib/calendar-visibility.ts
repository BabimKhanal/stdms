import { sql } from "drizzle-orm";
import { calendarAudienceGroups } from "@edu/shared";
import { events } from "../db/schema";
import type { AuthUser } from "./context";
import { isUnrestrictedAdmin } from "./teacher-scope";

export function calendarEventScope(user?: AuthUser) {
  if (!user || isUnrestrictedAdmin(user)) return undefined;
  const groups = calendarAudienceGroups(user);
  const allowed = sql.join(groups.map((group) => sql`${group}`), sql`, `);
  // Empty legacy audiences mean a school-wide event; new writes require a group.
  return sql`(${events.audiences} = '[]'::jsonb or ${events.audiences} ?| array[${allowed}]::text[])`;
}
