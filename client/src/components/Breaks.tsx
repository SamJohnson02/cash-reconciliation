import { useMemo, useState } from "react";

import { ageLabel, breakLabel, formatMoney, statusLabel } from "../format";
import type { BreakFilter, DeskItem, Overview } from "../types";

const FILTERS: { id: BreakFilter; label: string }[] = [
  { id: "BREAKS", label: "All breaks" },
  { id: "TIMING", label: "Timing" },
  { id: "AMOUNT_BREAK", label: "Amount" },
  { id: "MISSING_IN_BANK", label: "Missing in bank" },
  { id: "MISSING_IN_LEDGER", label: "Missing in ledger" },
  { id: "DUPLICATE", label: "Duplicate" },
  { id: "PAST_CUTOFF", label: "Past cutoff" },
  { id: "CLEAN", label: "Clean matches" },
];

export function Breaks({
  data,
  filter,
  onFilter,
  onOpenItem,
}: {
  data: Overview;
  filter: BreakFilter;
  onFilter: (filter: BreakFilter) => void;
  onOpenItem: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.items.filter((item) => matchesFilter(item, filter) && matchesQuery(item, needle));
  }, [data.items, filter, query]);

  return (
    <>
      <div className="filters">
        {FILTERS.map((item) => (
          <button key={item.id} aria-pressed={filter === item.id} onClick={() => onFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <input
        className="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search reference, account, or counterparty"
        aria-label="Search breaks"
      />
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Account</th>
              <th>Break</th>
              <th className="right">Ledger</th>
              <th className="right">Bank</th>
              <th>Status</th>
              <th className="right">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
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
                </td>
                <td>{item.accountName}</td>
                <td>{breakLabel(item)}</td>
                <td className="right money">{formatMoney(item.amountLedger)}</td>
                <td className="right money">{formatMoney(item.amountBank)}</td>
                <td>{item.pastCutoff ? "Open · past cutoff" : statusLabel(item.status)}</td>
                <td className="right">{ageLabel(item.ageDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted">Nothing in this filter.</p> : null}
      </section>
    </>
  );
}

function matchesFilter(item: DeskItem, filter: BreakFilter): boolean {
  switch (filter) {
    case "BREAKS":
      return item.exceptionId != null;
    case "TIMING":
      return item.timingDifference;
    case "CLEAN":
      return item.classification === "MATCHED" && !item.timingDifference;
    case "PAST_CUTOFF":
      return item.pastCutoff;
    default:
      return item.classification === filter;
  }
}

function matchesQuery(item: DeskItem, needle: string): boolean {
  if (!needle) return true;
  return [item.referenceId, item.accountName, item.bankName, item.counterparty, item.description]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
