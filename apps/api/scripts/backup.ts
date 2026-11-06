import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import pg from "pg";
import { backupConfig } from "../src/lib/backup-config";
import { encryptBackupFile } from "../src/lib/backup-crypto";
import {
  getBackupKeysToDelete,
  type BackupObject,
} from "../src/lib/backup-retention";

const BACKUP_PREFIX = "database/";

function requiredSettings() {
  const missing = [
    ["BACKUP_DATABASE_URL", backupConfig.BACKUP_DATABASE_URL],
    ["BACKUP_S3_ENDPOINT", backupConfig.BACKUP_S3_ENDPOINT],
    ["BACKUP_S3_BUCKET", backupConfig.BACKUP_S3_BUCKET],
    ["BACKUP_S3_ACCESS_KEY_ID", backupConfig.BACKUP_S3_ACCESS_KEY_ID],
    ["BACKUP_S3_SECRET_ACCESS_KEY", backupConfig.BACKUP_S3_SECRET_ACCESS_KEY],
    ["BACKUP_ENCRYPTION_KEY", backupConfig.BACKUP_ENCRYPTION_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length)
    throw new Error(`Missing backup settings: ${missing.join(", ")}`);

  const key = Buffer.from(backupConfig.BACKUP_ENCRYPTION_KEY, "base64");
  if (key.length !== 32)
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  return key;
}

function makePgDumpConnection() {
  const url = new URL(backupConfig.BACKUP_DATABASE_URL);
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    database: decodeURIComponent(url.pathname.slice(1)),
    password: decodeURIComponent(url.password),
    sslmode: url.searchParams.get("sslmode") || "require",
  };
}

async function runPgDump(
  connection: ReturnType<typeof makePgDumpConnection>,
  outputPath: string,
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      [
        `--host=${connection.host}`,
        `--port=${connection.port}`,
        `--username=${connection.user}`,
        `--dbname=${connection.database}`,
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--exclude-table=public.backup_jobs",
        `--file=${outputPath}`,
      ],
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LANG: process.env.LANG,
          SSL_CERT_FILE: process.env.SSL_CERT_FILE,
          SSL_CERT_DIR: process.env.SSL_CERT_DIR,
          PGPASSWORD: connection.password,
          PGSSLMODE: connection.sslmode,
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (part: string) => {
      stderr = (stderr + part).slice(-12_000);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `pg_dump exited with code ${code}: ${stderr.trim() || "no details"}`,
          ),
        );
    });
  });
}

function makeS3Client() {
  return new S3Client({
    endpoint: backupConfig.BACKUP_S3_ENDPOINT,
    region: backupConfig.BACKUP_S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: backupConfig.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: backupConfig.BACKUP_S3_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadBackup(
  s3: S3Client,
  backupPath: string,
  objectKey: string,
  manifest: Record<string, unknown>,
) {
  const file = await stat(backupPath);
  await new Upload({
    client: s3,
    params: {
      Bucket: backupConfig.BACKUP_S3_BUCKET,
      Key: objectKey,
      Body: createReadStream(backupPath),
      ContentLength: file.size,
      ContentType: "application/octet-stream",
    },
    leavePartsOnError: false,
  }).done();

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: backupConfig.BACKUP_S3_BUCKET,
        Key: `${objectKey}.manifest.json`,
        Body: JSON.stringify(manifest),
        ContentLength: Buffer.byteLength(JSON.stringify(manifest)),
        ContentType: "application/json",
      }),
    );
  } catch (error) {
    await s3
      .send(
        new DeleteObjectsCommand({
          Bucket: backupConfig.BACKUP_S3_BUCKET,
          Delete: { Objects: [{ Key: objectKey }], Quiet: true },
        }),
      )
      .catch(() => undefined);
    throw error;
  }
}

async function listBackups(s3: S3Client): Promise<BackupObject[]> {
  const backups: BackupObject[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: backupConfig.BACKUP_S3_BUCKET,
        Prefix: BACKUP_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key?.endsWith(".dump.enc") && object.LastModified)
        backups.push({ key: object.Key, lastModified: object.LastModified });
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return backups.sort(
    (left, right) => right.lastModified.getTime() - left.lastModified.getTime(),
  );
}

async function pruneBackups(s3: S3Client) {
  const backups = await listBackups(s3);
  const removeKeys = getBackupKeysToDelete(
    backups,
    backupConfig.BACKUP_RETENTION_DAILY,
    backupConfig.BACKUP_RETENTION_MONTHLY,
  );
  for (let offset = 0; offset < removeKeys.length; offset += 500) {
    const batch = removeKeys
      .slice(offset, offset + 500)
      .flatMap((key) => [{ Key: key }, { Key: `${key}.manifest.json` }]);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: backupConfig.BACKUP_S3_BUCKET,
        Delete: { Objects: batch, Quiet: true },
      }),
    );
  }
  return removeKeys.length;
}

async function sendBackupAlert(payload: Record<string, unknown>) {
  if (!backupConfig.BACKUP_ALERT_WEBHOOK_URL) return;
  const response = await fetch(backupConfig.BACKUP_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`backup alert webhook returned HTTP ${response.status}`);
}

async function main() {
  if (process.argv.includes("--check-config")) {
    requiredSettings();
    console.log(
      JSON.stringify({
        configured: true,
        provider: "s3-compatible",
        endpoint: new URL(backupConfig.BACKUP_S3_ENDPOINT).host,
        bucket: backupConfig.BACKUP_S3_BUCKET,
        dailyRetention: backupConfig.BACKUP_RETENTION_DAILY,
        monthlyRetention: backupConfig.BACKUP_RETENTION_MONTHLY,
      }),
    );
    return;
  }
  let pool: pg.Pool | undefined;
  let s3: S3Client | undefined;
  let temporaryDirectory: string | undefined;
  let jobId: string | undefined;
  let objectKey: string | undefined;

  try {
    if (!backupConfig.BACKUP_DATABASE_URL)
      throw new Error("BACKUP_DATABASE_URL is required");
    pool = new pg.Pool({
      connectionString: backupConfig.BACKUP_DATABASE_URL,
      max: 1,
    });
    const [job] = (
      await pool.query<{ id: string }>(
        "INSERT INTO backup_jobs (status, provider) VALUES ('running', 's3-compatible') RETURNING id",
      )
    ).rows;
    jobId = job.id;

    const key = requiredSettings();
    s3 = makeS3Client();
    temporaryDirectory = await mkdtemp(join(tmpdir(), "edu-backup-"));
    const dumpPath = join(temporaryDirectory, "database.dump");
    const encryptedPath = join(temporaryDirectory, "database.dump.enc");
    const dumpConnection = makePgDumpConnection();
    await runPgDump(dumpConnection, dumpPath);
    const encrypted = await encryptBackupFile(dumpPath, encryptedPath, key);
    const createdAt = new Date().toISOString();
    const fileName = `${createdAt.replaceAll(":", "-").replaceAll(".", "-")}-${jobId}.dump.enc`;
    objectKey = `${BACKUP_PREFIX}${fileName}`;
    const manifest = {
      version: 1,
      format: "postgres-custom",
      encryption: "aes-256-gcm",
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      sha256: encrypted.sha256,
      sizeBytes: encrypted.sizeBytes,
      createdAt,
    };

    await uploadBackup(s3, encryptedPath, objectKey, manifest);
    let status = "completed";
    let error: string | null = null;
    try {
      const pruned = await pruneBackups(s3);
      console.log(
        JSON.stringify({
          level: "info",
          event: "backup_retention_complete",
          pruned,
        }),
      );
    } catch (retentionError) {
      status = "completed_with_warning";
      error = `Backup succeeded but retention cleanup failed: ${errorMessage(retentionError)}`;
    }

    await pool.query(
      "UPDATE backup_jobs SET status = $1, object_key = $2, size_bytes = $3, sha256 = $4, error = $5, finished_at = now() WHERE id = $6",
      [status, objectKey, encrypted.sizeBytes, encrypted.sha256, error, jobId],
    );
    console.log(
      JSON.stringify({
        level: "info",
        event: "backup_complete",
        jobId,
        objectKey,
        sizeBytes: encrypted.sizeBytes,
        status,
      }),
    );
    void sendBackupAlert({
      event: "database_backup_completed",
      jobId,
      status,
      objectKey,
      sizeBytes: encrypted.sizeBytes,
      error,
    }).catch((alertError: unknown) =>
      console.error("backup success alert failed", errorMessage(alertError)),
    );
  } catch (error) {
    const message = errorMessage(error);
    if (jobId)
      await pool!
        .query(
          "UPDATE backup_jobs SET status = 'failed', object_key = $1, error = $2, finished_at = now() WHERE id = $3",
          [objectKey ?? null, message, jobId],
        )
        .catch((updateError: unknown) =>
          console.error(
            "backup history update failed",
            errorMessage(updateError),
          ),
        );
    else if (pool)
      await pool
        .query(
          "INSERT INTO backup_jobs (status, provider, error, finished_at) VALUES ('failed', 's3-compatible', $1, now())",
          [message],
        )
        .catch(() => undefined);
    console.error(
      JSON.stringify({
        level: "error",
        event: "backup_failed",
        jobId: jobId ?? null,
        error: message,
      }),
    );
    void sendBackupAlert({
      event: "database_backup_failed",
      jobId: jobId ?? null,
      error: message,
    }).catch((alertError: unknown) =>
      console.error("backup failure alert failed", errorMessage(alertError)),
    );
    process.exitCode = 1;
  } finally {
    s3?.destroy();
    await pool?.end();
    if (temporaryDirectory)
      await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const secrets = [
    backupConfig.BACKUP_DATABASE_URL,
    backupConfig.BACKUP_S3_ACCESS_KEY_ID,
    backupConfig.BACKUP_S3_SECRET_ACCESS_KEY,
    backupConfig.BACKUP_ENCRYPTION_KEY,
  ].filter(Boolean);
  return secrets
    .reduce(
      (safeMessage, secret) => safeMessage.replaceAll(secret, "[redacted]"),
      message,
    )
    .slice(0, 2_000);
}

void main();
