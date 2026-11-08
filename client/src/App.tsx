import { useCallback, useEffect, useState } from "react";

import { Breaks } from "./components/Breaks";
import { Cash } from "./components/Cash";
import { Desk } from "./components/Desk";
import { Drawer } from "./components/Drawer";
import { formatLong, formatWhen, roleLabel } from "./format";
import type { BreakFilter, ExceptionUpdate, Overview, Page } from "./types";

export function App() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("desk");
  const [filter, setFilter] = useState<BreakFilter>("BREAKS");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/overview");
    const payload = (await response.json()) as Overview & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "The desk could not load.");
    setData(payload);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The desk could not load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!data) return;
    setActorId((current) => {
      if (current && data.users.some((user) => user.id === current)) return current;
      const saved = localStorage.getItem("northline-actor");
      if (saved && data.users.some((user) => user.id === saved)) return saved;
      return data.users[0]?.id ?? null;
    });
  }, [data]);

  function chooseActor(next: string) {
    setActorId(next);
    localStorage.setItem("northline-actor", next);
  }

  function showFilter(next: BreakFilter) {
    setFilter(next);
    setPage("breaks");
  }

  async function onUpdate(id: string, body: Omit<ExceptionUpdate, "actorId">) {
    if (!actorId) throw new Error("Choose a person before changing a break.");
    const response = await fetch(`/api/exceptions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, actorId }),
    });
    const payload = (await response.json()) as Overview & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not save that change.");
    setData(payload);
  }

  if (loading) {
    return (
      <>
        <DemoStrip />
        <div className="center-state"><h1>Opening the book…</h1></div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <DemoStrip />
        <div className="center-state">
          <h1>The desk is not up</h1>
          <p>{error ?? "Load the demo day, then start the app."}</p>
          <p className="hint">From the project folder: npm run db:up && npm run db:setup && npm run dev</p>
          <button className="btn solid" onClick={() => { setLoading(true); load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "The desk could not load.")).finally(() => setLoading(false)); }}>
            Try again
          </button>
        </div>
      </>
    );
  }

  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const breakCount = data.counts.breaks;

  return (
    <>
      <DemoStrip label={data.dataLabel} />
      <main className="shell">
        <header className="header">
          <div>
            <div className="eyebrow">{data.firmName}</div>
            <h1>{formatLong(data.businessDate)}</h1>
            <p className="as-of">As of {formatWhen(data.asOf, data.timezone)}</p>
          </div>
          <label className="who">
            <span>Working as</span>
            <select value={actorId ?? ""} onChange={(event) => chooseActor(event.target.value)} aria-label="Working as">
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {roleLabel(user.role)}
                </option>
              ))}
            </select>
            <span className="hint">This demo records whoever you select. It does not ask for a password.</span>
          </label>
        </header>

        <nav className="nav" aria-label="Desk sections">
          <button aria-current={page === "desk" ? "page" : undefined} onClick={() => setPage("desk")}>Desk</button>
          <button aria-current={page === "cash" ? "page" : undefined} onClick={() => setPage("cash")}>Cash</button>
          <button aria-current={page === "breaks" ? "page" : undefined} onClick={() => setPage("breaks")}>Breaks ({breakCount})</button>
        </nav>

        {page === "desk" ? <Desk data={data} onOpenItem={setSelectedId} onFilter={showFilter} onShowCash={() => setPage("cash")} /> : null}
        {page === "cash" ? <Cash data={data} /> : null}
        {page === "breaks" ? <Breaks data={data} filter={filter} onFilter={setFilter} onOpenItem={setSelectedId} /> : null}
      </main>
      {selected ? (
        <Drawer item={selected} data={data} actorId={actorId} onClose={() => setSelectedId(null)} onUpdate={onUpdate} />
      ) : null}
    </>
  );
}

function DemoStrip({ label }: { label?: string }) {
  return (
    <div className="demo-strip">
      {label ?? "Synthetic demonstration data. These are not real customers, accounts, or transactions."}
    </div>
  );
}
