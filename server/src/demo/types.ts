export type SourceName = "LEDGER" | "BANK";

export type TransactionTypeName = "ACH" | "WIRE" | "CHECK" | "JOURNAL";

export type Scenario =
  | "matched"
  | "timing"
  | "amount_break"
  | "missing_in_bank"
  | "missing_in_ledger"
  | "duplicate";

export type ClassificationName =
  | "MATCHED"
  | "AMOUNT_BREAK"
  | "MISSING_IN_BANK"
  | "MISSING_IN_LEDGER"
  | "DUPLICATE";

export interface PlannedAccount {
  id: string;
  code: string;
  name: string;
  accountNumber: string;
  bankName: string;
  targetBalance: string;
  openingBalance: string;
}

export interface PlannedTransaction {
  source: SourceName;
  accountCode: string;
  type: TransactionTypeName;
  amount: string;
  valueDate: string;
  businessDate: string;
  referenceId: string;
  description: string;
  counterparty: string;
}

export interface PlannedGroup {
  scenario: Scenario;
  expectedClassification: ClassificationName;
  expectTimingDifference: boolean;
  expectLagDays: number;
  referenceId: string;
  accountCode: string;
  story: string;
  transactions: PlannedTransaction[];
}

export interface PlannedScheduledItem {
  accountCode: string;
  type: TransactionTypeName;
  amount: string;
  settleDate: string;
  referenceId: string;
  description: string;
  counterparty: string;
}

export interface DayPlan {
  businessDate: string;
  firmName: string;
  dataLabel: string;
  approvalThreshold: string;
  cutoffTime: string;
  timezone: string;
  forecastBusinessDates: string[];
  accounts: PlannedAccount[];
  groups: PlannedGroup[];
  scheduledItems: PlannedScheduledItem[];
}
