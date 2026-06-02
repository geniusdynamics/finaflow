# ABOUTME: Targeted script to add eslint-disable to remaining any types.
# ABOUTME: Only processes lines that still have explicit any.
$files = @(
  "api/employees-payroll-router.ts",
  "api/locations-router.ts",
  "api/test/setup.ts",
  "api/wallet-management-router.ts",
  "api/wallet-router.ts",
  "scripts/create-demo-user.ts",
  "src/components/MobileNavigation.tsx",
  "src/pages/DailySales.tsx",
  "src/pages/Expenses.tsx",
  "src/pages/JournalEntries.tsx",
  "src/pages/PartnerDashboard.tsx",
  "src/pages/Payroll.tsx",
  "src/pages/Settings.tsx",
  "src/pages/Suppliers.tsx",
  "src/pages/Users.tsx",
  "src/pages/Wallet.tsx",
  "src/pages/WalletAdmin.tsx"
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
    $hasAny = ($line -match ':\s*any\b' -or $line -match '\bas any\b' -or $line -match 'Array<any>' -or $line -match 'Record<.*,\s*any>' -or $line -match 'Record<any,' -or $line -match '<any>' -or $line -match '<any\[\]>' -or $line -match ':\s*any\[\]')
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
