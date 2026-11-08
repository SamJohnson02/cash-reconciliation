import { describe, expect, it } from "vitest";

import { buildDayPlan, isLeftoverCash, previewLedgerEnding } from "./generateDay.js";

describe("synthetic business day", () => {
  const plan = buildDayPlan();

  it("is labeled as a demo and fixed to Friday 6 November 2026", () => {
    expect(plan.firmName).toContain("demo");
    expect(plan.dataLabel.toLowerCase()).toContain("synthetic");
    expect(plan.businessDate).toBe("2026-11-06");
    expect(plan.forecastBusinessDates).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
    ]);
  });

  it("builds the same plan on every call", () => {
    expect(buildDayPlan()).toEqual(plan);
  });

  it("includes one group for each break the matcher will have to classify", () => {
    const counts = Object.fromEntries(
      ["matched", "timing", "amount_break", "missing_in_bank", "missing_in_ledger", "duplicate"].map(
        (scenario) => [scenario, plan.groups.filter((group) => group.scenario === scenario).length],
      ),
    );
    expect(counts).toEqual({
      matched: 381,
      timing: 44,
      amount_break: 28,
      missing_in_bank: 24,
      missing_in_ledger: 25,
      duplicate: 15,
    });
    const rows = plan.groups.reduce((sum, group) => sum + group.transactions.length, 0);
    expect(rows).toBe(1000);
  });

  it("gives timing breaks a match classification plus a non-zero lag", () => {
    const timing = plan.groups.filter((group) => group.scenario === "timing");
    const featured = Object.fromEntries(timing.map((group) => [group.referenceId, group.expectLagDays]));
    expect(featured["ACH-20261106-1101"]).toBe(3);
    expect(featured["WIRE-20261106-2101"]).toBe(-1);
    expect(featured["ACH-20261106-3101"]).toBe(1);
    expect(featured["CHK-20261106-4101"]).toBe(4);
    for (const group of timing) {
      expect(group.expectedClassification).toBe("MATCHED");
      expect(group.expectTimingDifference).toBe(true);
    }
  });

  it("keeps reference ids unique across the recon file and the forecast", () => {
    const refs = [
      ...plan.groups.map((group) => group.referenceId),
      ...plan.scheduledItems.map((item) => item.referenceId),
    ];
    expect(new Set(refs).size).toBe(refs.length);
    expect(plan.scheduledItems.length).toBe(6);
  });

  it("flags leftover cash only when the ledger ending is above the account target", () => {
    expect(previewLedgerEnding(plan, "harbor-operating")).toBe("2161324.50");
    expect(previewLedgerEnding(plan, "cedar-settlement")).toBe("8163920.00");
    expect(previewLedgerEnding(plan, "lake-client")).toBe("13859400.40");
    expect(previewLedgerEnding(plan, "redwood-disbursement")).toBe("450630.00");

    expect(isLeftoverCash(plan, "harbor-operating")).toBe(true);
    expect(isLeftoverCash(plan, "cedar-settlement")).toBe(true);
    expect(isLeftoverCash(plan, "lake-client")).toBe(true);
    expect(isLeftoverCash(plan, "redwood-disbursement")).toBe(false);
  });
});
