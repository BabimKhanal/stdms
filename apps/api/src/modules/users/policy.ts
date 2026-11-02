export type OwnerAccount = { userId: string; status: string };

export function hasLoginIdentifier(email?: string | null, username?: string | null) {
  return Boolean(email?.trim() || username?.trim());
}

export function remainingActiveOwnerCount(owners: OwnerAccount[], targetIds: string[]) {
  const targets = new Set(targetIds);
  return owners.filter((owner) => owner.status === "active" && !targets.has(owner.userId)).length;
}