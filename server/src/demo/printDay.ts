import { buildDayPlan, isLeftoverCash, previewLedgerEnding } from "./generateDay.js";

const plan = buildDayPlan();

console.log(plan.firmName);
console.log(plan.dataLabel);
console.log(`Business date ${plan.businessDate}`);
console.log(`Forecast ${plan.forecastBusinessDates.join(", ")}`);
console.log("");

const scenarios = ["matched", "timing", "amount_break", "missing_in_bank", "missing_in_ledger", "duplicate"];
for (const scenario of scenarios) {
  const count = plan.groups.filter((group) => group.scenario === scenario).length;
  console.log(`${scenario.padEnd(18)} ${count}`);
}

const rowCount = plan.groups.reduce((sum, group) => sum + group.transactions.length, 0);
console.log(`${"transaction rows".padEnd(18)} ${rowCount}`);
console.log(`${"scheduled items".padEnd(18)} ${plan.scheduledItems.length}`);
console.log("");

for (const account of plan.accounts) {
  const ending = previewLedgerEnding(plan, account.code);
  const flag = isLeftoverCash(plan, account.code) ? "leftover cash" : "at or under target";
  console.log(
    `${account.bankName} ${account.name}: open ${account.openingBalance} end ${ending} target ${account.targetBalance} (${flag})`,
  );
}
