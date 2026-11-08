-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('LEDGER', 'BANK');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ACH', 'WIRE', 'CHECK', 'JOURNAL');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('MATCHED', 'AMOUNT_BREAK', 'MISSING_IN_BANK', 'MISSING_IN_LEDGER', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ExceptionEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'OWNER_CHANGED', 'NOTE_ADDED', 'RESOLUTION_RECORDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MAKER', 'CHECKER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('WIRE', 'JOURNAL');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "targetBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "businessDate" DATE NOT NULL,
    "fileName" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loadedById" TEXT,
    "rowCount" INTEGER NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "valueDate" DATE NOT NULL,
    "businessDate" DATE NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "classification" "Classification" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountLedger" DECIMAL(18,2),
    "amountBank" DECIMAL(18,2),
    "ledgerValueDate" DATE,
    "bankValueDate" DATE,
    "timingDifference" BOOLEAN NOT NULL DEFAULT false,
    "lagDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_links" (
    "id" TEXT NOT NULL,
    "matchResultId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,

    CONSTRAINT "match_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exceptions" (
    "id" TEXT NOT NULL,
    "matchResultId" TEXT NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "resolutionReason" TEXT,
    "businessDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_notes" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_events" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" "ExceptionEventType" NOT NULL,
    "fromStatus" "ExceptionStatus",
    "toStatus" "ExceptionStatus",
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "firmName" TEXT NOT NULL,
    "dataLabel" TEXT NOT NULL,
    "transferApprovalThreshold" DECIMAL(18,2) NOT NULL,
    "cutoffTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "valueDate" DATE NOT NULL,
    "referenceId" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL,
    "makerId" TEXT NOT NULL,
    "checkerId" TEXT,
    "decisionNote" TEXT,
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_items" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "settleDate" DATE NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scheduled_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_closes" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,
    "openCount" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "daily_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_accountNumber_key" ON "accounts"("accountNumber");

-- CreateIndex
CREATE INDEX "import_batches_businessDate_source_idx" ON "import_batches"("businessDate", "source");

-- CreateIndex
CREATE INDEX "transactions_source_referenceId_idx" ON "transactions"("source", "referenceId");

-- CreateIndex
CREATE INDEX "transactions_businessDate_accountId_idx" ON "transactions"("businessDate", "accountId");

-- CreateIndex
CREATE INDEX "reconciliation_runs_businessDate_idx" ON "reconciliation_runs"("businessDate");

-- CreateIndex
CREATE INDEX "match_results_runId_classification_idx" ON "match_results"("runId", "classification");

-- CreateIndex
CREATE INDEX "match_results_referenceId_idx" ON "match_results"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "match_links_matchResultId_transactionId_key" ON "match_links"("matchResultId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "exceptions_matchResultId_key" ON "exceptions"("matchResultId");

-- CreateIndex
CREATE INDEX "exceptions_status_businessDate_idx" ON "exceptions"("status", "businessDate");

-- CreateIndex
CREATE INDEX "exception_notes_exceptionId_idx" ON "exception_notes"("exceptionId");

-- CreateIndex
CREATE INDEX "exception_events_exceptionId_createdAt_idx" ON "exception_events"("exceptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_referenceId_key" ON "transfers"("referenceId");

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_items_referenceId_key" ON "scheduled_items"("referenceId");

-- CreateIndex
CREATE INDEX "scheduled_items_settleDate_accountId_idx" ON "scheduled_items"("settleDate", "accountId");

-- CreateIndex
CREATE INDEX "action_logs_createdAt_idx" ON "action_logs"("createdAt");

-- CreateIndex
CREATE INDEX "action_logs_entityType_entityId_idx" ON "action_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_closes_businessDate_key" ON "daily_closes"("businessDate");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_loadedById_fkey" FOREIGN KEY ("loadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "reconciliation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_links" ADD CONSTRAINT "match_links_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_links" ADD CONSTRAINT "match_links_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_notes" ADD CONSTRAINT "exception_notes_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_notes" ADD CONSTRAINT "exception_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_events" ADD CONSTRAINT "exception_events_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_events" ADD CONSTRAINT "exception_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_checkerId_fkey" FOREIGN KEY ("checkerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_items" ADD CONSTRAINT "scheduled_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_closes" ADD CONSTRAINT "daily_closes_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

