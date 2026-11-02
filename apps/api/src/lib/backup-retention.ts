export type BackupObject = { key: string; lastModified: Date };

export function getBackupKeysToDelete(
  backups: BackupObject[],
  dailyRetention: number,
  monthlyRetention: number,
) {
  const newestFirst = [...backups].sort(
    (left, right) => right.lastModified.getTime() - left.lastModified.getTime(),
  );
  const daily = newestFirst.slice(0, dailyRetention);
  const keep = new Set(daily.map((backup) => backup.key));
  const recentMonths = new Set(
    daily.map((backup) => backup.lastModified.toISOString().slice(0, 7)),
  );
  const monthlyArchives = new Set<string>();

  for (const backup of newestFirst.slice(dailyRetention)) {
    const month = backup.lastModified.toISOString().slice(0, 7);
    if (recentMonths.has(month) || monthlyArchives.has(month)) continue;
    if (monthlyArchives.size >= monthlyRetention) break;
    monthlyArchives.add(month);
    keep.add(backup.key);
  }

  return newestFirst
    .filter((backup) => !keep.has(backup.key))
    .map((backup) => backup.key);
}
