// ABOUTME: Renders the stored statement analysis: summary, balance, categories, fees, contacts and anomalies.
// ABOUTME: Pure presentation; all numbers come from the frozen StatementAnalysis snapshot.

import type { StatementAnalysis } from "@shared/statements/analyze";
import { formatKES } from "@/lib/utils";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Scale, Wallet } from "lucide-react";

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "in" | "out" | "warn" }) {
  const color = tone === "in" ? "text-[#2E7D32]" : tone === "out" ? "text-[#D32F2F]" : tone === "warn" ? "text-[#8D6E00]" : "text-[#2D2A26]";
  return (
    <div className="rounded-lg border border-[#E8E0D8] bg-white p-3">
      <p className="text-xs uppercase tracking-wider text-[#8D8A87]">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</p>
      {hint && <p className="text-xs text-[#8D8A87]">{hint}</p>}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ name: string; value: string; share: number; hint?: string }> }) {
  const max = Math.max(...rows.map((row) => row.share), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-[#2D2A26]">{row.name}</span>
            <span className="ml-2 shrink-0 font-mono text-[#2D2A26]">{formatKES(row.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F5EDE6]">
            <div className="h-full rounded-full bg-[#C73E1D]" style={{ width: `${Math.max(2, (row.share / max) * 100)}%` }} />
          </div>
          {row.hint && <p className="mt-0.5 text-[11px] text-[#8D8A87]">{row.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function StatementAnalysisPanel({ analysis }: { analysis: StatementAnalysis }) {
  const { summary, balance, fees, reconciliation } = analysis;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Money In" value={formatKES(summary.totalIn)} hint={`${analysis.moneyIn.count} operating`} tone="in" />
        <Tile label="Money Out" value={formatKES(summary.totalOut)} hint={`${analysis.moneyOut.count} operating`} tone="out" />
        <Tile label="Fees" value={formatKES(summary.totalFees)} hint={`${fees.count} charge rows`} tone="warn" />
        <Tile label="Net Flow" value={formatKES(summary.net)} hint={`${summary.rowCount} transactions`} />
      </div>

      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          reconciliation.matches ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"
        }`}
      >
        {reconciliation.matches ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <span>
          {reconciliation.matches
            ? "Statement summary reconciled to the cent."
            : `Statement summary differs — in by ${formatKES(reconciliation.diffIn ?? "0")}, out by ${formatKES(reconciliation.diffOut ?? "0")}.`}
        </span>
        {reconciliation.duplicateCount > 0 && (
          <span className="text-xs">· {reconciliation.duplicateCount} rows already existed</span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[#E8E0D8] bg-white p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[#2D2A26]">
            <Scale className="h-4 w-4 text-[#D4A854]" /> Balance continuity
          </h4>
          <p className="text-sm text-[#2D2A26]">
            {balance.continuity.ok.toLocaleString()} steps reconcile · {balance.continuity.explained.toLocaleString()} bundle legs ·{" "}
            <span className={balance.continuity.unexplained > 0 ? "text-[#8D6E00]" : "text-[#2E7D32]"}>
              {balance.continuity.unexplained} to review
            </span>
          </p>
          <p className="mt-1 text-xs text-[#8D8A87]">
            Opening {balance.opening ? formatKES(balance.opening) : "?"} → closing {balance.closing ? formatKES(balance.closing) : "?"}.
            Highest {balance.highest ? formatKES(balance.highest) : "?"}, lowest {balance.lowest ? formatKES(balance.lowest) : "?"}.
          </p>
          {balance.continuity.samples.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[#8D6E00]">
              {balance.continuity.samples.slice(0, 3).map((sample) => (
                <li key={`${sample.currentExternalId}-${sample.nextExternalId}`}>
                  {sample.currentExternalId}: {formatKES(sample.gap)} gap — {sample.reason.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-[#E8E0D8] bg-white p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[#2D2A26]">
            <Wallet className="h-4 w-4 text-[#C73E1D]" /> Fees
          </h4>
          <p className="text-sm text-[#2D2A26]">
            {formatKES(fees.total)} · {fees.percentOfOut.toFixed(2)}% of operating spend
          </p>
          <div className="mt-2 space-y-1">
            {fees.byType.slice(0, 5).map((row) => (
              <div key={row.type} className="flex items-center justify-between text-xs">
                <span className="text-[#8D8A87]">{row.type}</span>
                <span className="font-mono text-[#2D2A26]">{formatKES(row.total)} ({row.count})</span>
              </div>
            ))}
            {fees.byType.length === 0 && <p className="text-xs text-[#8D8A87]">No charge rows in this statement.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {analysis.moneyIn.byChannel && analysis.moneyIn.byChannel.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Money in by source</h4>
              <BarList
                rows={analysis.moneyIn.byChannel.map((row) => ({
                  name: row.label,
                  value: row.total,
                  share: row.share,
                  hint: `${row.count} transactions · ${row.share.toFixed(1)}% of inflow`,
                }))}
              />
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Spending by category</h4>
            {analysis.categories.length > 0 ? (
              <BarList
                rows={analysis.categories.slice(0, 10).map((row) => ({
                  name: row.name,
                  value: row.totalOut,
                  share: row.shareOfOut,
                  hint: `${row.count} transactions · ${row.shareOfOut.toFixed(1)}% of spend`,
                }))}
              />
            ) : (
              <p className="text-sm text-[#8D8A87]">No categorised rows.</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Top contacts</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-[#8D8A87]">
                <ArrowDownRight className="h-3.5 w-3.5 text-[#D32F2F]" /> Sent
              </p>
              <div className="space-y-1">
                {analysis.topContacts.sent.slice(0, 6).map((row) => (
                  <div key={`sent-${row.name}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-[#2D2A26]">{row.name}</span>
                    <span className="shrink-0 font-mono text-[#8D8A87]">{formatKES(row.total)}</span>
                  </div>
                ))}
                {analysis.topContacts.sent.length === 0 && <p className="text-xs text-[#8D8A87]">None</p>}
              </div>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-[#8D8A87]">
                <ArrowUpRight className="h-3.5 w-3.5 text-[#2E7D32]" /> Received
              </p>
              <div className="space-y-1">
                {analysis.topContacts.received.slice(0, 6).map((row) => (
                  <div key={`recv-${row.name}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-[#2D2A26]">{row.name}</span>
                    <span className="shrink-0 font-mono text-[#8D8A87]">{formatKES(row.total)}</span>
                  </div>
                ))}
                {analysis.topContacts.received.length === 0 && <p className="text-xs text-[#8D8A87]">None</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Monthly breakdown</h4>
        <div className="overflow-x-auto rounded-lg border border-[#E8E0D8] bg-white">
          <table className="w-full text-xs">
            <thead className="bg-[#F5EDE6] text-left text-[#8D8A87]">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {analysis.breakdown.monthly.slice(-12).map((row) => (
                <tr key={row.key} className="border-t border-[#E8E0D8]">
                  <td className="px-3 py-1.5 text-[#2D2A26]">{row.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[#2E7D32]">{formatKES(row.totalIn)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[#D32F2F]">{formatKES(row.totalOut)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[#2D2A26]">{formatKES(row.net)}</td>
                  <td className="px-3 py-1.5 text-right text-[#8D8A87]">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Recurring payments</h4>
          {analysis.recurring.length > 0 ? (
            <div className="space-y-1">
              {analysis.recurring.slice(0, 8).map((row) => (
                <div key={`${row.description}-${row.medianIntervalDays}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[#2D2A26]">{row.description}</span>
                  <span className="shrink-0 text-[#8D8A87]">
                    {row.frequency} · {row.occurrences}× · {formatKES(row.averageAmount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#8D8A87]">No repeating pattern found.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Anomalies</h4>
          <ul className="space-y-1 text-xs text-[#2D2A26]">
            <li>Uncategorised spend: {analysis.anomalies.uncategorisedSpend.count} rows · {formatKES(analysis.anomalies.uncategorisedSpend.total)}</li>
            <li>Large transactions: {analysis.anomalies.large.length}</li>
            <li>Out of hours: {analysis.anomalies.outOfHours.length}</li>
            <li>Duplicate candidates: {analysis.anomalies.duplicates.length}</li>
            <li>Balance samples to review: {analysis.anomalies.balanceBreaks.length}</li>
            {analysis.reversals.length > 0 && <li>Reversals: {analysis.reversals.length}</li>}
          </ul>
        </div>
      </div>

      {analysis.payBillsTills.shortcodes.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Pay bills &amp; tills</h4>
          <div className="space-y-1">
            {analysis.payBillsTills.shortcodes.slice(0, 8).map((row) => (
              <div key={`${row.type}-${row.number}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-[#2D2A26]">
                  {row.name ?? "Unknown"} <span className="text-[#8D8A87]">({row.type} {row.number ?? "?"})</span>
                </span>
                <span className="shrink-0 font-mono text-[#8D8A87]">{formatKES(row.total)} · {row.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
