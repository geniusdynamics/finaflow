// ABOUTME: Displays financial statements including income statement, balance sheet, trial balance, and asset register.
// ABOUTME: Handles report generation mutations, date selection, and tab navigation for financial reporting.
import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Scale, BookOpen, Building2 } from "lucide-react";
import { formatKES } from "@/lib/utils";

import { useFinancialStatements } from "./useFinancialStatements";

interface FinancialReportsPanelProps {
  year: number;
}

export function FinancialReportsPanel({ year }: FinancialReportsPanelProps) {
  const {
    businessId,
    reportDate,
    financialTab,
    generateIncomeStatement,
    generateBalanceSheet,
    generateTrialBalance,
    generateAssetRegister,
    updateReportDate,
    setFinancialTab,
    incomeStatementData,
    balanceSheetData,
    trialBalanceData,
    assetRegisterData,
    incomeStatementMutation,
    balanceSheetMutation,
    trialBalanceMutation,
    assetRegisterMutation,
  } = useFinancialStatements();

  const handleGenerateIncome = useCallback(() => {
    generateIncomeStatement({ businessId, startDate: `${year}-01-01`, endDate: `${year}-12-31` });
  }, [businessId, year, generateIncomeStatement]);

  const handleGenerateBalance = useCallback(() => {
    generateBalanceSheet({ businessId, asOfDate: reportDate });
  }, [businessId, reportDate, generateBalanceSheet]);

  const handleGenerateTrial = useCallback(() => {
    generateTrialBalance({ businessId, asOfDate: reportDate });
  }, [businessId, reportDate, generateTrialBalance]);

  const handleGenerateAssets = useCallback(() => {
    generateAssetRegister({ businessId });
  }, [businessId, generateAssetRegister]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs for financial reports */}
      <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
        <button onClick={() => setFinancialTab("income")} className={`px-4 py-2 text-sm font-medium ${financialTab === "income" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
          <FileText className="mr-1 inline h-4 w-4" />Income
        </button>
        <button onClick={() => setFinancialTab("balance")} className={`px-4 py-2 text-sm font-medium ${financialTab === "balance" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
          <Scale className="mr-1 inline h-4 w-4" />Balance
        </button>
        <button onClick={() => setFinancialTab("trial")} className={`px-4 py-2 text-sm font-medium ${financialTab === "trial" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
          <BookOpen className="mr-1 inline h-4 w-4" />Trial
        </button>
        <button onClick={() => setFinancialTab("assets")} className={`px-4 py-2 text-sm font-medium ${financialTab === "assets" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
          <Building2 className="mr-1 inline h-4 w-4" />Assets
        </button>
      </div>

      {financialTab === "income" && (
        <div className="space-y-4 mt-6">
          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Income Statement (P&L)</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleGenerateIncome} disabled={incomeStatementMutation.isPending}>
                  {incomeStatementMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {incomeStatementData ? (
                <div className="space-y-4">
                  <div className="text-center border-b pb-2">
                    <h3 className="font-serif text-lg">Income Statement</h3>
                    <p className="text-sm text-gray-500">Year {year}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between font-medium border-b pb-1">
                      <span>Revenue</span>
                      <span className="font-mono text-green-600">{formatKES(incomeStatementData.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1 pl-4 text-sm">
                      <span>Less: Cost of Goods Sold</span>
                      <span className="font-mono text-red-600">({formatKES(incomeStatementData.totalCOGS)})</span>
                    </div>
                    <div className="flex justify-between font-semibold border-b pb-1">
                      <span>Gross Profit</span>
                      <span className="font-mono">{formatKES(incomeStatementData.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Operating Expenses</span>
                      <span className="font-mono text-red-600">({formatKES(incomeStatementData.totalExpenses)})</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 bg-[#F5EDE6] px-2 -mx-2">
                      <span>Net Income</span>
                      <span className={`font-mono ${parseFloat(incomeStatementData.netIncome) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatKES(incomeStatementData.netIncome)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate" to create Income Statement</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {financialTab === "balance" && (
        <div className="space-y-4 mt-6">
          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Balance Sheet</CardTitle>
              <div className="flex gap-2">
                <input type="date" value={reportDate} onChange={e => updateReportDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
                <Button size="sm" variant="outline" onClick={handleGenerateBalance} disabled={balanceSheetMutation.isPending}>
                  {balanceSheetMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {balanceSheetData ? (
                <div className="space-y-4">
                  <div className="text-center border-b pb-2">
                    <h3 className="font-serif text-lg">Balance Sheet</h3>
                    <p className="text-sm text-gray-500">As of {reportDate}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-green-600">ASSETS</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Current Assets</span>
                          <span className="font-mono">{formatKES(balanceSheetData.assets?.current?.reduce((s: number, i: any) => s + parseFloat(i.amount.replace(/,/g, '') || 0), 0) || "0")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fixed Assets</span>
                          <span className="font-mono">{formatKES(balanceSheetData.assets?.fixed?.reduce((s: number, i: any) => s + parseFloat(i.amount.replace(/,/g, '') || 0), 0) || "0")}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>Total Assets</span>
                          <span className="font-mono">{balanceSheetData.assets?.total || "0"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-red-600">LIABILITIES + EQUITY</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Liabilities</span>
                          <span className="font-mono">{formatKES(balanceSheetData.liabilities?.total || "0")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Equity</span>
                          <span className="font-mono">{formatKES(balanceSheetData.equity?.total || "0")}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>Total</span>
                          <span className="font-mono">{balanceSheetData.totalLiabilitiesAndEquity || "0"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {balanceSheetData.balanceCheck === false && (
                    <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
                      ⚠️ Balance sheet does not balance! Total Assets ≠ Total Liabilities + Equity
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate" to create Balance Sheet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {financialTab === "trial" && (
        <div className="space-y-4 mt-6">
          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Trial Balance</CardTitle>
              <div className="flex gap-2">
                <input type="date" value={reportDate} onChange={e => updateReportDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
                <Button size="sm" variant="outline" onClick={handleGenerateTrial} disabled={trialBalanceMutation.isPending}>
                  {trialBalanceMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {trialBalanceData ? (
                <div className="space-y-4">
                  <div className="text-center border-b pb-2">
                    <h3 className="font-serif text-lg">Trial Balance</h3>
                    <p className="text-sm text-gray-500">As of {reportDate}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Account</th>
                          <th className="text-right py-2">Debit</th>
                          <th className="text-right py-2">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceData.accounts?.map((acc: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="py-1">{acc.accountName}</td>
                            <td className="text-right font-mono">{acc.debit !== "0.00" ? formatKES(acc.debit) : ""}</td>
                            <td className="text-right font-mono">{acc.credit !== "0.00" ? formatKES(acc.credit) : ""}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold border-t-2">
                          <td className="py-2">TOTALS</td>
                          <td className="text-right font-mono">{formatKES(trialBalanceData.totalDebits)}</td>
                          <td className="text-right font-mono">{formatKES(trialBalanceData.totalCredits)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {trialBalanceData.isBalanced ? (
                    <div className="mt-2 text-center text-sm text-green-600">✓ Trial Balance is balanced</div>
                  ) : (
                    <div className="mt-2 text-center text-sm text-red-600">✗ Trial Balance does not balance!</div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate" to create Trial Balance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {financialTab === "assets" && (
        <div className="space-y-4 mt-6">
          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Fixed Asset Register</CardTitle>
              <Button size="sm" variant="outline" onClick={handleGenerateAssets} disabled={assetRegisterMutation.isPending}>
                {assetRegisterMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </CardHeader>
            <CardContent>
              {assetRegisterData ? (
                <div className="space-y-4">
                  <div className="text-center border-b pb-2">
                    <h3 className="font-serif text-lg">Fixed Asset Register</h3>
                    <p className="text-sm text-gray-500">All Fixed Assets</p>
                  </div>
                  {assetRegisterData.assets?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-[#F5EDE6]">
                            <th className="text-left py-2 px-2">Asset</th>
                            <th className="text-right py-2 px-2">Purchase Price</th>
                            <th className="text-right py-2 px-2">Accum. Deprec.</th>
                            <th className="text-right py-2 px-2">Book Value</th>
                            <th className="text-center py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetRegisterData.assets?.map((asset: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="py-2 px-2">
                                <div className="font-medium">{asset.name}</div>
                                <div className="text-xs text-gray-500">{asset.purchaseDate}</div>
                              </td>
                              <td className="text-right font-mono py-2 px-2">{asset.purchasePrice}</td>
                              <td className="text-right font-mono py-2 px-2 text-red-600">({asset.accumulatedDepreciation})</td>
                              <td className="text-right font-mono font-semibold py-2 px-2">{asset.currentBookValue}</td>
                              <td className="text-center py-2 px-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  asset.status === "active" ? "bg-green-500/10 text-green-600" :
                                  asset.status === "disposed" ? "bg-orange-500/10 text-orange-600" :
                                  "bg-gray-500/10 text-gray-600"
                                }`}>
                                  {asset.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-semibold border-t-2 bg-[#F5EDE6]">
                            <td className="py-2 px-2">TOTALS</td>
                            <td className="text-right font-mono py-2 px-2">{assetRegisterData.totals?.totalCost}</td>
                            <td className="text-right font-mono py-2 px-2">({assetRegisterData.totals?.totalAccumulatedDepreciation})</td>
                            <td className="text-right font-mono py-2 px-2">{assetRegisterData.totals?.totalBookValue}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No fixed assets found</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate" to create Asset Register</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
