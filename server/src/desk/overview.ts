import { prisma } from "../db.js";
import {
  calendarDateInZone,
  calendarDaysBetween,
  dateToUtc,
  nextBusinessDays,
  zonedLocalToUtc,
} from "../dates.js";
import { HttpError } from "../http.js";
import { fromCents, toCents } from "../money.js";
import { reconcile, type MatchInput } from "../reconcile/match.js";
import type { ClassificationName, SourceName, TransactionTypeName } from "../demo/types.js";

export interface DeskRow {
  source: SourceName;
  amount: string;
  valueDate: string;
  description: string;
  counterparty: string;
  type: TransactionTypeName;
}

export interface DeskNote {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface DeskEvent {
  id: string;
  actorName: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  detail: string | null;
  createdAt: string;
}

export interface DeskItem {
  id: string;
  exceptionId: string | null;
  referenceId: string;
  classification: ClassificationName;
  timingDifference: boolean;
  lagDays: number;
  amountLedger: string | null;
  amountBank: string | null;
  accountId: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  type: TransactionTypeName;
  description: string;
  counterparty: string;
  rows: DeskRow[];
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | null;
  ownerId: string | null;
  ownerName: string | null;
  resolutionReason: string | null;
  ageDays: number | null;
  pastCutoff: boolean;
  notes: DeskNote[];
  events: DeskEvent[];
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
  files: { source: SourceName; fileName: string; rowCount: number }[];
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
  actorId?: string;
  status?: "OPEN" | "INVESTIGATING" | "RESOLVED";
  ownerId?: string | null;
  resolutionReason?: string;
  note?: string;
}

const STATUSES = new Set(["OPEN", "INVESTIGATING", "RESOLVED"]);

let ensuring: Promise<void> | null = null;

export async function getOverview(now = new Date()): Promise<Overview> {
  await ensureReconciliation();
  return buildOverview(now);
}

export function ensureReconciliation(): Promise<void> {
  ensuring ??= createRunIfMissing().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

async function createRunIfMissing(): Promise<void> {
  const context = await loadContext();
  if (!context) return;

  const existing = await prisma.reconciliationRun.findFirst({
    where: { businessDate: context.businessDate },
  });
  if (existing) return;

  const inputs: MatchInput[] = context.transactions.map((txn) => ({
    id: txn.id,
    source: txn.source,
    accountId: txn.accountId,
    amount: money(txn.amount),
    valueDate: isoDate(txn.valueDate),
    referenceId: txn.referenceId,
  }));
  const results = reconcile(inputs);
  const openedAt = zonedLocalToUtc(context.iso, "08:00", context.timezone);

  await prisma.$transaction(async (tx) => {
    const again = await tx.reconciliationRun.findFirst({
      where: { businessDate: context.businessDate },
    });
    if (again) return;

    const run = await tx.reconciliationRun.create({
      data: { businessDate: context.businessDate },
    });

    const created = await tx.matchResult.createManyAndReturn({
      data: results.map((result) => ({
        runId: run.id,
        classification: result.classification,
        referenceId: result.referenceId,
        accountId: result.accountId,
        amountLedger: result.amountLedger,
        amountBank: result.amountBank,
        ledgerValueDate: result.ledgerValueDate ? dateToUtc(result.ledgerValueDate) : null,
        bankValueDate: result.bankValueDate ? dateToUtc(result.bankValueDate) : null,
        timingDifference: result.timingDifference,
        lagDays: result.lagDays,
      })),
    });
    const matchIdByReference = new Map(created.map((row) => [row.referenceId, row.id]));
    await tx.matchLink.createMany({
      data: results.flatMap((result) =>
        result.transactionIds.map((transactionId) => ({
          matchResultId: matchIdByReference.get(result.referenceId)!,
          transactionId,
        })),
      ),
    });
    await tx.exception.createMany({
      data: results
        .filter((result) => result.opensException)
        .map((result) => ({
          matchResultId: matchIdByReference.get(result.referenceId)!,
          status: "OPEN" as const,
          businessDate: context.businessDate,
          createdAt: openedAt,
        })),
    });

    await tx.actionLog.create({
      data: {
        action: "reconciliation.ran",
        entityType: "reconciliation_run",
        entityId: run.id,
        metadata: {
          businessDate: context.iso,
          groups: results.length,
          breaks: results.filter((result) => result.opensException).length,
        },
      },
    });
  }, { timeout: 60_000 });
}

export async function updateException(id: string, body: ExceptionUpdate): Promise<void> {
  if (!body || typeof body !== "object") {
    throw new HttpError("The update was empty.", 400);
  }
  if (!body.actorId) {
    throw new HttpError("Choose a person before changing a break.", 400);
  }
  const actor = await prisma.user.findUnique({ where: { id: body.actorId } });
  if (!actor) throw new HttpError("Choose a person before changing a break.", 400);

  const exception = await prisma.exception.findUnique({
    where: { id },
    include: { matchResult: true },
  });
  if (!exception) throw new HttpError("That break is not on this book.", 404);

  if (body.status !== undefined && !STATUSES.has(body.status)) {
    throw new HttpError("Status must be Open, Investigating, or Resolved.", 400);
  }

  const nextStatus = body.status ?? exception.status;
  const reason = body.resolutionReason?.trim();
  if (nextStatus === "RESOLVED" && !(reason || exception.resolutionReason)) {
    throw new HttpError("A resolved break needs a reason.", 400);
  }
  if (reason && reason.length > 500) {
    throw new HttpError("Keep the resolution reason under 500 characters.", 400);
  }

  const note = body.note?.trim() ?? "";
  if (note.length > 500) throw new HttpError("Keep the note under 500 characters.", 400);

  const ownerId = body.ownerId === undefined ? exception.ownerId : body.ownerId;
  if (ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new HttpError("That owner is not on the desk.", 400);
  }

  const statusChanged = nextStatus !== exception.status;
  const ownerChanged = ownerId !== exception.ownerId;
  const nextReason = nextStatus === "RESOLVED" ? (reason ?? exception.resolutionReason) : exception.resolutionReason;
  const reasonChanged = nextReason !== exception.resolutionReason;
  if (!statusChanged && !ownerChanged && !note && !reasonChanged) {
    throw new HttpError("Nothing changed on that break.", 400);
  }

  const referenceId = exception.matchResult.referenceId;

  await prisma.$transaction(async (tx) => {
    await tx.exception.update({
      where: { id },
      data: {
        status: nextStatus,
        ownerId,
        resolutionReason: nextReason,
      },
    });

    if (statusChanged) {
      await tx.exceptionEvent.create({
        data: {
          exceptionId: id,
          actorId: actor.id,
          eventType: "STATUS_CHANGED",
          fromStatus: exception.status,
          toStatus: nextStatus,
          detail: nextStatus === "RESOLVED" ? nextReason : null,
        },
      });
      await tx.actionLog.create({
        data: {
          actorId: actor.id,
          action: "exception.status_changed",
          entityType: "exception",
          entityId: id,
          metadata: { referenceId, from: exception.status, to: nextStatus },
        },
      });
    } else if (reasonChanged) {
      await tx.exceptionEvent.create({
        data: {
          exceptionId: id,
          actorId: actor.id,
          eventType: "RESOLUTION_RECORDED",
          fromStatus: exception.status,
          toStatus: nextStatus,
          detail: nextReason,
        },
      });
    }

    if (ownerChanged) {
      await tx.exceptionEvent.create({
        data: {
          exceptionId: id,
          actorId: actor.id,
          eventType: "OWNER_CHANGED",
          detail: ownerId,
        },
      });
      await tx.actionLog.create({
        data: {
          actorId: actor.id,
          action: "exception.owner_changed",
          entityType: "exception",
          entityId: id,
          metadata: { referenceId, ownerId },
        },
      });
    }

    if (note) {
      await tx.exceptionNote.create({
        data: { exceptionId: id, authorId: actor.id, body: note },
      });
      await tx.exceptionEvent.create({
        data: {
          exceptionId: id,
          actorId: actor.id,
          eventType: "NOTE_ADDED",
          detail: note,
        },
      });
      await tx.actionLog.create({
        data: {
          actorId: actor.id,
          action: "exception.note_added",
          entityType: "exception",
          entityId: id,
          metadata: { referenceId },
        },
      });
    }
  });
}

async function buildOverview(now: Date): Promise<Overview> {
  const context = await loadContext();
  if (!context) {
    throw new HttpError("Load the demo day first with npm run db:setup.", 503);
  }

  const [run, accounts, scheduled, logs] = await Promise.all([
    prisma.reconciliationRun.findFirst({
      where: { businessDate: context.businessDate },
      orderBy: { createdAt: "desc" },
      include: {
        results: {
          include: {
            account: true,
            links: { include: { transaction: true } },
            exception: {
              include: {
                owner: true,
                notes: { include: { author: true }, orderBy: { createdAt: "asc" } },
                events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
              },
            },
          },
          orderBy: { referenceId: "asc" },
        },
      },
    }),
    prisma.account.findMany({ orderBy: { accountNumber: "asc" } }),
    prisma.scheduledItem.findMany({ orderBy: { settleDate: "asc" } }),
    prisma.actionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: true },
    }),
  ]);

  if (!run) throw new HttpError("The reconciliation run did not open.", 500);

  const cutoff = zonedLocalToUtc(context.iso, context.cutoffTime, context.timezone);
  const cutoffPassed = now.getTime() > cutoff.getTime();
  const today = calendarDateInZone(now, context.timezone);
  const forecastDates = nextBusinessDays(context.iso, 3);

  const items: DeskItem[] = run.results.map((result) => {
    const rows = result.links
      .map((link) => link.transaction)
      .sort((left, right) => {
        if (left.source !== right.source) return left.source === "LEDGER" ? -1 : 1;
        return toCents(money(left.amount)) - toCents(money(right.amount));
      });
    const primary = rows.find((row) => row.source === "LEDGER") ?? rows[0];
    const exception = result.exception;
    const ageDays = exception
      ? Math.max(0, calendarDaysBetween(calendarDateInZone(exception.createdAt, context.timezone), today))
      : null;
    const pastCutoff = Boolean(exception && exception.status === "OPEN" && cutoffPassed);
    return {
      id: result.id,
      exceptionId: exception?.id ?? null,
      referenceId: result.referenceId,
      classification: result.classification,
      timingDifference: result.timingDifference,
      lagDays: result.lagDays,
      amountLedger: result.amountLedger ? money(result.amountLedger) : null,
      amountBank: result.amountBank ? money(result.amountBank) : null,
      accountId: result.accountId,
      accountName: result.account.name,
      bankName: result.account.bankName,
      accountNumber: result.account.accountNumber,
      type: primary.type,
      description: primary.description,
      counterparty: primary.counterparty,
      rows: rows.map((row) => ({
        source: row.source,
        amount: money(row.amount),
        valueDate: isoDate(row.valueDate),
        description: row.description,
        counterparty: row.counterparty,
        type: row.type,
      })),
      status: exception?.status ?? null,
      ownerId: exception?.ownerId ?? null,
      ownerName: exception?.owner?.name ?? null,
      resolutionReason: exception?.resolutionReason ?? null,
      ageDays,
      pastCutoff,
      notes:
        exception?.notes.map((note) => ({
          id: note.id,
          authorName: note.author.name,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
        })) ?? [],
      events:
        exception?.events.map((event) => ({
          id: event.id,
          actorName: event.actor.name,
          eventType: event.eventType,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          detail: event.detail,
          createdAt: event.createdAt.toISOString(),
        })) ?? [],
    };
  });

  const ledgerByAccount = new Map<string, number>();
  for (const txn of context.transactions) {
    if (txn.source !== "LEDGER") continue;
    ledgerByAccount.set(txn.accountId, (ledgerByAccount.get(txn.accountId) ?? 0) + toCents(money(txn.amount)));
  }

  const cashAccounts: CashAccount[] = accounts.map((account) => {
    const opening = toCents(money(account.openingBalance));
    const net = ledgerByAccount.get(account.id) ?? 0;
    const ending = opening + net;
    const target = toCents(money(account.targetBalance));
    const forecast = forecastDates.map((date) => {
      const dayNet = scheduled
        .filter((item) => item.accountId === account.id && isoDate(item.settleDate) === date)
        .reduce((sum, item) => sum + toCents(money(item.amount)), 0);
      const cumulative = scheduled
        .filter((item) => item.accountId === account.id && isoDate(item.settleDate) <= date)
        .reduce((sum, item) => sum + toCents(money(item.amount)), 0);
      return {
        date,
        balance: fromCents(ending + cumulative),
        scheduledNet: fromCents(dayNet),
      };
    });
    return {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      openingBalance: fromCents(opening),
      endingBalance: fromCents(ending),
      targetBalance: fromCents(target),
      surplus: fromCents(ending - target),
      leftover: ending > target,
      netActivity: fromCents(net),
      forecast,
    };
  });

  const breaks = items.filter((item) => item.exceptionId);
  const openItems = breaks.filter((item) => item.status === "OPEN");
  const counts = {
    groups: items.length,
    clean: items.filter((item) => item.classification === "MATCHED" && !item.timingDifference).length,
    timing: items.filter((item) => item.timingDifference).length,
    amountBreak: items.filter((item) => item.classification === "AMOUNT_BREAK").length,
    missingInBank: items.filter((item) => item.classification === "MISSING_IN_BANK").length,
    missingInLedger: items.filter((item) => item.classification === "MISSING_IN_LEDGER").length,
    duplicate: items.filter((item) => item.classification === "DUPLICATE").length,
    breaks: breaks.length,
    open: openItems.length,
    investigating: breaks.filter((item) => item.status === "INVESTIGATING").length,
    resolved: breaks.filter((item) => item.status === "RESOLVED").length,
    pastCutoff: items.filter((item) => item.pastCutoff).length,
    leftoverAccounts: cashAccounts.filter((account) => account.leftover).length,
  };

  const aging = [
    { label: "Opened today", count: openItems.filter((item) => item.ageDays === 0).length },
    { label: "1 day", count: openItems.filter((item) => item.ageDays === 1).length },
    { label: "2 days or more", count: openItems.filter((item) => (item.ageDays ?? 0) >= 2).length },
  ];

  const ledgerFile = context.batches.find((batch) => batch.source === "LEDGER");
  const bankFile = context.batches.find((batch) => batch.source === "BANK");
  const checklist = [
    {
      id: "ledger",
      label: "Internal ledger loaded",
      detail: ledgerFile ? `${ledgerFile.fileName} · ${ledgerFile.rowCount} rows` : "Missing",
      done: Boolean(ledgerFile && ledgerFile.rowCount > 0),
    },
    {
      id: "bank",
      label: "Bank file loaded",
      detail: bankFile ? `${bankFile.fileName} · ${bankFile.rowCount} rows` : "Missing",
      done: Boolean(bankFile && bankFile.rowCount > 0),
    },
    {
      id: "run",
      label: "Book matched",
      detail: `${counts.clean} clean matches · ${counts.breaks} breaks`,
      done: true,
    },
    {
      id: "clear",
      label: "Every break resolved or escalated",
      detail:
        counts.open === 0
          ? "Nothing is still open."
          : `${counts.open} still open${cutoffPassed ? " after the cutoff" : ""}. Investigating counts as escalated.`,
      done: counts.open === 0,
    },
  ];

  const roleOrder: Record<string, number> = { MAKER: 0, CHECKER: 1, ADMIN: 2 };

  return {
    firmName: context.firmName,
    dataLabel: context.dataLabel,
    businessDate: context.iso,
    timezone: context.timezone,
    cutoffTime: context.cutoffTime,
    approvalThreshold: money(context.threshold),
    asOf: now.toISOString(),
    cutoffPassed,
    files: context.batches.map((batch) => ({
      source: batch.source,
      fileName: batch.fileName,
      rowCount: batch.rowCount,
    })),
    users: context.users
      .map((user) => ({ id: user.id, name: user.name, role: user.role, title: user.title }))
      .sort((left, right) => (roleOrder[left.role] ?? 9) - (roleOrder[right.role] ?? 9)),
    counts,
    aging,
    checklist,
    checklistPassed: counts.open === 0,
    accounts: cashAccounts,
    items,
    activity: logs.map((log) => ({
      id: log.id,
      action: log.action,
      summary: summarize(log.action, log.metadata, log.actor?.name ?? null),
      actorName: log.actor?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

async function loadContext() {
  const [settings, batches, users, transactions] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: "default" } }),
    prisma.importBatch.findMany({ orderBy: { source: "asc" } }),
    prisma.user.findMany(),
    prisma.transaction.findMany(),
  ]);
  if (!settings || batches.length === 0) return null;
  const iso = isoDate(batches[0].businessDate);
  return {
    settings,
    firmName: settings.firmName,
    dataLabel: settings.dataLabel,
    timezone: settings.timezone,
    cutoffTime: settings.cutoffTime,
    threshold: settings.transferApprovalThreshold,
    batches,
    users,
    transactions,
    iso,
    businessDate: dateToUtc(iso),
  };
}

function summarize(action: string, metadata: unknown, actorName: string | null): string {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const referenceId = typeof meta.referenceId === "string" ? meta.referenceId : "a break";
  const actor = actorName ?? "The desk";
  const status = typeof meta.to === "string" ? statusLabel(meta.to) : "a new status";
  switch (action) {
    case "seed.loaded":
      return "Synthetic ledger and bank file loaded for the demo day.";
    case "reconciliation.ran":
      return "Matching run opened a break for every mismatch, including timing differences.";
    case "exception.status_changed":
      return `${actor} set ${referenceId} to ${status}.`;
    case "exception.owner_changed":
      return `${actor} changed the owner on ${referenceId}.`;
    case "exception.note_added":
      return `${actor} added a note on ${referenceId}.`;
    default:
      return action;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "INVESTIGATING":
      return "Investigating";
    case "RESOLVED":
      return "Resolved";
    default:
      return status;
  }
}

function money(value: { toFixed(digits: number): string }): string {
  return fromCents(toCents(value.toFixed(2)));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
