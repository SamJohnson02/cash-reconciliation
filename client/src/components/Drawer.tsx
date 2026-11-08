import { useEffect, useState } from "react";

import {
  ageLabel,
  bankVersusLedger,
  breakLabel,
  formatMoney,
  formatShort,
  formatWhen,
  lagSentence,
  statusLabel,
} from "../format";
import type { DeskItem, ExceptionUpdate, Overview } from "../types";

export function Drawer({
  item,
  data,
  actorId,
  onClose,
  onUpdate,
}: {
  item: DeskItem;
  data: Overview;
  actorId: string | null;
  onClose: () => void;
  onUpdate: (id: string, body: Omit<ExceptionUpdate, "actorId">) => Promise<void>;
}) {
  const [reason, setReason] = useState(item.resolutionReason ?? "");
  const [note, setNote] = useState("");
  const [ownerId, setOwnerId] = useState(item.ownerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const actor = data.users.find((user) => user.id === actorId);

  useEffect(() => {
    setReason(item.resolutionReason ?? "");
    setNote("");
    setOwnerId(item.ownerId ?? "");
    setError(null);
  }, [item]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(body: Omit<ExceptionUpdate, "actorId">) {
    if (!item.exceptionId) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate(item.exceptionId, body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that change.");
    } finally {
      setSaving(false);
    }
  }

  const ledgerRows = item.rows.filter((row) => row.source === "LEDGER");
  const bankRows = item.rows.filter((row) => row.source === "BANK");
  const gap = bankVersusLedger(item.amountLedger, item.amountBank);

  return (
    <div className="scrim" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="break-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <div className="kicker">{breakLabel(item)} · {item.type}</div>
            <h2 id="break-title" className="ref">{item.referenceId}</h2>
            <p className="muted">{item.bankName} · {item.accountName}</p>
          </div>
          <button className="btn line" onClick={onClose}>Close</button>
        </div>

        <p style={{ marginTop: 12 }}>{item.description}</p>
        <p className="muted">{item.counterparty}</p>
        {item.timingDifference ? <p>{lagSentence(item.lagDays)}</p> : null}
        {gap ? <p>{gap}</p> : null}
        {item.pastCutoff ? <p className="tag bad">Open past the cutoff · {ageLabel(item.ageDays)}</p> : null}

        <div className="sides">
          <Side title="Ledger" rows={ledgerRows} empty="Not on the ledger." />
          <Side title="Bank file" rows={bankRows} empty="Not in the bank file." />
        </div>

        {item.exceptionId ? (
          <>
            <p>
              Status <strong>{statusLabel(item.status)}</strong>
              {item.ownerName ? ` · Owner ${item.ownerName}` : " · No owner"}
            </p>
            <p className="hint">{actor ? `${actor.name} will be recorded on the next change.` : "Choose a person in the header."}</p>

            <label className="field">
              <span>Owner</span>
              <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                <option value="">Unassigned</option>
                {data.users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Resolution reason</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What cleared this break?" />
            </label>
            <label className="field">
              <span>Note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for the audit trail" />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="actions">
              <button className="btn line" disabled={saving || !actorId} onClick={() => save({ ownerId: ownerId || null })}>
                Save owner
              </button>
              <button
                className="btn solid"
                disabled={saving || !actorId || item.status === "INVESTIGATING"}
                onClick={() => save({ status: "INVESTIGATING", ownerId: ownerId || actorId })}
              >
                Escalate
              </button>
              <button
                className="btn solid"
                disabled={saving || !actorId || reason.trim().length === 0}
                onClick={() => save({ status: "RESOLVED", resolutionReason: reason.trim(), ownerId: ownerId || actorId })}
              >
                Resolve
              </button>
              <button className="btn line" disabled={saving || !actorId || item.status === "OPEN"} onClick={() => save({ status: "OPEN" })}>
                Reopen
              </button>
              <button className="btn line" disabled={saving || !actorId || note.trim().length === 0} onClick={() => save({ note: note.trim() })}>
                Add note
              </button>
            </div>

            <h3>Notes</h3>
            {item.notes.length === 0 ? <p className="muted">No notes yet.</p> : null}
            <ul className="trail">
              {item.notes.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.authorName}.</strong> {entry.body}
                  <time className="muted" dateTime={entry.createdAt}> {formatWhen(entry.createdAt, data.timezone)}</time>
                </li>
              ))}
            </ul>
            <h3>Audit trail</h3>
            {item.events.length === 0 ? <p className="muted">Opened with the morning files. No status change yet.</p> : null}
            <ul className="trail">
              {item.events.map((event) => (
                <li key={event.id}>
                  <strong>{event.actorName}</strong> {eventSentence(event)}
                  <time className="muted" dateTime={event.createdAt}> {formatWhen(event.createdAt, data.timezone)}</time>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>This pair matches. It does not open a break.</p>
        )}
      </aside>
    </div>
  );
}

function Side({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: DeskItem["rows"];
  empty: string;
}) {
  return (
    <div className="side">
      <h3>{title}</h3>
      {rows.length === 0 ? <p>{empty}</p> : null}
      {rows.map((row, index) => (
        <p key={`${row.source}-${index}`}>
          <span className="money">{formatMoney(row.amount)}</span>
          <span className="muted"> · {formatShort(row.valueDate)}</span>
        </p>
      ))}
    </div>
  );
}

function eventSentence(event: DeskItem["events"][number]): string {
  if (event.eventType === "STATUS_CHANGED") {
    return `changed status from ${statusLabel(event.fromStatus)} to ${statusLabel(event.toStatus)}.${event.detail ? ` Reason: ${event.detail}` : ""}`;
  }
  if (event.eventType === "NOTE_ADDED") return "added a note.";
  if (event.eventType === "OWNER_CHANGED") return "changed the owner.";
  if (event.eventType === "RESOLUTION_RECORDED") return `recorded a resolution. ${event.detail ?? ""}`;
  return event.eventType;
}
