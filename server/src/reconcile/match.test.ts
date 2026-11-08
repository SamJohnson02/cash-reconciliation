import { describe, expect, it } from "vitest";

import { buildDayPlan } from "../demo/generateDay.js";
import { reconcile, type MatchInput } from "./match.js";

function row(partial: MatchInput): MatchInput {
  return partial;
}

describe("reconciliation classifications", () => {
  it("classifies equal reference, amount, and value date as Matched", () => {
    const [result] = reconcile([
      row({ id: "l", source: "LEDGER", accountId: "ops", amount: "10.00", valueDate: "2026-11-06", referenceId: "ACH-1" }),
      row({ id: "b", source: "BANK", accountId: "ops", amount: "10.00", valueDate: "2026-11-06", referenceId: "ACH-1" }),
    ]);
    expect(result.classification).toBe("MATCHED");
    expect(result.timingDifference).toBe(false);
    expect(result.lagDays).toBe(0);
    expect(result.opensException).toBe(false);
  });

  it("classifies the same reference and amount on different value dates as Matched with a timing flag", () => {
    const [later] = reconcile([
      row({ id: "l", source: "LEDGER", accountId: "ops", amount: "-42.00", valueDate: "2026-11-06", referenceId: "ACH-T" }),
      row({ id: "b", source: "BANK", accountId: "ops", amount: "-42.00", valueDate: "2026-11-09", referenceId: "ACH-T" }),
    ]);
    expect(later.classification).toBe("MATCHED");
    expect(later.timingDifference).toBe(true);
    expect(later.lagDays).toBe(3);
    expect(later.opensException).toBe(true);

    const [earlier] = reconcile([
      row({ id: "l", source: "LEDGER", accountId: "ops", amount: "5.00", valueDate: "2026-11-06", referenceId: "WIRE-T" }),
      row({ id: "b", source: "BANK", accountId: "ops", amount: "5.00", valueDate: "2026-11-05", referenceId: "WIRE-T" }),
    ]);
    expect(earlier.timingDifference).toBe(true);
    expect(earlier.lagDays).toBe(-1);
    expect(earlier.opensException).toBe(true);
  });

  it("classifies one row on each side with different amounts as an Amount Break", () => {
    const [result] = reconcile([
      row({ id: "l", source: "LEDGER", accountId: "ops", amount: "125000.00", valueDate: "2026-11-06", referenceId: "WIRE-A" }),
      row({ id: "b", source: "BANK", accountId: "ops", amount: "125050.00", valueDate: "2026-11-06", referenceId: "WIRE-A" }),
    ]);
    expect(result.classification).toBe("AMOUNT_BREAK");
    expect(result.amountLedger).toBe("125000.00");
    expect(result.amountBank).toBe("125050.00");
    expect(result.timingDifference).toBe(false);
    expect(result.opensException).toBe(true);
  });

  it("classifies a ledger-only reference as Missing in Bank", () => {
    const [result] = reconcile([
      row({ id: "l", source: "LEDGER", accountId: "ops", amount: "-8.00", valueDate: "2026-11-06", referenceId: "CHK-M" }),
    ]);
    expect(result.classification).toBe("MISSING_IN_BANK");
    expect(result.amountLedger).toBe("-8.00");
    expect(result.amountBank).toBeNull();
    expect(result.opensException).toBe(true);
  });

  it("classifies a bank-only reference as Missing in Ledger", () => {
    const [result] = reconcile([
      row({ id: "b", source: "BANK", accountId: "ops", amount: "-35.00", valueDate: "2026-11-06", referenceId: "WIRE-F" }),
    ]);
    expect(result.classification).toBe("MISSING_IN_LEDGER");
    expect(result.amountLedger).toBeNull();
    expect(result.amountBank).toBe("-35.00");
    expect(result.opensException).toBe(true);
  });

  it("classifies a repeated reference as Duplicate, including when the other side is empty or the amounts differ", () => {
    const [repeatedLedger] = reconcile([
      row({ id: "l1", source: "LEDGER", accountId: "ops", amount: "19.00", valueDate: "2026-11-06", referenceId: "ACH-D" }),
      row({ id: "l2", source: "LEDGER", accountId: "ops", amount: "19.00", valueDate: "2026-11-06", referenceId: "ACH-D" }),
      row({ id: "b", source: "BANK", accountId: "ops", amount: "19.00", valueDate: "2026-11-06", referenceId: "ACH-D" }),
    ]);
    expect(repeatedLedger.classification).toBe("DUPLICATE");
    expect(repeatedLedger.transactionIds).toEqual(["b", "l1", "l2"]);
    expect(repeatedLedger.opensException).toBe(true);

    const [bankOnlyDup] = reconcile([
      row({ id: "b1", source: "BANK", accountId: "ops", amount: "-3.00", valueDate: "2026-11-06", referenceId: "WIRE-D" }),
      row({ id: "b2", source: "BANK", accountId: "ops", amount: "-3.00", valueDate: "2026-11-06", referenceId: "WIRE-D" }),
    ]);
    expect(bankOnlyDup.classification).toBe("DUPLICATE");

    const [amountAndDup] = reconcile([
      row({ id: "l1", source: "LEDGER", accountId: "ops", amount: "10.00", valueDate: "2026-11-06", referenceId: "JRN-D" }),
      row({ id: "l2", source: "LEDGER", accountId: "ops", amount: "12.00", valueDate: "2026-11-06", referenceId: "JRN-D" }),
      row({ id: "b", source: "BANK", accountId: "ops", amount: "10.00", valueDate: "2026-11-06", referenceId: "JRN-D" }),
    ]);
    expect(amountAndDup.classification).toBe("DUPLICATE");
    expect(amountAndDup.amountLedger).toBeNull();
    expect(amountAndDup.amountBank).toBe("10.00");
  });

  it("does not let input order change the classification", () => {
    const rows: MatchInput[] = [
      row({ id: "b", source: "BANK", accountId: "ops", amount: "10.00", valueDate: "2026-11-06", referenceId: "ACH-1" }),
      row({ id: "l", source: "LEDGER", accountId: "ops", amount: "11.00", valueDate: "2026-11-06", referenceId: "ACH-2" }),
      row({ id: "l2", source: "LEDGER", accountId: "ops", amount: "10.00", valueDate: "2026-11-06", referenceId: "ACH-1" }),
    ];
    expect(reconcile([...rows].reverse())).toEqual(reconcile(rows));
  });

  it("classifies the synthetic Friday book the way the day plan describes", () => {
    const plan = buildDayPlan();
    const inputs: MatchInput[] = plan.groups.flatMap((group, groupIndex) =>
      group.transactions.map((txn, txnIndex) => ({
        id: `${groupIndex}-${txnIndex}`,
        source: txn.source,
        accountId: txn.accountCode,
        amount: txn.amount,
        valueDate: txn.valueDate,
        referenceId: txn.referenceId,
      })),
    );
    const results = reconcile(inputs);
    expect(results).toHaveLength(plan.groups.length);
    for (const group of plan.groups) {
      const found = results.find((result) => result.referenceId === group.referenceId);
      expect(found?.classification, group.referenceId).toBe(group.expectedClassification);
      expect(found?.timingDifference, group.referenceId).toBe(group.expectTimingDifference);
      expect(found?.lagDays, group.referenceId).toBe(group.expectLagDays);
      expect(found?.opensException, group.referenceId).toBe(group.scenario !== "matched");
    }
  });
});
