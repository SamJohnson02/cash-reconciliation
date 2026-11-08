import { fromCents } from "../money.js";
import type { Scenario, SourceName, TransactionTypeName } from "./types.js";

export const TARGET_TRANSACTION_ROWS = 1000;

interface VolumeSide {
  source: SourceName;
  amount: string;
  valueDate?: string;
}

export interface VolumeGroup {
  scenario: Scenario;
  referenceId: string;
  accountCode: string;
  type: TransactionTypeName;
  description: string;
  counterparty: string;
  story: string;
  sides: VolumeSide[];
}

const TYPES: TransactionTypeName[] = ["ACH", "WIRE", "CHECK", "JOURNAL"];
const PARTIES = [
  "Apex Nominees",
  "Northwind Clearing",
  "Brightpath Funds",
  "Orchid Capital",
  "Quarry Asset Management",
  "Birch Advisors",
  "Pinetop Retirement",
  "Summit Transfer Agents",
  "Linden Family Trust",
  "Sable Consulting",
  "Paper and Pine LLC",
  "Maple Street LLC",
  "Oak Clearing",
  "Cedar DTC",
  "Helios Markets",
  "Northline Payroll",
  "Linden Supplies",
  "City Utilities",
];
const LAG_DATES = ["2026-11-09", "2026-11-05", "2026-11-07", "2026-11-10"];

/**
 * Extra synthetic rows that bring the day to 1,000.
 * Each block is built so the added ledger amounts net to zero on every account.
 * The featured breaks keep the cash position.
 */
export function buildVolumeGroups(accountCodes: string[]): VolumeGroup[] {
  const rng = mulberry32(20261106);
  let sequence = 60001;
  let accountCursor = 0;
  let typeCursor = 0;
  const groups: VolumeGroup[] = [];

  const nextAccount = () => {
    const code = accountCodes[accountCursor % accountCodes.length];
    accountCursor += 1;
    return code;
  };
  const nextType = () => {
    const type = TYPES[typeCursor % TYPES.length];
    typeCursor += 1;
    return type;
  };
  const party = () => PARTIES[Math.floor(rng() * PARTIES.length)];
  const dollars = () => (50 + Math.floor(rng() * 40_000)) * 100;

  const add = (
    scenario: Scenario,
    accountCode: string,
    type: TransactionTypeName,
    description: string,
    sides: VolumeSide[],
  ) => {
    const prefix = type === "CHECK" ? "CHK" : type === "JOURNAL" ? "JRN" : type;
    groups.push({
      scenario,
      referenceId: `${prefix}-20261106-${String(sequence).padStart(5, "0")}`,
      accountCode,
      type,
      description,
      counterparty: party(),
      story: "Synthetic volume. Added ledger amounts on an account net to zero.",
      sides,
    });
    sequence += 1;
  };

  for (let index = 0; index < 183; index += 1) {
    const account = nextAccount();
    const amount = dollars();
    add("matched", account, nextType(), "Client receipt", pair(amount));
    add("matched", account, nextType(), "Client payment", pair(-amount));
  }

  for (let index = 0; index < 20; index += 1) {
    const account = nextAccount();
    const amount = dollars();
    const bankDate = LAG_DATES[index % LAG_DATES.length];
    add("timing", account, nextType(), "Receipt with a bank value-date lag", pair(amount, bankDate));
    add("timing", account, nextType(), "Payment with a bank value-date lag", pair(-amount, bankDate));
  }

  for (let index = 0; index < 12; index += 1) {
    const account = nextAccount();
    const amount = dollars();
    const fee = (50 + Math.floor(rng() * 2_000)) * (amount > 0 ? 1 : 1);
    add("amount_break", account, nextType(), "Receipt, fee left off the ledger", brokenPair(amount, fee));
    add("amount_break", account, nextType(), "Payment, fee left off the ledger", brokenPair(-amount, fee));
  }

  for (let index = 0; index < 10; index += 1) {
    const account = nextAccount();
    const amount = dollars();
    add("missing_in_bank", account, nextType(), "Booked, not on the bank file", [side("LEDGER", amount)]);
    add("missing_in_bank", account, nextType(), "Booked, not on the bank file", [side("LEDGER", -amount)]);
  }

  for (let index = 0; index < 21; index += 1) {
    const account = nextAccount();
    const amount = index % 2 === 0 ? dollars() : -dollars();
    add("missing_in_ledger", account, nextType(), "On the bank file, not booked", [side("BANK", amount)]);
  }

  for (let index = 0; index < 6; index += 1) {
    const account = nextAccount();
    const amount = dollars();
    add("duplicate", account, nextType(), "Receipt posted twice on the ledger", duplicated(amount));
    add("duplicate", account, nextType(), "Payment posted twice on the ledger", duplicated(-amount));
  }

  return groups;
}

function pair(cents: number, bankDate?: string): VolumeSide[] {
  return [side("LEDGER", cents), side("BANK", cents, bankDate)];
}

function brokenPair(cents: number, feeCents: number): VolumeSide[] {
  const bank = cents >= 0 ? cents + feeCents : cents - feeCents;
  return [side("LEDGER", cents), side("BANK", bank)];
}

function duplicated(cents: number): VolumeSide[] {
  return [side("LEDGER", cents), side("LEDGER", cents), side("BANK", cents)];
}

function side(source: SourceName, cents: number, valueDate?: string): VolumeSide {
  return { source, amount: fromCents(cents), valueDate };
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
