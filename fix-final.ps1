# ABOUTME: Final cleanup script - fixes remaining lint issues across all files.
# ABOUTME: 1. Removes unused eslint-disable directives
# ABOUTME: 2. Converts JS // eslint-disable to {/* */} in JSX files
# ABOUTME: 3. Fixes unused vars in JSX files

# Fix Accounts.tsx - remove callback prev
$p = "d:\DevCenter\abuilds\fina\finaflow\src\pages\Accounts.tsx"
$c = Get-Content $p -Raw
$c = $c -replace 'setSection\(\(\) => sp\)', 'setSection(sp)'
$c = $c -replace 'setTab\(\(\) => "payment-methods"\)', 'setTab("payment-methods")'
Set-Content -Path $p -Value $c -NoNewline

# Fix wallet-management-router
$p = "d:\DevCenter\abuilds\fina\finaflow\api\wallet-management-router.ts"
$c = Get-Content $p -Raw
$c = $c -replace '\.query\(async \(\) => \{', '.query(async (_input, _ctx) => {'
Set-Content -Path $p -Value $c -NoNewline

# Fix AuthLayout.tsx - remove unused disable
$p = "d:\DevCenter\abuilds\fina\finaflow\src\components\AuthLayout.tsx"
$c = Get-Content $p -Raw
$c = $c -replace '(?m)^\s*// eslint-disable-next-line react-hooks/set-state-in-effect\s*\n', ''
Set-Content -Path $p -Value $c -NoNewline

# Fix ErrorBoundary.tsx - remove unused disable
$p = "d:\DevCenter\abuilds\fina\finaflow\src\components\ErrorBoundary.tsx"
$c = Get-Content $p -Raw
$c = $c -replace '(?m)^// eslint-disable-next-line react-refresh/only-export-components\s*\n', ''
Set-Content -Path $p -Value $c -NoNewline

# Fix trpc.tsx - remove unused disable
$p = "d:\DevCenter\abuilds\fina\finaflow\src\providers\trpc.tsx"
$c = Get-Content $p -Raw
$c = $c -replace '(?m)^// eslint-disable react-refresh/only-export-components\s*\n', ''
Set-Content -Path $p -Value $c -NoNewline

# Fix ErrorBoundary.tsx - remove file-level disable too
$p = "d:\DevCenter\abuilds\fina\finaflow\src\components\ErrorBoundary.tsx"
$c = Get-Content $p -Raw
$c = $c -replace '(?m)^// eslint-disable react-refresh/only-export-components\s*\n', ''
Set-Content -Path $p -Value $c -NoNewline

# Fix Bills.tsx - remove unused disables
$p = "d:\DevCenter\abuilds\fina\finaflow\src\pages\Bills.tsx"
$c = Get-Content $p -Raw
$c = $c -replace '(?m)^\s*// eslint-disable-next-line react-hooks/set-state-in-effect\s*\n', ''
Set-Content -Path $p -Value $c -NoNewline

# Fix Expenses.tsx - remove unused disables
$p = "d:\DevCenter\abuilds\fina\finaflow\src\pages\Expenses.tsx"
$c = Get-Content $p -Raw
$c = $c -replace '(?m)^\s*// eslint-disable-next-line react-hooks/set-state-in-effect\s*\n', ''
Set-Content -Path $p -Value $c -NoNewline

# Now fix JSX //-style disable comments that should be {/* */} - iterate through all JSX files
$jsxFiles = @(
  "src/pages/Wallet.tsx",
  "src/pages/WalletAdmin.tsx",
  "src/pages/Settings.tsx",
  "src/pages/Suppliers.tsx",
  "src/pages/Users.tsx",
  "src/pages/DailySales.tsx",
  "src/pages/JournalEntries.tsx",
  "src/pages/PartnerDashboard.tsx",
  "src/pages/Payroll.tsx",
  "src/pages/Expenses.tsx"
)
foreach ($f in $jsxFiles) {
  $p = Join-Path "d:\DevCenter\abuilds\fina\finaflow" $f
  if (-not (Test-Path $p)) { continue }
  $c = Get-Content $p -Raw
  $c = $c -replace '(?m)^( *)\/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\s*\n', '${1}{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}'
  Set-Content -Path $p -Value $c -NoNewline
}

Write-Host "Done!"
