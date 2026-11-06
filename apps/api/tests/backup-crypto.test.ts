import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createDecipheriv } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptBackupFile } from "../src/lib/backup-crypto";

test("encrypted backup round-trips with its manifest metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "backup-crypto-test-"));
  const sourcePath = join(directory, "source.dump");
  const encryptedPath = join(directory, "source.dump.enc");
  const source = Buffer.from("verified database backup payload");
  const key = Buffer.from(Array.from({ length: 32 }, (_, index) => index));

  try {
    await writeFile(sourcePath, source);
    const manifest = await encryptBackupFile(sourcePath, encryptedPath, key);
    const encrypted = await readFile(encryptedPath);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(manifest.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(manifest.authTag, "base64"));
    const restored = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    assert.deepEqual(restored, source);
    assert.equal(
      manifest.sha256,
      createHash("sha256").update(encrypted).digest("hex"),
    );
    assert.equal(manifest.sizeBytes, encrypted.byteLength);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
