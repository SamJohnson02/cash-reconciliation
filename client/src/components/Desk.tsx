import {
  ageLabel,
  breakLabel,
  formatCutoff,
  formatLong,
  formatMoney,
  formatWhen,
  maskAccount,
  statusLabel,
  zoneLabel,
} from "../format";
import type { BreakFilter, Overview } from "../types";

export function Desk({
  data,
  onOpenItem,
  onFilter,
  onShowCash,
}: {
  data: Overview;
  onOpenItem: (id: string) => void;
  onFilter: (filter: BreakFilter) => void;
  onShowCash: () => void;
}) {
  const { counts } = data;
  const hard = counts.breaks - counts.timing;
  const openItems = data.items.filter((item) => item.status === "OPEN");
  const openPreview = openItems.slice(0, 8);
  const cutoff = `${formatCutoff(data.cutoffTime)} ${zoneLabel(data.timezone)}`;
  const maxAge = Math.max(...data.aging.map((bucket) => bucket.count), 1);

  return (
    <>
      <section className={data.checklistPassed ? "callout good" : data.cutoffPassed ? "callout bad" : "callout"}>
        <h2>
          {data.checklistPassed
            ? "The book is clear"
            : data.cutoffPassed
              ? "This book is past the cutoff"
              : `Close the book before ${cutoff}`}
        </h2>
        <p>
          {data.checklistPassed
            ? "Every break is resolved or escalated."
            : `${counts.open} breaks are still open. The cutoff was ${cutoff} on ${formatLong(data.businessDate)}.`}
        </p>
      </section>

      <div className="stats">
        <button className="stat" onClick={() => onFilter("CLEAN")}>
          <b>{counts.clean}</b>
          <span>Clean matches</span>
        </button>
        <button className="stat" onClick={() => onFilter("BREAKS")}>
          <b>{counts.breaks}</b>
          <span>Breaks, including timing</span>
        </button>
        <button className="stat" onClick={() => onFilter("PAST_CUTOFF")}>
          <b>{counts.pastCutoff}</b>
          <span>Open past cutoff</span>
        </button>
        <button className="stat" onClick={onShowCash}>
          <b>{counts.leftoverAccounts}</b>
          <span>Accounts with leftover cash</span>
        </button>
      </div>

      <div className="mix" aria-hidden="true">
        <i className="clean" style={{ width: `${(counts.clean / counts.groups) * 100}%` }} />
        <i className="timing" style={{ width: `${(counts.timing / counts.groups) * 100}%` }} />
        <i className="hard" style={{ width: `${(hard / counts.groups) * 100}%` }} />
      </div>
      <div className="legend">
        <span><i className="clean" /> {counts.clean} matched</span>
        <span><i className="timing" /> {counts.timing} timing</span>
        <span><i className="hard" /> {hard} other breaks</span>
      </div>

      <div className="accounts">
        {data.accounts.map((account) => (
          <article className="account" key={account.id}>
            <div className="kicker">{account.bankName}</div>
            <strong>{account.name}</strong>
            <div className="muted">{maskAccount(account.accountNumber)}</div>
            <div className="big-money">{formatMoney(account.endingBalance)}</div>
            <div className={account.leftover ? "tag bad" : "tag good"}>
              {account.leftover
                ? `Leftover ${formatMoney(account.surplus)}`
                : `Under target ${formatMoney(account.surplus.replace("-", ""))}`}
            </div>
          </article>
        ))}
      </div>

      <div className="split">
        <section className="panel">
          <h2>Open breaks</h2>
          {openItems.length === 0 ? <p className="muted">No open breaks.</p> : (
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Break</th>
                  <th>Status</th>
                  <th className="right">Age</th>
                </tr>
              </thead>
              <tbody>
                {openPreview.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => onOpenItem(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenItem(item.id);
                      }
                    }}
                  >
                    <td>
                      <button type="button" className="ref-button" onClick={() => onOpenItem(item.id)}>
                        {item.referenceId}
                      </button>
                      <div className="muted">{item.accountName}</div>
                    </td>
                    <td>{breakLabel(item)}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td className="right">{ageLabel(item.ageDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {openItems.length > openPreview.length ? (
            <button className="btn line" type="button" onClick={() => onFilter("BREAKS")}>
              See all {openItems.length} open breaks
            </button>
          ) : null}
        </section>

        <div className="stack">
          <section className="panel">
            <h2>Aging</h2>
            <div className="aging">
              {data.aging.map((bucket) => (
                <div className="aging-row" key={bucket.label}>
                  <span>{bucket.label}</span>
                  <div className="bar"><span style={{ width: `${(bucket.count / maxAge) * 100}%` }} /></div>
                  <b>{bucket.count}</b>
                </div>
              ))}
            </div>
            <h2>Close checklist</h2>
            <ul className="check">
              {data.checklist.map((item) => (
                <li key={item.id}>
                  <span className={item.done ? "box on" : "box"} aria-hidden="true">{item.done ? "✓" : ""}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <span className="sr-only">{item.done ? " Done." : " Not done."}</span>
                    <div className="muted">{item.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="rule">
              Wires and journals above {formatMoney(data.approvalThreshold)} need a second person.
              Imported ledger and bank rows stay read-only.
            </p>
          </section>
          <section className="panel">
            <h2>Activity</h2>
            <ul className="activity">
              {data.activity.map((entry) => (
                <li key={entry.id}>
                  {entry.summary}
                  <time dateTime={entry.createdAt}>{formatWhen(entry.createdAt, data.timezone)}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
