# ABOUTME: Removes simple unused imports/variables from specific files.
# ABOUTME: Targets files where the entire import line is unused.
$fixes = @(
  @{ File = "api/lib/__tests__/currency-converter.test.ts"; Old = "import { describe, expect, it, vi } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "api/lib/__tests__/currency-lock.test.ts"; Old = "import { describe, expect, it, d } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "api/lib/__tests__/decimal.test.ts"; Old = "import { describe, expect, it, Decimal } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "api/lib/__tests__/provider-registry.test.ts"; Old = "import { describe, expect, it, ParsedWalletSms } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "api/lib/__tests__/tax.test.ts"; Old = "import { describe, expect, it, PAYE_BANDS, PERSONAL_RELIEF } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "api/lib/__tests__/transaction-logger.test.ts"; Old = "import { describe, expect, it, getWalletStats } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "api/lib/__tests__/webhook-handler.test.ts"; Old = "import { describe, expect, it, vi } from `"vitest`";"; New = "import { describe, expect, it } from `"vitest`";" },
  @{ File = "scripts/create-demo-user.ts"; Old = "import { hashPassword } from `"../api/lib/password`";"; New = "" }
)

$count = 0
foreach ($fix in $fixes) {
  $path = Join-Path "d:\DevCenter\abuilds\fina\finaflow" $fix.File
  if (-not (Test-Path $path)) { Write-Host "NOT FOUND: $($fix.File)"; continue }
  $content = Get-Content $path -Raw
  $original = $content
  $content = $content.Replace($fix.Old, $fix.New)
  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    $count++
    Write-Host "Fixed: $($fix.File)"
  }
}
Write-Host "`nFixed $count files"
