export type Page = "desk" | "cash" | "breaks";

export type BreakFilter =
  | "BREAKS"
  | "TIMING"
  | "AMOUNT_BREAK"
  | "MISSING_IN_BANK"
  | "MISSING_IN_LEDGER"
  | "DUPLICATE"
  | "CLEAN"
  | "PAST_CUTOFF";

export interface DeskRow {
  source: "LEDGER" | "BANK";
  amount: string;
  valueDate: string;
  description: string;
  counterparty: string;
  type: string;
}

export interface DeskItem {
  id: string;
  exceptionId: string | null;
  referenceId: string;
  classification: string;
  timingDifference: boolean;
  lagDays: number;
  amountLedger: string | null;
  amountBank: string | null;
  accountId: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  type: string;
  description: string;
  counterparty: string;
  rows: DeskRow[];
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | null;
  ownerId: string | null;
  ownerName: string | null;
  resolutionReason: string | null;
  ageDays: number | null;
  pastCutoff: boolean;
  notes: { id: string; authorName: string; body: string; createdAt: string }[];
  events: {
    id: string;
    actorName: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    detail: string | null;
    createdAt: string;
  }[];
}

export interface CashAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  openingBalance: string;
  endingBalance: string;
  targetBalance: string;
  surplus: string;
  leftover: boolean;
  netActivity: string;
  forecast: { date: string; balance: string; scheduledNet: string }[];
}

export interface Overview {
  firmName: string;
  dataLabel: string;
  businessDate: string;
  timezone: string;
  cutoffTime: string;
  approvalThreshold: string;
  asOf: string;
  cutoffPassed: boolean;
  files: { source: string; fileName: string; rowCount: number }[];
  users: { id: string; name: string; role: string; title: string }[];
  counts: {
    groups: number;
    clean: number;
    timing: number;
    amountBreak: number;
    missingInBank: number;
    missingInLedger: number;
    duplicate: number;
    breaks: number;
    open: number;
    investigating: number;
    resolved: number;
    pastCutoff: number;
    leftoverAccounts: number;
  };
  aging: { label: string; count: number }[];
  checklist: { id: string; label: string; detail: string; done: boolean }[];
  checklistPassed: boolean;
  accounts: CashAccount[];
  items: DeskItem[];
  activity: { id: string; action: string; summary: string; actorName: string | null; createdAt: string }[];
}

export interface ExceptionUpdate {
  actorId: string;
  status?: "OPEN" | "INVESTIGATING" | "RESOLVED";
  ownerId?: string | null;
  resolutionReason?: string;
  note?: string;
}
