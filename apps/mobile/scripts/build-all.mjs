#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skipChecks = process.argv.includes("--skip-checks");
const root = fileURLToPath(new URL("..", import.meta.url));

function run(args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync("bun", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const checks = skipChecks ? ["--skip-checks"] : [];

run(
  ["run", "install:local:debug"],
  "Build and install local debug APK",
);
run(
  ["x", "node", "scripts/build-android.mjs", "--local", "--apk", ...checks],
  "Build local release APK",
);
run(
  ["x", "node", "scripts/build-android.mjs", "--apk", ...checks],
  "Build EAS production APK",
);
run(
  ["x", "node", "scripts/build-android.mjs", "--aab", ...checks],
  "Build EAS production AAB",
);

console.log("\nAll Android builds completed.");
