import type { Pool } from "pg";

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "escalated"
  | "approved"
  | "rejected"
  | "payment_pending"
  | "paid"
  | "closed";

const transitions: Record<
  ClaimStatus,
  Partial<
    Record<
      ClaimStatus,
      Array<"customer" | "claim_officer" | "manager" | "accounting_staff">
    >
  >
> = {
  draft: { submitted: ["customer"] },
  submitted: { under_review: ["claim_officer", "manager"] },
  under_review: {
    escalated: ["claim_officer", "manager"],
    approved: ["claim_officer", "manager"],
    rejected: ["claim_officer", "manager"],
  },
  escalated: {
    approved: ["manager"],
    rejected: ["manager"],
    under_review: ["manager"],
  },
  approved: { payment_pending: ["accounting_staff", "manager"] },
  payment_pending: { paid: ["accounting_staff", "manager"] },
  paid: { closed: ["accounting_staff", "manager", "claim_officer"] },
  rejected: {},
  closed: {},
};

export function canTransition(
  from: ClaimStatus,
  to: ClaimStatus,
  role: string,
): boolean {
  const allowed = transitions[from]?.[to];
  if (!allowed) return false;
  return allowed.includes(role as "customer");
}

export function nextEscalationLevel(
  current: number,
  to: ClaimStatus,
): number {
  if (to === "escalated") return Math.max(current, 1);
  return current;
}
