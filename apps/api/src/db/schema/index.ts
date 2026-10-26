/**
 * Single import point for every table in the system.
 * Import tables from "@/db/schema" — never reach into individual files
 * outside of the schema folder.
 */
export * from "./tenant";
export * from "./academics";
export * from "./people";
export * from "./operations";
export * from "./fees";
export * from "./exams";
export * from "./system";
