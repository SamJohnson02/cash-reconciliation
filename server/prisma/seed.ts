import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/auth/password.js";
import { dateToUtc } from "../src/dates.js";
import { DEMO_PASSWORD, DEMO_USERS } from "../src/demo/constants.js";
import { buildDayPlan, isLeftoverCash, previewLedgerEnding } from "../src/demo/generateDay.js";

const prisma = new PrismaClient();

async function main() {
  const plan = buildDayPlan();
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const accountIdByCode = new Map(plan.accounts.map((account) => [account.code, account.id]));
  const rows = plan.groups.flatMap((group) => group.transactions);
  const ledgerRows = rows.filter((row) => row.source === "LEDGER");
  const bankRows = rows.filter((row) => row.source === "BANK");

  await prisma.$transaction(async (tx) => {
    await tx.actionLog.deleteMany();
    await tx.dailyClose.deleteMany();
    await tx.exceptionEvent.deleteMany();
    await tx.exceptionNote.deleteMany();
    await tx.exception.deleteMany();
    await tx.matchLink.deleteMany();
    await tx.matchResult.deleteMany();
    await tx.reconciliationRun.deleteMany();
    await tx.transfer.deleteMany();
    await tx.scheduledItem.deleteMany();
    await tx.transaction.deleteMany();
    await tx.importBatch.deleteMany();
    await tx.account.deleteMany();
    await tx.user.deleteMany();
    await tx.appSetting.deleteMany();

    await tx.appSetting.create({
      data: {
        id: "default",
        firmName: plan.firmName,
        dataLabel: plan.dataLabel,
        transferApprovalThreshold: plan.approvalThreshold,
        cutoffTime: plan.cutoffTime,
        timezone: plan.timezone,
      },
    });

    await tx.user.createMany({
      data: DEMO_USERS.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        title: user.title,
      })),
    });

    await tx.account.createMany({
      data: plan.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        targetBalance: account.targetBalance,
        openingBalance: account.openingBalance,
        synthetic: true,
      })),
    });

    await tx.importBatch.createMany({
      data: [
        {
          id: "batch_ledger_20261106",
          source: "LEDGER",
          businessDate: dateToUtc(plan.businessDate),
          fileName: "internal-ledger-2026-11-06.csv",
          rowCount: ledgerRows.length,
          synthetic: true,
        },
        {
          id: "batch_bank_20261106",
          source: "BANK",
          businessDate: dateToUtc(plan.businessDate),
          fileName: "bank-file-2026-11-06.csv",
          rowCount: bankRows.length,
          synthetic: true,
        },
      ],
    });

    await tx.transaction.createMany({
      data: rows.map((row) => ({
        batchId: row.source === "LEDGER" ? "batch_ledger_20261106" : "batch_bank_20261106",
        source: row.source,
        accountId: accountIdByCode.get(row.accountCode)!,
        type: row.type,
        amount: row.amount,
        valueDate: dateToUtc(row.valueDate),
        businessDate: dateToUtc(row.businessDate),
        referenceId: row.referenceId,
        description: row.description,
        counterparty: row.counterparty,
        synthetic: true,
      })),
    });

    await tx.scheduledItem.createMany({
      data: plan.scheduledItems.map((item) => ({
        accountId: accountIdByCode.get(item.accountCode)!,
        type: item.type,
        amount: item.amount,
        settleDate: dateToUtc(item.settleDate),
        referenceId: item.referenceId,
        description: item.description,
        counterparty: item.counterparty,
        synthetic: true,
      })),
    });

    await tx.actionLog.create({
      data: {
        action: "seed.loaded",
        entityType: "business_day",
        entityId: plan.businessDate,
        metadata: {
          synthetic: true,
          ledgerRows: ledgerRows.length,
          bankRows: bankRows.length,
          scheduledItems: plan.scheduledItems.length,
        },
      },
    });
  });

  console.log(plan.dataLabel);
  console.log(`Loaded ${plan.businessDate} for ${plan.firmName}`);
  console.log(`Ledger rows ${ledgerRows.length}, bank rows ${bankRows.length}, scheduled ${plan.scheduledItems.length}`);
  console.log("Demo users (password Demo1234!):");
  for (const user of DEMO_USERS) {
    console.log(`  ${user.email}  ${user.role}  ${user.title}`);
  }
  console.log("Ledger ending balances:");
  for (const account of plan.accounts) {
    const ending = previewLedgerEnding(plan, account.code);
    const flag = isLeftoverCash(plan, account.code) ? "leftover cash" : "at or under target";
    console.log(`  ${account.bankName} ${account.name}: ${ending} (${flag})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
