import { formatMoney, formatShort, maskAccount } from "../format";
import type { Overview } from "../types";

export function Cash({ data }: { data: Overview }) {
  return (
    <>
      <section className="callout">
        <h2>Where the cash sits</h2>
        <p>
          Ending balance is the opening balance plus every ledger row. A duplicate ledger entry counts twice,
          because both rows are on the books. The next three business days add scheduled items only.
        </p>
      </section>
      <div className="cash-grid">
        {data.accounts.map((account) => (
          <article className="cash-card" key={account.id}>
            <div className="kicker">{account.bankName} · {maskAccount(account.accountNumber)}</div>
            <h2>{account.name}</h2>
            <div className={account.leftover ? "tag bad" : "tag good"}>
              {account.leftover ? "Leftover cash" : "At or under target"}
            </div>
            <div className="lines">
              <div><span>Opening</span><span className="money">{formatMoney(account.openingBalance)}</span></div>
              <div><span>Today's ledger</span><span className="money">{formatMoney(account.netActivity)}</span></div>
              <div><span>Ending</span><span className="money">{formatMoney(account.endingBalance)}</span></div>
              <div><span>Target</span><span className="money">{formatMoney(account.targetBalance)}</span></div>
            </div>
            <div className="forecast">
              <h3>Forecast · day flow and projected balance</h3>
              {account.forecast.map((day) => (
                <div key={day.date}>
                  <span>{formatShort(day.date)} · {formatMoney(day.scheduledNet)}</span>
                  <span className="money">{formatMoney(day.balance)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
