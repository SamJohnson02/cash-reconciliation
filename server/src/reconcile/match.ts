import { calendarLagDays } from "../dates.js";
import { fromCents, toCents } from "../money.js";
import type { ClassificationName, SourceName } from "../demo/types.js";

export interface MatchInput {
  id: string;
  source: SourceName;
  accountId: string;
  amount: string;
  valueDate: string;
  referenceId: string;
}

export interface MatchOutput {
  classification: ClassificationName;
  referenceId: string;
  accountId: string;
  transactionIds: string[];
  amountLedger: string | null;
  amountBank: string | null;
  ledgerValueDate: string | null;
  bankValueDate: string | null;
  timingDifference: boolean;
  lagDays: number;
  opensException: boolean;
}

/**
 * Group by reference id, then classify:
 * Duplicate, Missing in Bank, Missing in Ledger, Amount Break, Matched.
 * A matched pair whose value dates differ stays Matched and is flagged as a timing difference.
 */
export function reconcile(transactions: MatchInput[]): MatchOutput[] {
  const groups = new Map<string, MatchInput[]>();
  for (const txn of transactions) {
    const list = groups.get(txn.referenceId);
    if (list) list.push(txn);
    else groups.set(txn.referenceId, [txn]);
  }

  const results: MatchOutput[] = [];
  for (const [referenceId, rows] of groups) {
    results.push(classify(referenceId, rows));
  }
  results.sort((left, right) => left.referenceId.localeCompare(right.referenceId));
  return results;
}

function classify(referenceId: string, rows: MatchInput[]): MatchOutput {
  const ledger = rows.filter((row) => row.source === "LEDGER");
  const bank = rows.filter((row) => row.source === "BANK");
  const classification = classificationFor(ledger, bank);
  const ledgerValueDate = uniform(ledger.map((row) => row.valueDate));
  const bankValueDate = uniform(bank.map((row) => row.valueDate));
  const lagDays =
    ledgerValueDate && bankValueDate ? calendarLagDays(ledgerValueDate, bankValueDate) : 0;
  const timingDifference = classification === "MATCHED" && lagDays !== 0;
  const accountIds = new Set(rows.map((row) => row.accountId));
  const accountId = accountIds.size === 1 ? rows[0].accountId : (ledger[0] ?? bank[0]).accountId;

  return {
    classification,
    referenceId,
    accountId,
    transactionIds: rows.map((row) => row.id).sort(),
    amountLedger: uniformAmount(ledger),
    amountBank: uniformAmount(bank),
    ledgerValueDate,
    bankValueDate,
    timingDifference,
    lagDays,
    opensException: classification !== "MATCHED" || timingDifference,
  };
}

function classificationFor(ledger: MatchInput[], bank: MatchInput[]): ClassificationName {
  if (ledger.length > 1 || bank.length > 1) return "DUPLICATE";
  if (ledger.length === 1 && bank.length === 0) return "MISSING_IN_BANK";
  if (ledger.length === 0 && bank.length === 1) return "MISSING_IN_LEDGER";
  if (ledger.length === 1 && bank.length === 1) {
    return toCents(ledger[0].amount) === toCents(bank[0].amount) ? "MATCHED" : "AMOUNT_BREAK";
  }
  throw new Error("A reference group needs at least one ledger or bank row");
}

function uniformAmount(rows: MatchInput[]): string | null {
  const amounts = rows.map((row) => fromCents(toCents(row.amount)));
  return uniform(amounts);
}

function uniform(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.every((value) => value === values[0]) ? values[0] : null;
}
