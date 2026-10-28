#!/usr/bin/env node

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log(`Usage:
  node scripts/build-android.mjs --apk                 Build installable APK with EAS
  node scripts/build-android.mjs --aab                 Build Play Store AAB with EAS
  node scripts/build-android.mjs --local --apk         Build APK locally
  node scripts/build-android.mjs --local --apk --install  Build and install with adb

Options:
  --skip-checks    Skip lint and typecheck (not recommended for release builds)`);
  process.exit(0);
}

const wantsAab = args.has("--aab");
const wantsApk = args.has("--apk") || !wantsAab;
const local = args.has("--local");
const install = args.has("--install");
const skipChecks = args.has("--skip-checks");

if (wantsAab && args.has("--apk")) {
  fail("Choose one output: --apk or --aab.");
}

if (local && wantsAab) {
  fail("Local mode currently builds an installable APK only. Use the EAS production profile for an AAB.");
}

if (install && !local) {
  fail("--install is only available with --local because cloud builds return an artifact URL.");
}

const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);

function command(name) {
  return name;
}

function run(name, commandArgs, label, options = {}) {
  console.log(`\n> ${label}`);
  const executable = command(name);
  const isWindowsBatch = process.platform === "win32" && executable.toLowerCase().endsWith(".bat");
  const result = spawnSync(isWindowsBatch ? `"${executable}"` : executable, commandArgs, {
    stdio: "inherit",
    shell: isWindowsBatch,
    cwd: options.cwd,
    env: options.env,
  });
  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

function fail(message) {
  console.error(`\nBuild stopped: ${message}`);
  process.exit(1);
}

if (!skipChecks) {
  run("bun", ["x", "expo", "lint"], "Lint mobile app");
  run("bun", ["x", "tsc", "--noEmit"], "Typecheck mobile app");
}

if (!local) {
  const profile = wantsAab ? "production" : "production-apk";
  const output = wantsAab ? "AAB" : "APK";
  run("bun", ["x", "eas-cli", "build", "--platform", "android", "--profile", profile, "--wait"], `Build production ${output} with EAS (${profile})`);
  console.log("\nBuild completed. Download the artifact URL printed by EAS.");
  if (wantsApk) console.log("Install the APK on a device with: adb install -r path/to/app.apk");
  process.exit(0);
}

const androidDir = resolve(root, "android");
const productionEnv = { ...process.env, NODE_ENV: "production" };

if (!existsSync(androidDir)) {
  run("bun", ["x", "expo", "prebuild", "--platform", "android", "--no-install"], "Generate Android native project", { env: productionEnv });
}

const gradleHome = process.env.GRADLE_HOME ? resolve(process.env.GRADLE_HOME) : resolve(root, "gradle-9.3.1");
const gradle = resolve(gradleHome, "bin", process.platform === "win32" ? "gradle.bat" : "gradle");
if (!existsSync(gradle)) {
  fail(`Gradle was not found at ${gradle}. Set GRADLE_HOME to a valid Gradle installation.`);
}

run(gradle, ["--no-daemon", "assembleRelease"], "Build local Android release APK", { cwd: androidDir, env: productionEnv });

const apk = resolve(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(apk)) fail(`Expected APK was not created at ${apk}.`);

console.log(`\nAPK created at:\n${apk}`);
if (install) {
  run("adb", ["install", "-r", apk], "Install APK on connected Android device");
}
