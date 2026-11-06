export type LifecycleStatus = "active" | "graduated" | "suspended" | "withdrawn" | "transferred" | "alumni";
export type PromotionStatus = "promoted" | "repeated" | "transferred" | "graduated" | "withdrawn";

const transitions: Record<LifecycleStatus, LifecycleStatus[]> = {
  active: ["suspended", "withdrawn", "transferred", "graduated"],
  suspended: ["active", "withdrawn", "transferred"],
  withdrawn: ["active"],
  transferred: ["active"],
  graduated: ["alumni"],
  alumni: [],
};

export function canTransitionStudent(from: LifecycleStatus, to: LifecycleStatus) {
  return from === to || transitions[from].includes(to);
}

export function requiresDestination(status: PromotionStatus) {
  return status === "promoted" || status === "repeated";
}

export function lifecycleStatusForPromotion(status: PromotionStatus): LifecycleStatus | null {
  if (status === "withdrawn" || status === "transferred" || status === "graduated") return status;
  return null;
}