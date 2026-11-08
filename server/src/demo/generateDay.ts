import { calendarLagDays, nextBusinessDays } from "../dates.js";
import { assertMoney, fromCents, toCents } from "../money.js";
import {
  DEMO_APPROVAL_THRESHOLD,
  DEMO_BUSINESS_DATE,
  DEMO_CUTOFF_TIME,
  DEMO_DATA_LABEL,
  DEMO_FIRM_NAME,
  DEMO_TIMEZONE,
} from "./constants.js";
import type {
  ClassificationName,
  DayPlan,
  PlannedAccount,
  PlannedGroup,
  PlannedScheduledItem,
  PlannedTransaction,
  Scenario,
  SourceName,
  TransactionTypeName,
} from "./types.js";
import { buildVolumeGroups, TARGET_TRANSACTION_ROWS } from "./volume.js";

const DAY = DEMO_BUSINESS_DATE;

interface RawSide {
  source: SourceName;
  amount: string;
  valueDate?: string;
}

interface RawGroup {
  scenario: Scenario;
  referenceId: string;
  accountCode: string;
  type: TransactionTypeName;
  description: string;
  counterparty: string;
  story: string;
  sides: RawSide[];
}

const ACCOUNTS: PlannedAccount[] = [
  {
    id: "acct_harbor_operating",
    code: "harbor-operating",
    name: "Operating",
    accountNumber: "9990001001",
    bankName: "Harbor National",
    targetBalance: "0.00",
    openingBalance: "2450000.00",
  },
  {
    id: "acct_cedar_settlement",
    code: "cedar-settlement",
    name: "Settlement",
    accountNumber: "9990001002",
    bankName: "Cedar Trust",
    targetBalance: "500000.00",
    openingBalance: "8120000.00",
  },
  {
    id: "acct_lake_client",
    code: "lake-client",
    name: "Client money",
    accountNumber: "9990001003",
    bankName: "Lake Street Bank",
    targetBalance: "0.00",
    openingBalance: "15000000.00",
  },
  {
    id: "acct_redwood_disbursement",
    code: "redwood-disbursement",
    name: "Disbursement",
    accountNumber: "9990001004",
    bankName: "Redwood Deposit Bank",
    targetBalance: "500000.00",
    openingBalance: "640000.00",
  },
];

const GROUPS: RawGroup[] = [
  // Harbor National — Operating
  group({
    scenario: "matched",
    referenceId: "ACH-20261106-1001",
    accountCode: "harbor-operating",
    type: "ACH",
    description: "Client sweep in",
    counterparty: "Apex Nominees",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "185000.00"), side("BANK", "185000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "WIRE-20261106-1002",
    accountCode: "harbor-operating",
    type: "WIRE",
    description: "Vendor wire",
    counterparty: "Northwind Clearing",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-75000.00"), side("BANK", "-75000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "CHK-20261106-1003",
    accountCode: "harbor-operating",
    type: "CHECK",
    description: "Legal retainer check",
    counterparty: "Harbor Legal LLP",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-12400.50"), side("BANK", "-12400.50")],
  }),
  group({
    scenario: "matched",
    referenceId: "JRN-20261106-1004",
    accountCode: "harbor-operating",
    type: "JOURNAL",
    description: "Funding transfer to settlement",
    counterparty: "Internal",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-500000.00"), side("BANK", "-500000.00")],
  }),
  group({
    scenario: "timing",
    referenceId: "ACH-20261106-1101",
    accountCode: "harbor-operating",
    type: "ACH",
    description: "Utility debit, bank settles next business day",
    counterparty: "City Utilities",
    story: "Same amount and reference. Bank value date is the next Monday.",
    sides: [
      side("LEDGER", "-42000.00"),
      side("BANK", "-42000.00", "2026-11-09"),
    ],
  }),
  group({
    scenario: "amount_break",
    referenceId: "WIRE-20261106-1201",
    accountCode: "harbor-operating",
    type: "WIRE",
    description: "Market receipt",
    counterparty: "Helios Markets",
    story: "Bank credited $50.00 more than the ledger.",
    sides: [side("LEDGER", "125000.00"), side("BANK", "125050.00")],
  }),
  group({
    scenario: "missing_in_bank",
    referenceId: "CHK-20261106-1301",
    accountCode: "harbor-operating",
    type: "CHECK",
    description: "Check issued, not yet presented",
    counterparty: "Maple Street LLC",
    story: "On the ledger only.",
    sides: [side("LEDGER", "-8275.00")],
  }),
  group({
    scenario: "missing_in_ledger",
    referenceId: "WIRE-20261106-1401",
    accountCode: "harbor-operating",
    type: "WIRE",
    description: "Incoming wire fee",
    counterparty: "Harbor National",
    story: "On the bank file only.",
    sides: [side("BANK", "-35.00")],
  }),
  group({
    scenario: "duplicate",
    referenceId: "ACH-20261106-1501",
    accountCode: "harbor-operating",
    type: "ACH",
    description: "Dividend receipt booked twice",
    counterparty: "Brightpath Funds",
    story: "Two identical ledger rows and one bank row.",
    sides: [
      side("LEDGER", "19500.00"),
      side("LEDGER", "19500.00"),
      side("BANK", "19500.00"),
    ],
  }),

  // Cedar Trust — Settlement
  group({
    scenario: "matched",
    referenceId: "WIRE-20261106-2001",
    accountCode: "cedar-settlement",
    type: "WIRE",
    description: "DTC settlement receipt",
    counterparty: "Cedar DTC",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "2000000.00"), side("BANK", "2000000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "ACH-20261106-2002",
    accountCode: "cedar-settlement",
    type: "ACH",
    description: "Margin debit",
    counterparty: "Oak Clearing",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-640000.00"), side("BANK", "-640000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "JRN-20261106-2003",
    accountCode: "cedar-settlement",
    type: "JOURNAL",
    description: "Funding transfer from operating",
    counterparty: "Internal",
    story: "Ledger and bank agree. Separate reference from the operating leg.",
    sides: [side("LEDGER", "500000.00"), side("BANK", "500000.00")],
  }),
  group({
    scenario: "timing",
    referenceId: "WIRE-20261106-2101",
    accountCode: "cedar-settlement",
    type: "WIRE",
    description: "Euroclear wire dated prior day on the bank file",
    counterparty: "Euroclear Nominees",
    story: "Same amount and reference. Bank value date is one calendar day earlier.",
    sides: [
      side("LEDGER", "-1250000.00"),
      side("BANK", "-1250000.00", "2026-11-05"),
    ],
  }),
  group({
    scenario: "amount_break",
    referenceId: "CHK-20261106-2201",
    accountCode: "cedar-settlement",
    type: "CHECK",
    description: "Transfer-agent check",
    counterparty: "Summit Transfer Agents",
    story: "Bank amount transposes the last two digits.",
    sides: [side("LEDGER", "-16080.00"), side("BANK", "-16800.00")],
  }),
  group({
    scenario: "missing_in_bank",
    referenceId: "JRN-20261106-2301",
    accountCode: "cedar-settlement",
    type: "JOURNAL",
    description: "Pending internal move",
    counterparty: "Internal",
    story: "On the ledger only.",
    sides: [side("LEDGER", "-250000.00")],
  }),
  group({
    scenario: "missing_in_ledger",
    referenceId: "WIRE-20261106-2401",
    accountCode: "cedar-settlement",
    type: "WIRE",
    description: "Unexpected wire receipt",
    counterparty: "Unapplied beneficiary",
    story: "On the bank file only.",
    sides: [side("BANK", "88430.25")],
  }),
  group({
    scenario: "duplicate",
    referenceId: "WIRE-20261106-2501",
    accountCode: "cedar-settlement",
    type: "WIRE",
    description: "NSCC wire loaded twice in the bank file",
    counterparty: "NSCC",
    story: "One ledger row and two identical bank rows.",
    sides: [
      side("LEDGER", "-300000.00"),
      side("BANK", "-300000.00"),
      side("BANK", "-300000.00"),
    ],
  }),

  // Lake Street Bank — Client money
  group({
    scenario: "matched",
    referenceId: "ACH-20261106-3001",
    accountCode: "lake-client",
    type: "ACH",
    description: "Dividend credit",
    counterparty: "Orchid Capital",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "425600.40"), side("BANK", "425600.40")],
  }),
  group({
    scenario: "matched",
    referenceId: "WIRE-20261106-3002",
    accountCode: "lake-client",
    type: "WIRE",
    description: "Client redemption",
    counterparty: "Orchid Capital",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-2750000.00"), side("BANK", "-2750000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "CHK-20261106-3003",
    accountCode: "lake-client",
    type: "CHECK",
    description: "Client distribution check",
    counterparty: "Linden Family Trust",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-3200.00"), side("BANK", "-3200.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "JRN-20261106-3004",
    accountCode: "lake-client",
    type: "JOURNAL",
    description: "Interest allocation",
    counterparty: "Internal",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "90000.00"), side("BANK", "90000.00")],
  }),
  group({
    scenario: "timing",
    referenceId: "ACH-20261106-3101",
    accountCode: "lake-client",
    type: "ACH",
    description: "Plan-sponsor credit, bank value date Saturday",
    counterparty: "Pinetop Retirement",
    story: "Same amount and reference. Bank value date is the next calendar day.",
    sides: [
      side("LEDGER", "55000.00"),
      side("BANK", "55000.00", "2026-11-07"),
    ],
  }),
  group({
    scenario: "amount_break",
    referenceId: "WIRE-20261106-3201",
    accountCode: "lake-client",
    type: "WIRE",
    description: "Subscription wire, fee netted at the bank",
    counterparty: "Quarry Asset Management",
    story: "Bank amount is $25.00 lower than the ledger.",
    sides: [side("LEDGER", "1000000.00"), side("BANK", "999975.00")],
  }),
  group({
    scenario: "missing_in_bank",
    referenceId: "ACH-20261106-3301",
    accountCode: "lake-client",
    type: "ACH",
    description: "ACH originated, not settled",
    counterparty: "Birch Advisors",
    story: "On the ledger only.",
    sides: [side("LEDGER", "12000.00")],
  }),
  group({
    scenario: "missing_in_ledger",
    referenceId: "CHK-20261106-3401",
    accountCode: "lake-client",
    type: "CHECK",
    description: "Check paid, not on the books",
    counterparty: "Sable Consulting",
    story: "On the bank file only.",
    sides: [side("BANK", "-500.00")],
  }),
  group({
    scenario: "duplicate",
    referenceId: "JRN-20261106-3501",
    accountCode: "lake-client",
    type: "JOURNAL",
    description: "Fee rebate entered twice",
    counterparty: "Internal",
    story: "Two identical ledger rows and one bank row.",
    sides: [
      side("LEDGER", "15000.00"),
      side("LEDGER", "15000.00"),
      side("BANK", "15000.00"),
    ],
  }),

  // Redwood Deposit Bank — Disbursement
  group({
    scenario: "matched",
    referenceId: "ACH-20261106-4001",
    accountCode: "redwood-disbursement",
    type: "ACH",
    description: "Payroll debit",
    counterparty: "Northline Payroll",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-210000.00"), side("BANK", "-210000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "CHK-20261106-4002",
    accountCode: "redwood-disbursement",
    type: "CHECK",
    description: "Office vendor check",
    counterparty: "Paper and Pine LLC",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-4450.00"), side("BANK", "-4450.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "WIRE-20261106-4003",
    accountCode: "redwood-disbursement",
    type: "WIRE",
    description: "Funding wire in",
    counterparty: "Northline Treasury",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "50000.00"), side("BANK", "50000.00")],
  }),
  group({
    scenario: "matched",
    referenceId: "JRN-20261106-4004",
    accountCode: "redwood-disbursement",
    type: "JOURNAL",
    description: "Expense allocation",
    counterparty: "Internal",
    story: "Ledger and bank agree.",
    sides: [side("LEDGER", "-20000.00"), side("BANK", "-20000.00")],
  }),
  group({
    scenario: "timing",
    referenceId: "CHK-20261106-4101",
    accountCode: "redwood-disbursement",
    type: "CHECK",
    description: "Check clearing after the weekend",
    counterparty: "Linden Supplies",
    story: "Same amount and reference. Bank value date is the following Tuesday.",
    sides: [
      side("LEDGER", "-1800.00"),
      side("BANK", "-1800.00", "2026-11-10"),
    ],
  }),
  group({
    scenario: "amount_break",
    referenceId: "ACH-20261106-4201",
    accountCode: "redwood-disbursement",
    type: "ACH",
    description: "ACH return",
    counterparty: "Paper and Pine LLC",
    story: "Bank amount includes a $5.00 return fee the ledger does not.",
    sides: [side("LEDGER", "-2500.00"), side("BANK", "-2505.00")],
  }),
  group({
    scenario: "missing_in_bank",
    referenceId: "CHK-20261106-4301",
    accountCode: "redwood-disbursement",
    type: "CHECK",
    description: "Check not yet presented",
    counterparty: "Linden Supplies",
    story: "On the ledger only.",
    sides: [side("LEDGER", "-620.00")],
  }),
  group({
    scenario: "missing_in_ledger",
    referenceId: "WIRE-20261106-4401",
    accountCode: "redwood-disbursement",
    type: "WIRE",
    description: "Account analysis fee",
    counterparty: "Redwood Deposit Bank",
    story: "On the bank file only.",
    sides: [side("BANK", "-15.00")],
  }),
];

const SCHEDULED: PlannedScheduledItem[] = [
  {
    accountCode: "harbor-operating",
    type: "ACH",
    amount: "-95000.00",
    settleDate: "2026-11-09",
    referenceId: "PND-20261109-5001",
    description: "Payroll tax debit",
    counterparty: "US Treasury (synthetic)",
  },
  {
    accountCode: "cedar-settlement",
    type: "WIRE",
    amount: "1500000.00",
    settleDate: "2026-11-09",
    referenceId: "PND-20261109-5002",
    description: "Expected DTC settlement",
    counterparty: "Cedar DTC",
  },
  {
    accountCode: "lake-client",
    type: "WIRE",
    amount: "-800000.00",
    settleDate: "2026-11-10",
    referenceId: "PND-20261110-5003",
    description: "Scheduled client redemption",
    counterparty: "Orchid Capital",
  },
  {
    accountCode: "redwood-disbursement",
    type: "ACH",
    amount: "-40000.00",
    settleDate: "2026-11-10",
    referenceId: "PND-20261110-5004",
    description: "Vendor debit",
    counterparty: "Paper and Pine LLC",
  },
  {
    accountCode: "cedar-settlement",
    type: "WIRE",
    amount: "-2200000.00",
    settleDate: "2026-11-11",
    referenceId: "PND-20261111-5005",
    description: "DTC settlement out",
    counterparty: "Cedar DTC",
  },
  {
    accountCode: "harbor-operating",
    type: "JOURNAL",
    amount: "100000.00",
    settleDate: "2026-11-11",
    referenceId: "PND-20261111-5006",
    description: "Funding return",
    counterparty: "Internal",
  },
];

export function buildDayPlan(): DayPlan {
  const forecastBusinessDates = nextBusinessDays(DAY, 3);
  const accounts = ACCOUNTS.map((account) => ({ ...account }));
  const knownAccounts = new Set(accounts.map((account) => account.code));
  const groups = [...GROUPS, ...buildVolumeGroups(accounts.map((account) => account.code))].map((raw) =>
    finalizeGroup(raw, knownAccounts),
  );
  const rowCount = groups.reduce((sum, item) => sum + item.transactions.length, 0);
  if (rowCount !== TARGET_TRANSACTION_ROWS) {
    throw new Error(`Expected ${TARGET_TRANSACTION_ROWS} transaction rows, built ${rowCount}`);
  }
  const scheduledItems = SCHEDULED.map((item) => ({ ...item }));

  assertUniqueReferences(groups, scheduledItems);
  for (const item of scheduledItems) {
    assertMoney(item.amount);
    if (!knownAccounts.has(item.accountCode)) {
      throw new Error(`Scheduled item uses unknown account ${item.accountCode}`);
    }
    if (!forecastBusinessDates.includes(item.settleDate)) {
      throw new Error(
        `${item.referenceId} settles ${item.settleDate}, outside the 3-business-day forecast`,
      );
    }
  }

  return {
    businessDate: DAY,
    firmName: DEMO_FIRM_NAME,
    dataLabel: DEMO_DATA_LABEL,
    approvalThreshold: DEMO_APPROVAL_THRESHOLD,
    cutoffTime: DEMO_CUTOFF_TIME,
    timezone: DEMO_TIMEZONE,
    forecastBusinessDates,
    accounts,
    groups,
    scheduledItems,
  };
}

/** Opening balance plus every ledger row. Duplicates count twice, because the books currently show both. */
export function previewLedgerEnding(plan: DayPlan, accountCode: string): string {
  const account = plan.accounts.find((item) => item.code === accountCode);
  if (!account) {
    throw new Error(`Unknown account ${accountCode}`);
  }
  const ledgerCents = plan.groups
    .flatMap((item) => item.transactions)
    .filter((txn) => txn.accountCode === accountCode && txn.source === "LEDGER")
    .reduce((sum, txn) => sum + toCents(txn.amount), 0);
  return fromCents(toCents(account.openingBalance) + ledgerCents);
}

export function isLeftoverCash(plan: DayPlan, accountCode: string): boolean {
  const account = plan.accounts.find((item) => item.code === accountCode);
  if (!account) {
    throw new Error(`Unknown account ${accountCode}`);
  }
  return toCents(previewLedgerEnding(plan, accountCode)) > toCents(account.targetBalance);
}

function group(raw: RawGroup): RawGroup {
  return raw;
}

function side(source: SourceName, amount: string, valueDate?: string): RawSide {
  return { source, amount, valueDate };
}

function finalizeGroup(raw: RawGroup, knownAccounts: Set<string>): PlannedGroup {
  if (!knownAccounts.has(raw.accountCode)) {
    throw new Error(`${raw.referenceId} uses unknown account ${raw.accountCode}`);
  }

  const transactions: PlannedTransaction[] = raw.sides.map((item) => ({
    source: item.source,
    accountCode: raw.accountCode,
    type: raw.type,
    amount: item.amount,
    valueDate: item.valueDate ?? DAY,
    businessDate: DAY,
    referenceId: raw.referenceId,
    description: raw.description,
    counterparty: raw.counterparty,
  }));

  for (const txn of transactions) {
    assertMoney(txn.amount);
    if (txn.referenceId !== raw.referenceId) {
      throw new Error(`Reference mismatch inside ${raw.referenceId}`);
    }
  }

  const ledger = transactions.filter((txn) => txn.source === "LEDGER");
  const bank = transactions.filter((txn) => txn.source === "BANK");
  let expectTimingDifference = false;
  let expectLagDays = 0;

  switch (raw.scenario) {
    case "matched":
      requirePair(raw, ledger, bank);
      requireSameAmount(raw, ledger[0], bank[0]);
      requireSameDate(raw, ledger[0], bank[0]);
      break;
    case "timing":
      requirePair(raw, ledger, bank);
      requireSameAmount(raw, ledger[0], bank[0]);
      if (ledger[0].valueDate === bank[0].valueDate) {
        throw new Error(`${raw.referenceId} is marked timing but the value dates match`);
      }
      expectTimingDifference = true;
      expectLagDays = calendarLagDays(ledger[0].valueDate, bank[0].valueDate);
      break;
    case "amount_break":
      requirePair(raw, ledger, bank);
      if (ledger[0].amount === bank[0].amount) {
        throw new Error(`${raw.referenceId} is marked amount break but the amounts match`);
      }
      requireSameDate(raw, ledger[0], bank[0]);
      break;
    case "missing_in_bank":
      if (ledger.length !== 1 || bank.length !== 0) {
        throw new Error(`${raw.referenceId} should have one ledger row and no bank row`);
      }
      break;
    case "missing_in_ledger":
      if (ledger.length !== 0 || bank.length !== 1) {
        throw new Error(`${raw.referenceId} should have one bank row and no ledger row`);
      }
      break;
    case "duplicate":
      if (ledger.length <= 1 && bank.length <= 1) {
        throw new Error(`${raw.referenceId} is marked duplicate but neither side repeats`);
      }
      break;
    default: {
      const neverScenario: never = raw.scenario;
      throw new Error(`Unknown scenario ${neverScenario}`);
    }
  }

  return {
    scenario: raw.scenario,
    expectedClassification: classificationFor(raw.scenario),
    expectTimingDifference,
    expectLagDays,
    referenceId: raw.referenceId,
    accountCode: raw.accountCode,
    story: raw.story,
    transactions,
  };
}

function classificationFor(scenario: Scenario): ClassificationName {
  switch (scenario) {
    case "matched":
    case "timing":
      return "MATCHED";
    case "amount_break":
      return "AMOUNT_BREAK";
    case "missing_in_bank":
      return "MISSING_IN_BANK";
    case "missing_in_ledger":
      return "MISSING_IN_LEDGER";
    case "duplicate":
      return "DUPLICATE";
  }
}

function requirePair(
  raw: RawGroup,
  ledger: PlannedTransaction[],
  bank: PlannedTransaction[],
): void {
  if (ledger.length !== 1 || bank.length !== 1) {
    throw new Error(`${raw.referenceId} should have one ledger row and one bank row`);
  }
}

function requireSameAmount(
  raw: RawGroup,
  ledger: PlannedTransaction,
  bank: PlannedTransaction,
): void {
  if (ledger.amount !== bank.amount) {
    throw new Error(`${raw.referenceId} amounts differ: ${ledger.amount} vs ${bank.amount}`);
  }
}

function requireSameDate(
  raw: RawGroup,
  ledger: PlannedTransaction,
  bank: PlannedTransaction,
): void {
  if (ledger.valueDate !== bank.valueDate) {
    throw new Error(`${raw.referenceId} value dates differ`);
  }
}

function assertUniqueReferences(
  groups: PlannedGroup[],
  scheduledItems: PlannedScheduledItem[],
): void {
  const seen = new Set<string>();
  for (const item of [...groups.map((group) => group.referenceId), ...scheduledItems.map((item) => item.referenceId)]) {
    if (seen.has(item)) {
      throw new Error(`Duplicate reference id ${item}`);
    }
    seen.add(item);
  }
}
