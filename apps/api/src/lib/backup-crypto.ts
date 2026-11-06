import { createHash, createCipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function encryptBackupFile(
  sourcePath: string,
  encryptedPath: string,
  key: Buffer,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const digest = createHash("sha256");
  const hashStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      digest.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    createReadStream(sourcePath),
    cipher,
    hashStream,
    createWriteStream(encryptedPath, { flags: "wx" }),
  );
  const file = await stat(encryptedPath);
  return {
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    sha256: digest.digest("hex"),
    sizeBytes: file.size,
  };
}
