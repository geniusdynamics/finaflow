// ABOUTME: Detailed cross-file bank statement analysis for the public converter.
// ABOUTME: Shows every contact, category and month rather than truncating to a dashboard-sized preview.

import type { ConsolidatedAnalysis } from "@shared/statements/consolidate";
import { formatKES } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[#E8E0D8] bg-white p-3">
      <p className="text-xs uppercase tracking-wider text-[#8D8A87]">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">{value}</p>
      {hint && <p className="text-xs text-[#8D8A87]">{hint}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E8E0D8] bg-white p-4">
      <div className="mb-3">
        <h3 className="font-serif text-base font-semibold text-[#2D2A26]">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-[#8D8A87]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-[#E8E0D8]">
      <table className="w-full min-w-[560px] text-xs">{children}</table>
    </div>
  );
}

function Head({ columns }: { columns: Array<[string, boolean?]> }) {
  return (
    <thead className="sticky top-0 bg-[#F5EDE6] text-left text-[#8D8A87]">
      <tr>
        {columns.map(([label, right]) => (
          <th key={label} className={`px-3 py-2 font-medium ${right ? "text-right" : ""}`}>{label}</th>
        ))}
      </tr>
    </thead>
  );
}

export function ConsolidatedAnalysisPanel({ consolidated }: { consolidated: ConsolidatedAnalysis }) {
  const { analysis, files } = consolidated;
  const balanceGaps = files.reduce((sum, file) => sum + file.balance.continuity.unexplained, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Statements" value={consolidated.fileCount.toLocaleString()} hint={`${consolidated.totalRowCount.toLocaleString()} uploaded rows`} />
        <Tile label="Transactions" value={analysis.summary.rowCount.toLocaleString()} hint={`${consolidated.duplicateRows.toLocaleString()} cross-file duplicates skipped`} />
        <Tile label="Money In" value={formatKES(analysis.summary.totalIn)} hint={`${analysis.moneyIn.count.toLocaleString()} operating inflows`} />
        <Tile label="Money Out" value={formatKES(analysis.summary.totalOut)} hint={`${analysis.moneyOut.count.toLocaleString()} operating outflows`} />
        <Tile label="Fees" value={formatKES(analysis.summary.totalFees)} hint={`${analysis.fees.count.toLocaleString()} charge rows`} />
        <Tile label="Net Flow" value={formatKES(analysis.summary.net)} hint={`Avg ${formatKES(analysis.summary.avgDailyIn)} in / day`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F5EDE6] px-3 py-2 text-xs text-[#5C5853]">
        <span>{consolidated.periodStart ?? "?"} → {consolidated.periodEnd ?? "?"}</span>
        <span>·</span>
        <span>{consolidated.banks.join(", ") || "Multiple banks"}</span>
        <span>·</span>
        <span>{analysis.summary.avgTransactionsPerDay.toLocaleString()} transactions/day</span>
        <span>·</span>
        <span>Most active: {analysis.summary.mostActiveDay ? `${analysis.summary.mostActiveDay.date} (${analysis.summary.mostActiveDay.count})` : "—"}</span>
      </div>

      <Section title="Statement coverage" hint="Each uploaded file stays visible, including its own reconciliation and balance gaps.">
        <Table>
          <Head columns={[["File"], ["Bank"], ["Account"], ["Period"], ["Rows", true], ["In", true], ["Out", true], ["Fees", true], ["Net", true], ["Reconciled"], ["Gaps", true]]} />
          <tbody>
            {files.map((file) => (
              <tr key={file.fileName} className="border-t border-[#E8E0D8]">
                <td className="px-3 py-2 font-medium text-[#2D2A26]">{file.fileName}</td>
                <td className="px-3 py-2">{file.bankName ?? "—"}</td>
                <td className="px-3 py-2">{[file.accountNumber, file.accountName].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">{file.periodStart ?? "?"} → {file.periodEnd ?? "?"}</td>
                <td className="px-3 py-2 text-right font-mono">{file.rowCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono">{formatKES(file.totalIn)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatKES(file.totalOut)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatKES(file.totalFees)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatKES(file.net)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 ${file.reconciliation.matches ? "text-[#2E7D32]" : "text-[#8D6E00]"}`}>
                    {file.reconciliation.matches ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {file.reconciliation.matches ? "Yes" : "Review"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{file.balance.continuity.unexplained.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Monthly breakdown" hint="Aggregated by calendar month across every uploaded statement, including different months and years.">
        <Table>
          <Head columns={[["Month"], ["Transactions", true], ["In", true], ["Out", true], ["Net", true]]} />
          <tbody>
            {analysis.breakdown.monthly.map((row) => (
              <tr key={row.key} className="border-t border-[#E8E0D8]">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono text-[#2E7D32]">{formatKES(row.totalIn)}</td>
                <td className="px-3 py-2 text-right font-mono text-[#D32F2F]">{formatKES(row.totalOut)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatKES(row.net)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Money in by source" hint="Every counterparty, not truncated to a dashboard preview.">
          <Table>
            <Head columns={[["Source"], ["Transactions", true], ["Total", true], ["Average", true]]} />
            <tbody>
              {analysis.moneyIn.bySource.map((row) => (
                <tr key={row.name} className="border-t border-[#E8E0D8]">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.total)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.average)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title="Money out by destination" hint="Every counterparty, not truncated to a dashboard preview.">
          <Table>
            <Head columns={[["Destination"], ["Transactions", true], ["Total", true], ["Average", true]]} />
            <tbody>
              {analysis.moneyOut.byDestination.map((row) => (
                <tr key={row.name} className="border-t border-[#E8E0D8]">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.total)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.average)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Income channels" hint="Agent deposits, transfers, cheques and other inflows combined across files.">
          <Table>
            <Head columns={[["Channel"], ["Transactions", true], ["Amount", true], ["Share", true]]} />
            <tbody>
              {(analysis.moneyIn.byChannel ?? []).map((row) => (
                <tr key={row.key} className="border-t border-[#E8E0D8]">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.total)}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title="Spending by category" hint="Every category with a total, including categories that appear in only one statement.">
          <Table>
            <Head columns={[["Category"], ["Transactions", true], ["In", true], ["Out", true], ["Share", true]]} />
            <tbody>
              {analysis.categories.map((row) => (
                <tr key={`${row.categoryId ?? "none"}-${row.name}`} className="border-t border-[#E8E0D8]">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.totalIn)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.totalOut)}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.shareOfOut.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Fees and charges" hint="Fee types and recipients across all statements.">
          <div className="space-y-3">
            <Table>
              <Head columns={[["Fee type"], ["Count", true], ["Total", true]]} />
              <tbody>
                {analysis.fees.byType.map((row) => (
                  <tr key={row.type} className="border-t border-[#E8E0D8]">
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatKES(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {analysis.fees.topRecipients.length > 0 && (
              <Table>
                <Head columns={[["Fee recipient"], ["Count", true], ["Total", true]]} />
                <tbody>
                  {analysis.fees.topRecipients.map((row) => (
                    <tr key={row.name} className="border-t border-[#E8E0D8]">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatKES(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Section>

        <Section title="Recurring payments" hint="Patterns found across all uploaded periods.">
          {analysis.recurring.length > 0 ? (
            <Table>
              <Head columns={[["Description"], ["Type"], ["Frequency"], ["Count", true], ["Average", true], ["Total", true], ["Last date"]]} />
              <tbody>
                {analysis.recurring.map((row) => (
                  <tr key={`${row.description}-${row.medianIntervalDays}`} className="border-t border-[#E8E0D8]">
                    <td className="px-3 py-2">{row.description}</td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2">{row.frequency}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.occurrences.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatKES(row.averageAmount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatKES(row.totalAmount)}</td>
                    <td className="px-3 py-2">{row.lastDate}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-[#8D8A87]">No repeating pattern found across the uploaded statements.</p>
          )}
        </Section>
      </div>

      {analysis.payBillsTills.shortcodes.length > 0 && (
        <Section title="Paybills and tills" hint="All shortcodes and account references found in the uploaded files.">
          <Table>
            <Head columns={[["Type"], ["Number"], ["Name"], ["Count", true], ["Total", true], ["Fees", true], ["Account"]]} />
            <tbody>
              {analysis.payBillsTills.shortcodes.map((row) => (
                <tr key={`${row.type}-${row.number}-${row.accountReference ?? ""}`} className="border-t border-[#E8E0D8]">
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">{row.number ?? "—"}</td>
                  <td className="px-3 py-2">{row.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.total)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatKES(row.fees)}</td>
                  <td className="px-3 py-2">{row.accountReference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}

      <Section title="Review items" hint="Combined checks across the uploaded statements.">
        <ul className="grid gap-1 text-sm text-[#2D2A26] sm:grid-cols-2 lg:grid-cols-3">
          <li>Uncategorised spend: {analysis.anomalies.uncategorisedSpend.count.toLocaleString()} rows · {formatKES(analysis.anomalies.uncategorisedSpend.total)}</li>
          <li>Large transactions: {analysis.anomalies.large.length.toLocaleString()}</li>
          <li>Out of hours: {analysis.anomalies.outOfHours.length.toLocaleString()}</li>
          <li>Duplicate candidates: {analysis.anomalies.duplicates.length.toLocaleString()}</li>
          <li>Balance samples to review: {balanceGaps.toLocaleString()}</li>
          <li>Reversals: {analysis.reversals.length.toLocaleString()}</li>
          <li>Cross-file duplicate rows skipped: {consolidated.duplicateRows.toLocaleString()}</li>
        </ul>
      </Section>

      {analysis.reconciliation.statementIn && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${analysis.reconciliation.matches ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"}`}>
          {analysis.reconciliation.matches ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {analysis.reconciliation.matches
            ? "Combined statement summaries reconcile to the cent."
            : `Combined summaries differ — in by ${formatKES(analysis.reconciliation.diffIn ?? "0")}, out by ${formatKES(analysis.reconciliation.diffOut ?? "0")}.`}
        </div>
      )}
    </div>
  );
}
