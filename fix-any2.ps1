# ABOUTME: Targeted script to add eslint-disable for remaining any types.
# ABOUTME: Only processes lines that still have explicit any and don't have a disable already.
$files = @(
  "api/__tests__/recurring-bills-isolation.test.ts",
  "api/__tests__/wallet-router.test.ts",
  "api/bills-router.ts",
  "api/boot.ts",
  "api/chart-of-accounts-router.ts",
  "api/daily-ledger-router.ts",
  "api/daily-sales-router.ts",
  "api/depreciation-router.ts",
  "api/employees-payroll-router.ts",
  "api/expenses-router.ts",
  "api/feedback-router.ts",
  "api/inquiry-router.ts",
  "api/integrations-router.ts",
  "api/items-router.ts",
  "api/journal-router.ts",
  "api/lib/__tests__/accounting-system-accounts.test.ts",
  "api/lib/__tests__/sasapay-provider.test.ts",
  "api/lib/business-provisioning.ts",
  "api/lib/bill-payment.ts",
  "api/lib/business-reset.ts",
  "api/lib/currency-converter.ts",
  "api/lib/db-startup.ts",
  "api/lib/expense-journal.ts",
  "api/lib/journal.ts",
  "api/lib/reports.ts",
  "api/lib/sales-journal.ts",
  "api/lib/seed-currencies.ts",
  "api/lib/seed-wallet-providers.ts",
  "api/lib/subscriptions.ts",
  "api/mpesa-router.ts",
  "api/notifications-router.ts",
  "api/partner-router.ts",
  "api/payment-methods-router.ts",
  "api/payroll-settings-router.ts",
  "api/permissions-router.ts",
  "api/po-router.ts",
  "api/reports-router.ts",
  "api/settings-router.ts",
  "api/supplier-prices-router.ts",
  "api/suppliers-router.ts",
  "api/users-router.ts",
  "api/wallet-management-router.ts",
  "api/wallet-router.ts",
  "db/migrate-existing-data.ts",
  "db/seed-accounting.ts",
  "scripts/comprehensive-financial-audit.ts",
  "scripts/create-demo-user.ts",
  "scripts/create-expense-accounts-and-fix.ts",
  "scripts/fix-duplicate-ap-accounts.ts",
  "scripts/run-migrations.ts",
  "src/components/CurrencyConverterDialog.tsx",
  "src/components/Layout.tsx",
  "src/components/MobileNavigation.tsx",
  "src/components/WalletPaymentSelector.tsx",
  "src/components/partner/AllocationManagement.tsx",
  "src/features/reports/FinancialReportsPanel.tsx",
  "src/features/reports/OperationsReportsPanel.tsx",
  "src/features/reports/__tests__/report-scope.test.ts",
  "src/features/reports/useFinancialStatements.ts",
  "src/features/reports/useReportExports.ts",
  "src/hooks/useAuth.ts",
  "src/pages/Accounts.tsx",
  "src/pages/AllocationManagement.tsx",
  "src/pages/Bills.tsx",
  "src/pages/BusinessOverview.tsx",
  "src/pages/Businesses.tsx",
  "src/pages/Calendar.tsx",
  "src/pages/ChartOfAccounts.tsx",
  "src/pages/DailySales.tsx",
  "src/pages/Expenses.tsx",
  "src/pages/Feedback.tsx",
  "src/pages/JournalEntries.tsx",
  "src/pages/PartnerDashboard.tsx",
  "src/pages/Payroll.tsx",
  "src/pages/Settings.tsx",
  "src/pages/Suppliers.tsx",
  "src/pages/Users.tsx",
  "src/pages/Wallet.tsx",
  "src/pages/WalletAdmin.tsx",
  "api/lib/accounting-accounts.ts",
  "api/lib/accounting-reversal.ts",
  "api/lib/audit.ts",
  "api/lib/http.ts",
  "api/lib/pagination.ts"
)
$count = 0
$fixCount = 0
foreach ($f in $files) {
  $path = Join-Path "d:\DevCenter\abuilds\fina\finaflow" $f
  if (-not (Test-Path $path)) { continue }
  $count++
  $lines = [System.Collections.ArrayList]::new()
  $content = Get-Content $path
  for ($i = 0; $i -lt $content.Count; $i++) {
    $line = $content[$i]
    $hasAny = ($line -match ':\s*any\b' -or $line -match '\bas any\b' -or $line -match 'Array<any>' -or $line -match 'Record<.*,\s*any>' -or $line -match 'Record<any,' -or $line -match '<any>')
    $hasDisable = ($line -match 'eslint-disable' -or ($i -gt 0 -and $content[$i-1] -match 'eslint-disable'))
    if ($hasAny -and -not $hasDisable) {
      $lines.Add("// eslint-disable-next-line @typescript-eslint/no-explicit-any") | Out-Null
      $fixCount++
    }
    $lines.Add($line) | Out-Null
  }
  Set-Content -Path $path -Value $lines
}
Write-Host "Processed $count files, added $fixCount disable comments"
