# Statement Import & Analysis — Implementation Plan

> Scope: replace the Wallet **Import SMS** entry point with a **statement import** pipeline that
> starts with M-PESA (PDF + CSV) and is built as a provider-agnostic parser registry so banks,
> Airtel Money and Sasapay can be added without touching the wallet core. Includes analysis,
> categorisation, exports, an external API, and a later public no-storage converter.

Status: **PLAN v5 — P0–P4 implemented and verified; P5 providers remain follow-on.**

Implementation status (2026-10-17):

* **P0 complete** — shared parser core, Node extractor, validation on a real 77-page statement
  (2,371 rows; 786,098.76 in / 782,565.53 out; 5,272.74 fees).
* **P1 complete** — migration `0033`, `statement_imports`/`wallet_category_rules`, wallet category columns,
  import service, `wallet.statements.*`, Wallet Import tabs (Statement + SMS), Statements history and undo.
* **P2 complete** — full analysis engine (all 13 sheet blocks + day-of-week + anomalies + reconciliation),
  frozen analysis snapshots, Statements detail UI, pre-import include/exclude + category editing, post-import
  category editing with learned merchant rules, CSV/XLSX/JSON exports (UTF-8 BOM, sheet toggles, fee handling).
* **P3 complete** — `/api/v1/statements/{parse,analyze,import,imports,imports/:id,imports/:id/export}`,
  `statements:read/write` scopes, parse limiter, OpenAPI paths and `docs/statements.md`.
* **P4 complete** — public no-upload converter (`/tools/mpesa-statement-converter`, PDF **or CSV**), PDF→Excel
  and accountant guides, Home M-PESA tools menu, shared tool header with a visible back link, root error boundary.
  Browser-verified in Playwright against the real statement: 2,371 rows, CSV with BOM, zero console errors.
* **CSV imports** — M-PESA statement CSV exports run through the same structural parser via the RFC-4180
  `delimited.ts` adapter; the free converter accepts CSV as well as PDF.
* **Paybill layout** — the parser now captures the printed Transaction Type and Other Party columns; a real
  paybill-owner sample is still needed for sign-off.
* **Remaining** — P5 providers (Airtel/Sasapay/bank), a paybill-owner sample, and optional pre-import per-row
  include/exclude editing (the API already accepts `overrides`/`exclude`).

Spec sources: the two repositories, plus the published product spec at `mpesa2csv.com/sheets`
(13 sheets with columns/use cases) and the three guides at `mpesa2csv.com/guides/*`
(PDF→Excel, statement→CSV, accountants/batch). Those routes are client-rendered and return 404 to
fetchers, so the content was read from the site bundle; §8 and §11 reflect it.

---

## 1. What the two reference projects actually do

### 1.1 `M-PESA-Statements-Analyzer-main` (Go + HTML dashboard)

| Area | Finding |
| --- | --- |
| PDF text | Shells out to `qpdf --password --decrypt` then `pdftotext -layout`. Requires both binaries on the host. No in-process PDF handling. |
| Row parsing | `strings.Fields` on each line, assumes **exactly the last 3 tokens** are Paid In / Withdrawn / Balance. Breaks on multi-line details, merged cells, and any extra trailing column (paybill statements add Transaction Type + Other Party). |
| Categorisation | `categorize.go` is a TODO stub; the real logic lives in `summary.go`. It has a duplicate `case strings.Contains(details, "till")` (unreachable second branch), and `strings.Contains(details, "from ")` / `"to "` matches almost every row, so the output is effectively noise. |
| AI | One OpenAI chat call **per transaction** (`gpt-3.5-turbo`), with a rule fallback under 0.7 confidence. Slow, non-deterministic, costs money per row, and the rule fallback is the broken one above. |
| Useful ideas | Async job model (upload → job row → queue → worker), per-import status, summary shape (`total_income`, `total_expenses`, `net_balance_change`, `categories`). |
| Verdict | Good product framing, weak parser and categoriser. Do **not** port the parsing approach. |

### 1.2 `mpesa2csv-main` (Tauri desktop app)

| Area | Finding |
| --- | --- |
| PDF | Bundles a JRE + `tabula-1.0.5-jar-with-dependencies.jar`, runs Java as a child process, passes `--password`, reads the CSV Tabula writes. Solid table extraction, but a Java runtime is a deployment liability we should not inherit. |
| CSV handling | Genuinely good: `splitCsvRecords` respects quoted newlines, `parseCSVLine` is a correct RFC-4180 reader, `normalize()` collapses whitespace, `parseAmount()` strips currency and non-numeric characters. |
| Statement variants | Detects paybill statements by looking for `other party` / `transaction type` in the header and maps columns 8 and 9. Personal and paybill statements both supported. |
| Analysis | Published spec at `mpesa2csv.com/sheets` lists **13 sheets** with columns, use cases and insights: main transactions, money in, money out, charges & fees (charge-as-%-of-parent + fee type), reversals (with original-matching), financial summary, monthly & weekly breakdown, daily balance, amount distribution, top contacts, recurring, time of day, pay bills & tills. The app also ships a day-of-week sheet. This is the most reusable part of either project. |
| Charges | Groups charges to their parent by **shared receipt number** — important, because M-PESA statement charge rows reuse the parent receipt. |
| Export formats | CSV, XLSX, JSON, OFX/QFX/QIF, webhook POST. |
| UI | File-status machine (idle/loading/protected/processing/success/error), password prompt on `PasswordException`-style detection, batch files, preview before export. |
| Weakness | Everything is desktop-bound; no persistence, no categories, no reconciliation, no API, no multi-tenant story. |
| Verdict | Port the **analysis definitions**, the **CSV record reader**, the **charges-to-parent linking** and the **password/status UX**. Do not port Tabula/Java. |

---

## 2. What our codebase has today (honest gap analysis)

The premise “we already read M-PESA statements and categorise them” is only half true:

* ✅ `wallet.transactions.importSms` parses **SMS text** and stores rows in `mobile_wallet_transactions`
  (positive amount + `direction`, dedupe on partial unique `(provider, provider_txn_id)`).
* ✅ Providers are pluggable (`BaseWalletProvider`, `walletRegistry`) with per-provider `smsImport`.
* ✅ `expenses`, `expenseCategories`, `suppliers`, ledger and accounts all exist.
* ❌ **No statement/PDF/CSV ingestion at all.** No PDF library, no multipart route, no parser registry.
* ❌ **No auto-categorisation.** A wallet transaction has no `categoryId`. “Categorising” today means
  manually creating a full `expenses` record per transaction (`createExpenseFromTxn`), which also
  touches supplier balances. Bulk statement import cannot work that way.
* ❌ No import history, no undo, no statement-level analysis, no reconciliation against the book.
* ❌ `wallet.dailyLedger.create` treats every positive amount as inflow (`amt > 0`) although amounts are
  stored positive with a separate `direction` — so a day’s ledger counts everything as inflow.
  (Pre-existing bug; fix alongside this work with a regression test.)
* ❌ Two parallel worlds: legacy `mpesa_transactions` table + `mpesa` router (still mounted, unused by
  the UI) and `mobile_wallet_transactions` + `wallet` router. Statement import goes to the **wallet**
  side only.

So this work is genuinely new: statement extraction, parsing, categorisation and analysis.

---

## 3. Target architecture

Principle: **extraction → table → parser → canonical transactions → analysis/exports**, with every
stage a pure function except extraction and persistence. That is what makes banks cheap later.

```
PDF bytes ──► extract (pdfjs, node|browser) ──► ExtractedDocument (lines + cells with x/y)
                                                    │
CSV/XLSX ──────────────────────────────────────► table reconstruction (header + column x-boundaries)
                                                    │
                                                    ▼
                                            StatementTable {headers, rows}
                                                    │
                                    parser registry (detect + parse; mpesa first)
                                                    ▼
                                       StatementTransaction[]  (canonical)
                                        │        │          │
                               balance check   analysis   categorisation
                                        │        │          │
                                        └────────┴──────────┴──► preview / import / export / API
```

### 3.1 Where the code lives

Shared **pure** code must be importable by both the Vite app and the Hono server, so a new top-level
`shared/` workspace is introduced (with `@shared/*` alias added to `tsconfig.app.json`,
`tsconfig.server.json`, `vite.config.ts`, `vitest.config.ts`, and vitest `include`).
This mirrors the already-present but unused `contracts` include in `tsconfig.server.json` and avoids
copy-pasting the parser the way `api/mpesa-parser.ts` + `src/lib/mpesa-parser.ts` are duplicated today.

```
shared/statements/
  types.ts                     canonical types (StatementTransaction, StatementAnalysis, …)
  errors.ts                    UnsupportedStatementError, PasswordRequiredError, StatementParseError
  normalize/
    amount.ts                  "1,234.00" | "Ksh 1,234.00" | "-" | "(1,234.00)" → decimal string
    date.ts                    "2026-01-05 10:12:44" | "05/01/2026" | "05/01/26" → date + time
    text.ts                    whitespace collapse, name casing, PII masking helpers
    details.ts                 M-PESA detail grammar → txnType / direction / counterparty
  table/
    reconstruct.ts             text lines → header detection → column boundaries → rows
    delimited.ts               RFC-4180 CSV/TSV reader → StatementTable
    map-columns.ts             header aliases → canonical column map
  parsers/
    mpesa.ts                   personal (7 col) + paybill (9 col), PDF and CSV tables
    registry.ts                register / detect / parse; ordered by confidence
  analyze/
    summary.ts                 period, in/out/net, fees, averages, highest single in/out
    balance.ts                 opening/closing/high/low/avg + integrity breaks
    patterns.ts                monthly/weekly, time-of-day, day-of-week, amount distribution
    recurring.ts               cadence detection (median interval), next expected
    anomalies.ts               duplicates, outliers (p95), balance breaks, out-of-hours
    index.ts                   buildAnalysis(transactions) → StatementAnalysis
  categorize/
    taxonomy.ts                canonical keys + aliases → business category names
    rules.ts                   system rules (Kenyan merchants/utilities/charges) + user rules
    engine.ts                  resolve category + confidence per transaction
  export/
    csv.ts                     transactions / analysis CSV
    json.ts                    stable API shape
    xlsx.ts                    ExcelJS workbook (server; dynamic import in browser)
  extract/
    pdf-node.ts                pdfjs-dist legacy build, password → PasswordRequiredError
    pdf-browser.ts             pdfjs + worker URL, same output shape
  __tests__/                   unit tests (pure)
  __fixtures__/                synthetic text-item fixtures + generated sample PDF
```

Server-side service (DB, auth, validation):

```
api/lib/statements/
  service.ts                   parse → persist → list → get → undo → export (single source of truth)
  store.ts                     drizzle queries, dedupe, transaction wrapping
  import-service.ts            row → mobile_wallet_transactions mapping
  export-service.ts            DB rows → csv/xlsx/json
api/statements-router.ts       tRPC `statements` (mounted under wallet? see §6)
api/routes/v1/statements.ts    external REST API
```

UI:

```
src/components/statements/
  StatementImportDialog.tsx    wizard shell
  steps/SourceStep.tsx
  steps/PasswordStep.tsx
  steps/ReviewStep.tsx
  steps/ResultStep.tsx
  StatementAnalysisPanel.tsx   charts + tables, reused by import detail and public tool
  CategoryPicker.tsx
src/pages/wallet/Statements.tsx   import history + detail (tab inside Wallet)
src/pages/tools/MpesaStatementConverter.tsx  public, browser-only converter
```

---

## 4. Dependency decisions

| Need | Choice | Why |
| --- | --- | --- |
| PDF text | **`pdfjs-dist@5.4.624`** | In-process, no Java/Poppler, supports password via `getDocument({password})`, works in Node **and** browser. Pinned to 5.4 because CI runs Node 20 and 5.6+ requires Node ≥22.13. Verified locally: text items with x/y/width extracted correctly on Node 24. |
| Excel write/read | **`exceljs@4.4.0`** | Same lib the reference project uses for its 12 analysis sheets; can also read `xlsx` for future bank statements. |
| CSV | **no dependency** | The reference `papaparse` path is replaceable by ~80 lines of RFC-4180 code, which we need anyway to control quoted-newline handling and bank formats. |
| Browser PDF worker | Vite `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` | Standard Vite asset handling; no CDN. |
| AI | **none in this scope** | Rule engine + learned merchant rules. Deterministic, free, testable. AI assist can be added later behind the same `engine.ts` interface. |

Build note: `pdfjs-dist` will be marked external in the `esbuild api/boot.ts` step
(`--external:pdfjs-dist/*`) because `node_modules` is copied into the Docker runner image anyway;
bundling its `.mjs` + assets is fragile. Browser side is bundled by Vite normally.

---

## 5. Parsing design (the part that must be right)

### 5.1 Extraction

`extract/pdf-node.ts`:

1. Assert magic bytes `%PDF-`.
2. `getDocument({ data, password, isEvalSupported: false, useSystemFonts: true, verbosity: 0 })`.
3. Map `PasswordException` → `PasswordRequiredError` (code distinguishes “needs password” vs “wrong password”).
4. Cap pages (`maxPages = 300`) and total characters; if no text items → `NoTextLayerError` (“scanned PDF”).
5. Emit `ExtractedDocument { pages, lines: TextLine[] , charCount }`, where each `TextLine` has
   `{ page, y, cells: { text, x, width, height }[] }` sorted by x.

### 5.2 Row reconstruction (`table/reconstruct.ts`) — validated on a real 77-page statement

The sample (`MPESA_Statement_from_1st_January_2026_to_2nd_July_2026…n1.pdf`, 77 pages, 2,371 rows)
settled the layout questions. **Four assumptions in v1 of this plan were wrong:**

1. The **time is not on the row-start line.** The row starts with `receipt + date`; the time
   (`HH:MM:SS`) is the first token of the **first continuation line**, aligned under the date.
2. **Details wrap across 1–5 continuation lines** (`Merchant Payment Fuliza M-` / `Pesa Online to 915251 - Total` /
   `New Ukunda Service Station`, `Acc. …`, API conversation IDs).
3. **Column x cannot be used as a key.** Header labels are offset from the data (`Receipt No.` at x=50.9,
   data at x=39) and the balance is right-aligned (`3,480.23` at x=528.9 vs `0.00` at x=542.4). Page 1 and
   page 2 also differ by ~13pt in the balance column.
4. **The header appears once**, on page 1, after a SUMMARY block. Pages 2..N start directly with
   transactions. There is no repeated header to resync on.

Every page also ends with a footer band (`Disclaimer: …`, `guidance.`, `Statement Verification Code`,
`To verify the validity…`, `For self-help dial…`, `Page n of N`, an 8-char verification code) which sits
**above** the naïve y-cutoff (y≈82–90) while real rows reach y≈109. Boilerplate must be filtered by
content, not only by position.

Algorithm:

1. Start at `DETAILED STATEMENT` (and consume the header line if present). This skips the SUMMARY block
   and prevents the phone number being mistaken for a receipt.
2. For each line above y=60 that is not footer/boilerplate, take the x-sorted items and split each item
   into whitespace tokens (items may be one cell or a merged run).
3. **Row start**: token[0] matches a receipt (`^[A-Z0-9]{8,14}$`) **and** one of the next three tokens is a
   date. Find the last status token; the money tokens after it (last three) are paidIn, withdrawn, balance.
   Details = tokens between the date and the status.
4. **Continuation**: no receipt+date. The first time token fills `time`; the remaining tokens append to
   `details`. A continuation that carries a new row’s receipt is a new row, so page breaks and wrapped
   details are handled by the same rule.
5. Carry the last open row across page boundaries; footer lines never mutate a row.
6. Keep `page`, `rowIndex`, and `rawLines` for provenance and debugging.
7. Never infer direction from detail text — the columns are authoritative.

**Validation result on the sample:** 2,371 rows extracted, exactly matching `Total Transactions: 2,371`.
All rows have date, time, status and exactly three money tokens; exactly one of paidIn/withdrawn is
non-zero. Totals: **786,098.76 in / 782,565.53 out**, matching the statement’s own summary to the cent.
Parse time: **1.7s** for 77 pages — no background queue needed; a single request is fine.

For CSV/XLSX, `delimited.ts` produces a `StatementTable` directly and the same row parser runs on it.
The generic column-mapping UI for bank statements comes later.

### 5.3 Receipt groups and row identity (`parsers/mpesa.ts`)

Same-receipt rows are **normal, not duplicates**: of 1,302 receipt groups in the sample, 834 have more than
one row (sizes 1:468, 2:599, 3:235). They are charge+spend, spend+Fuliza overdraft, or charge+spend+overdraft.

* **Primary row** = the non-charge, non-`OverDraft` row with the largest absolute amount. It gets
  `externalId = receipt`, so an SMS-imported receipt dedupes against it.
* Remaining legs get deterministic keys `receipt#2`, `receipt#3` in a fixed order (primary first, then
  charge, then overdraft), so re-importing the same file is idempotent.
* `linkedTxnExternalId`: charge → primary; `OverDraft of Credit Party` → the Fuliza spend in the same group
  (and the spend gets `fulizaOf = overdraftExternalId`).
* A true duplicate (same receipt + date + time + amount + direction + normalised details, excluding
  charge/overdraft legs) is collapsed and reported.
* If a two-token amount row appears in another template, use the balance column position and the sign
  convention; if still ambiguous, keep the row, flag it, and do not guess direction.
* `externalId` maps to `mobile_wallet_transactions.providerTxnId`; the existing partial unique index makes
  the import idempotent.

### 5.4 Detail grammar (`normalize/details.ts`) → rail + canonical `txnType`

Derived from the 2,371 real rows, ordered most specific first:

| Real detail prefix (case-insensitive) | txnType | Direction | Category key |
| --- | --- | --- | --- |
| `OverDraft of Credit Party` | `loan_drawdown` | in | `loans_savings` (financing, not income) |
| `OD Loan Repayment to … M-PESA Overdraw` | `loan_repayment` | out | `loans_savings` |
| `Customer Transfer of Funds Charge`, `Pay Bill Charge`, `Pay Merchant Charge`, `Withdrawal Charge` | `charge` | out | `fees` |
| `Customer Transfer Fuliza M-Pesa to`, `Customer Send Money … Fuliza M-Pesa` | `transfer` | out | `transfers` (Fuliza-funded flag) |
| `Customer Transfer to`, `Customer Send Money to`, `Customer Payment to Small Business to`, `Offnet B2C Transfer` | `transfer` | out | `transfers` |
| `Merchant Payment Online to`, `Merchant Payment to`, `Merchant Payment Fuliza M-Pesa Online to` | `payment` | out | merchant rules (till) |
| `Pay Bill Online to`, `Pay Bill Fuliza M-Pesa to`, `Pay Bill to`, `Card Pay Bill Online`, `Card Pay Utility`, `Offnet C2B Transfer` | `payment` | out | merchant rules (paybill) |
| `Funds received from`, `Business Payment from`, `Salary Payment from`, `Promotion Payment from`, `Merchant Customer Payment from`, `BICS International Transfer From` | `topup` | in | `income` |
| `Deposit of Funds at Agent Till` | `bank_transfer` | in | `agent_deposit` |
| `Customer Withdrawal At Agent Till` (incl. `… with Fuliza`) | `withdrawal` | out | `cash_withdrawal` |
| `Airtime Purchase`, `Customer Bundle Purchase`, `Recharge for Customer` | `airtime` | out | `airtime` |
| `Send Money Reversal via`, `Pay Merchant Reversal From`, `Pay Utility Reversal by` | `refund` | in | `reversals` |
| unknown | `transfer` | from column | `null` — **left uncategorised** |

`WalletTxnType` gains `"charge" | "loan_drawdown" | "loan_repayment"`. “Fuliza-funded” is a flag on the
spend row (`raw.fulizaFunded = true`), not a separate type, so the spend still categorises as what it bought.

`WalletTxnType` gains `"charge"` (one-line union change in `provider-interface.ts`; no provider code change).

---

## 6. Data model

New migration `db/migrations/0033_statement_imports.sql` (idempotent, registered in
`api/test/setup.ts` and `db/migrations/meta/_journal.json`).

### 6.1 `statement_imports`

| column | type | note |
| --- | --- | --- |
| id | serial pk | |
| businessId | bigint | tenant scope |
| locationId | bigint | required, authorised location |
| provider | varchar(20) | `mpesa` (FK-free so banks can be added) |
| sourceType | varchar(20) | `pdf` / `csv` / `xlsx` / `sms` |
| kind | varchar(40) | `mobile_money_personal` / `mobile_money_paybill` / `bank_account` |
| fileName, fileSize, fileHash | | hash = sha256 of bytes, for duplicate-import warning |
| batchRef | varchar(36) | nullable; groups multi-file accountant batches (one row per file) |
| parserId, parserVersion | | provenance for every stored row |
| currency | varchar(3) | `KES` |
| periodStart, periodEnd | date | |
| openingBalance, closingBalance | numeric(15,2) | from statement |
| rowCount, importedCount, skippedCount, duplicateCount | integer | |
| status | varchar(20) | `parsed` / `imported` / `failed` / `rolled_back` |
| errorMessage | text | |
| warnings | jsonb | array of `{ code, message, rowIndex? }` |
| analysis | jsonb | frozen `StatementAnalysis` snapshot at import time |
| passwordProtected | boolean | never stores the password |
| importedBy | bigint | |
| createdAt, deletedAt | | |

Indexes: `(businessId, createdAt)`, `(locationId, provider)`, `(fileHash)`.

**The PDF itself is never stored.** Only parsed rows + metadata + analysis. Passwords stay in request
memory and are never logged.

### 6.2 `mobile_wallet_transactions` additions

```
categoryId                bigint → expense_categories(id) ON DELETE SET NULL
classificationSource      varchar(20) default 'none'   -- none|rule|learned|manual
classificationConfidence  numeric(4,3)
statementImportId         bigint → statement_imports(id) ON DELETE SET NULL
```

Indexes: `(statementImportId)`, `(categoryId)`.
This is what makes “categorise with room for manual categorisation” real without forcing an
`expenses` row per statement line.

### 6.3 `wallet_category_rules`

```
id, businessId, provider, matchType ('exact'|'contains'|'regex'), pattern,
categoryId → expense_categories, priority int, source ('system'|'user'),
hitCount int, isActive bool, createdBy, createdAt, updatedAt, deletedAt
```
System rules live in code (`categorize/rules.ts`); this table stores only user/learned overrides
(`priority >= 1000`), so rule changes ship with deployments and never require a data migration.

### 6.4 Undo semantics

`statements.undo(importId)` soft-deletes wallet rows where `statementImportId = id AND isLinked = false`.
Refuses if any row is linked to an expense/bill (`isLinked = true`) and reports which ones. Marks the
import `rolled_back`. SMS-imported rows are untouched.

---

## 7. Categorisation design

1. **System rules** (ordered, most specific first): utilities (KPLC, Kenya Power, Nairobi Water, NWSC,
   Zuku, DSTV, eCitizen, KRA, SHA/NHIF, NSSF), groceries (Naivas, Quickmart, Carrefour, Chandarana),
   food (Java, KFC, Chicken Inn, restaurants), fuel (Total, Shell, Vivo, Rubis, “PETROLEUM”),
   transport (Uber, Bolt, Little, matatu SACCO names), airtime/data (Safaricom, Airtel, “Bundle”),
   rent (“RENT”, landlord names), salaries (“SALARY”, payroll), supplies, marketing, maintenance,
   licences, bank/fees (`charge` rows → fees), cash withdrawal → cash, loans/savings (M-Shwari, Fuliza,
   KCB M-PESA), transfers → no expense category (internal movement).
2. **Resolve canonical key → the business’s own category** by name aliases, case-insensitive
   (`utilities → ["Utilities"]`, `airtime → ["Airtime/Data"]`, `fees → ["Bank Charges", "Bank Charges & Fees"]`).
   No match → `categoryId = null`, `classificationSource = 'none'`, shown as “Uncategorised”.
   We do **not** silently create categories; the review UI offers “Create category …”.
3. **Learned rules**: when a user sets a category on ≥1 transaction from a counterparty and ticks
   “remember this merchant”, upsert a `wallet_category_rules` row. On later imports it wins over system
   rules. Also applied to existing uncategorised rows for that counterparty (explicit action).
4. **Manual override** per row in Review and in the Transactions table: sets `categoryId`,
   `classificationSource='manual'`, confidence 1.
5. Confidence: `1.0` exact counterparty rule, `0.9` strong keyword, `0.6` weak keyword, `0` none.
   The review UI sorts low-confidence first and shows counts per category.

No LLM in this scope. `engine.ts` exposes a single `categorize(txn, rules, categories)` pure function,
so an AI pass can be added later without changing callers.

---

## 8. Analysis — parity with the published sheet spec

The `mpesa2csv.com/sheets` page is the authoritative feature list (13 sheets). We implement every one
as an **analysis block** — rendered in the UI and available as an export sheet — plus four blocks the
reference app does not have: **categories**, **day of week**, **reconciliation** and **anomalies**.

| Block | Contents (columns/insights from the spec) |
| --- | --- |
| `transactions` *(always)* | receipt, completion time, details, status, paid in, withdrawn, balance, (+ type / other party for paybill) |
| `moneyIn` *(always)* | inbound rows newest-first: receipt, time, sender, amount, balance after; total, count, largest |
| `moneyOut` *(always)* | outbound rows: receipt, time, recipient, amount, balance after; total, count, most frequent recipient |
| `charges` | every fee row with linked parent, charge amount, charge %, fee type; total, count, average %, highest single |
| `summary` | period, total in/out, net, avg daily in/out, highest/lowest balance day, most active day, busiest weekday, highest single in/out, avg txns/day |
| `breakdown` | per month and per week: in, out, net, avg transaction, count |
| `dailyBalance` | per day: end balance, txn count, highest, lowest; all-time high/low day, average end-of-day |
| `balanceCheck` | opening/closing/high/low/average **plus a continuity diagnostic**, not a corruption verdict: consecutive-row chain, with mismatches classified as same-receipt bundle legs, Fuliza/charge legs, or unexplained ordering artefacts. In the sample: 1,851 of 2,370 steps reconcile, 488 are explained bundle legs, ~31 are ordering artefacts, **0 unexplained missing rows** (totals prove nothing is missing). |
| `distribution` | amount buckets × inflow/outflow: count, total, % of transactions |
| `topContacts` | top 20 sent and top 20 received: contact, direction, total, count, average |
| `recurring` | description, type, frequency, occurrences, avg amount, fixed/variable, last seen, next expected, median interval |
| `timeOfDay` | hour 0–23 **and** named periods: count, % of total, in, out, net |
| `dayOfWeek` | weekday: count, % of total, in, out, net (app-only sheet) |
| `reversals` | receipt, time, type (send money / GlobalPay / generic), direction, amount, counterparty, linked receipt, linked details, **link method** |
| `payBillsTills` | type (pay bill / till), shortcode, name, total, count, fees (via shared receipt), paybill `Acc.` reference; plus a second section grouped by account reference |
| `categories` | per category: count, total out, share, uncategorised count (ours) |
| `reconciliation` | statement closing vs computed closing; imported vs already-present rows (SMS/previous import); balance breaks (ours) |
| `anomalies` | duplicate candidates, amounts above p95, out-of-hours spend, balance breaks, uncategorised spend (ours) |

**Linking and classification rules that must be exact**

* **Charges.** A charge row is a fee. Its parent is the row with the same receipt (fallback: same
  counterparty + amount within the fee window, nearest in time). Label the parent as
  `<receipt> (<verb> <amount>)` in exports. Fee types: `Send Money Fee`, `Lipa na M-PESA Fee`,
  `Withdrawal Fee`, `Pay Bill Fee`, `Airtime Fee`, `Fuliza / Loan Fee`, `Other Fee`. Charge % =
  fee ÷ parent amount (0 when no parent). Charges are **never** counted as generic spending in
  category totals; they roll into a Fees category.
* **Reversals.** Classify `Send Money Reversal`, `GlobalPay Reversal`, generic. Direction comes from the
  column (money returned = in, pulled back = out). Match a P2P reversal to the most recent earlier
  `Funds received` row with the same counterparty and amount; match a GlobalPay reversal to the most
  recent earlier `Card Pay Bill` row with the same paybill number and amount. Record
  `linkMethod: receipt | counterparty | paybill | none` and never re-use a parent twice.
* **Pay bills & tills.** Include `Pay Bill`, `Card Pay Bill`, `Merchant Payment`, `Merchant Payment
  Online`; exclude P2P `Send Money` and fee-only rows. Parse shortcode and `Acc.`/account reference from
  the details grammar; attach fees through the shared receipt; aggregate by shortcode, then list account
  references separately. **No Fuliza attribution in v1** — the statement does not reliably mark which
  merchant payment was Fuliza-funded, and guessing would be worse than omitting it.
* **Recurring.** Group by normalised counterparty + rail (not raw details). A group qualifies with ≥3
  occurrences. Interval = days between consecutive dates; frequency from median interval (≤2 daily,
  5–9 weekly, 12–18 biweekly, 25–35 monthly, 80–100 quarterly, 350–380 yearly); otherwise
  `Irregular` but still listed. `Fixed` when max deviation from mean ≤10%, else `Variable`. Next expected
  = last date + median interval. Exclude charge rows.
* **Time of day.** Named periods: Early Morning 05:00–07:00, Morning Rush 07:00–09:00, Morning
  09:00–11:00, Midday 11:00–13:00, Afternoon 13:00–17:00, Evening 17:00–20:00, Night 20:00–05:00.
  Rows with no time go into `Unknown`, never silently into Night.
* **Distribution.** Buckets (KES): <100, 100–499, 500–999, 1,000–1,999, 2,000–4,999, 5,000–9,999,
  10,000–49,999, 50,000–99,999, ≥100,000. Charges excluded; inflow and outflow counted separately.
* **Daily balance.** End-of-day balance = balance of the last row that day; highest/lowest = max/min
  stated balance that day. If a day has no row, it is omitted (not carried forward) — the tracker says so.
* **Balance continuity is a diagnostic, never an error verdict.** The sample’s own ledger does not chain
  row-to-row because (a) a receipt group contains several legs in an order that varies (charge before or
  after the spend), (b) Fuliza bundles pair a spend with an `OverDraft of Credit Party` whose amount
  includes the drawdown, and (c) same-second rows can be ordered either way. Totals matching the statement
  summary are the authoritative proof that nothing is missing. The UI shows “X steps reconcile · Y bundle
  legs · Z to review”, never “your statement is corrupt”.
* **Statement summary reconciliation.** Page 1 carries Safaricom’s own `SUMMARY` table (7 rails × paid in /
  paid out + total). Parse it and compare with our totals: the grand totals must match to the cent
  (they do: 786,098.76 / 782,565.53). Per-rail comparison is informational — Safaricom’s buckets do not map
  1:1 to ours (e.g. agent deposits and promotions sit in “Others”).

All amounts use **decimal.js** and are formatted only at the edge. Analysis is a pure function over
`StatementTransaction[]`, so the same code powers preview, the stored snapshot, the UI panel, exports and
the API. The export workbook is built from these blocks — no duplicated maths.

### 8.1 Export format contract

**CSV** (also used by the public tool):

* UTF-8 **with BOM** (so Excel and Google Sheets keep Kenyan names intact), RFC-4180 quoting, `\r\n`.
* Default columns: `Receipt No, Completion Time, Details, Transaction Status, Paid In, Withdrawn, Balance`;
  paybill statements append `Transaction Type, Other Party`.
* Options: `excludeCharges` (hide fee rows), `sortOrder` (asc/desc), `dateFormat`
  (`iso` = `YYYY-MM-DD HH:mm:ss`, `dd-mmm-yyyy`, `dd/mm/yyyy`), `maskPii` (mask phone numbers).
* Amounts are plain `1234.50` (no thousands separators) so spreadsheets parse them as numbers.

**JSON:** `{ meta, period, transactions[], analysis{} }` — stable, documented in OpenAPI, same shape as
the parse response so integrations can round-trip.

**XLSX:** sheet 1 = Main Transactions (always); Money In and Money Out included by default; all other
blocks toggled by the caller. Formatting: bold header with fill, frozen header row, autofilter, number
format `#,##0.00`, column widths, a Summary block at the top of its sheet. No charts in v1 (the UI
renders charts; the workbook stays portable).

---

## 9. API surface

### 9.1 tRPC (app)

Mounted as `wallet.statements.*` (keeps wallet permissions and route registration unchanged):

| procedure | type | permission | input → output |
| --- | --- | --- | --- |
| `wallet.statements.parse` | mutation | `wallet:import` | `{ fileName, fileBase64, password?, provider?, locationId? }` → `StatementPreview` (transactions, analysis, warnings, detected parser, balance check, duplicate count). Persists nothing. One file per call so the wizard can show per-file progress. |
| `wallet.statements.import` | mutation | `wallet:import` | `{ locationId, files: [{ fileName, fileBase64, password?, provider? }], overrides?, batchLabel? }` → `{ batchRef, imports: [{ importId, imported, skipped, duplicates, errors }], analysis }`. Max 12 files per batch, 10 MB each, re-parsed server-side (never trusts client rows), each file inserted in its own DB transaction so one bad PDF does not sink the batch. |
| `wallet.statements.imports` | query | `wallet:view` | paginated history |
| `wallet.statements.get` | query | `wallet:view` | import metadata + analysis + its wallet rows |
| `wallet.statements.undo` | mutation | `wallet:import` | `{ importId }` → counts / refusal reason |
| `wallet.statements.export` | query | `wallet:view` | `{ importId?, locationId?, dateFrom?, dateTo?, format: csv\|xlsx\|json, maskPii? }` → `{ fileName, mimeType, contentBase64 }` |
| `wallet.transactions.setCategory` | mutation | `wallet:import` | `{ walletTxnId, categoryId \| null, rememberMerchant? }` |
| `wallet.categoryRules.list/create/delete` | mixed | `wallet:view` / `wallet:import` | learned rules management |

Why base64 over tRPC instead of a multipart route: it reuses the existing auth, permission, rate-limit,
error and superjson plumbing; `bodyLimit` is already 50 MB; business PDFs are ≤ 10 MB. The 10 MB cap is
enforced in the procedure *before* decode. (A multipart route would need its own cookie auth + CSRF
header plumbing, since `/api/trpc` is the only CSRF-exempt app path.)

### 9.2 External REST (`/api/v1/statements`)

Machine-to-machine, API-key auth, CSRF-exempt by existing middleware.

| route | scope | notes |
| --- | --- | --- |
| `POST /api/v1/statements/parse` | `statements:write` | `multipart/form-data`: `file`, `password?`, `provider?`, `locationId?`; or JSON `{ contentBase64, … }`. Returns parsed + analysis + warnings. No persistence. |
| `POST /api/v1/statements/import` | `statements:write` | same input (one or `files[]`, max 12) + `locationId`, `overrides`, `batchLabel` → per-file results + `batchRef` |
| `GET /api/v1/statements/imports` | `statements:read` | paginated |
| `GET /api/v1/statements/imports/:id` | `statements:read` | metadata + analysis |
| `GET /api/v1/statements/imports/:id/export?format=csv\|xlsx\|json` | `statements:read` | `Content-Disposition: attachment` |
| `POST /api/v1/statements/analyze` | `statements:write` | parse without persist, analysis only (subset of `/parse`; kept for clarity) |

New scopes in `api/lib/api-scopes.ts`: `statements:read`, `statements:write`.
New limiter `statementParseLimiter` (20/min/IP) + `integrationLimiter` for the rest.
OpenAPI paths + schemas added to `docs/api-reference/openapi.yaml`; a `docs/statements.md` describes
formats, limits and error codes.

---

## 10. UI plan

### 10.1 Wallet page

* Header primary action stays a single **“Import”** button, now opening a tabbed dialog:
  **Statement** (default, new) and **SMS** (the existing paste flow, unchanged). No second button, no
  removal of SMS.
* New tab **“Statements”**: history table (date, provider, period, rows, imported/skipped, status) and a
  detail view with the analysis panel, export menu and Undo.

### 10.2 Import wizard

1. **Source** — provider cards (M-PESA active; Airtel Money, Sasapay, Bank marked “planned”), drag/drop or
   file picker (`application/pdf`, `.csv`, `.xlsx`), **multi-select up to 12 files** (the accountant guide’s
   batch case: a stack of monthly statements), 10 MB per file, location selector, “files are parsed in
   memory and never stored” note.
2. **Password** — shown per file only when `PasswordRequiredError`; retry without losing the file; explicit
   “password is not stored” hint; wrong-password state distinct from “cannot read”. M-PESA hint: “usually
   your national ID or phone number”.
3. **Review** — one row per file (parser, period, counts, balance-integrity badge, warnings) expandable to
   the transaction table; then the combined category distribution across the batch. Table of first 200 rows
   per file with include/exclude and category editing; bulk “Apply to all from &lt;merchant&gt;” + “remember”.
   Files that overlap (same period/receipts) show their cross-file duplicates before import.
4. **Result** — per file: imported / skipped (already existed) / invalid / duplicates; batch summary; link
   to the Statements tab; export buttons (CSV / XLSX / JSON, sheet toggles).

Errors covered explicitly: unsupported layout, no text layer (scanned), wrong password, corrupt file,
not a supported statement, too many pages, no transactions found.

### 10.3 Transaction categorisation

Transactions table gains a category cell (badge + picker). Saving sets `categoryId`; a checkbox
“Remember for this merchant” writes a learned rule. Uncategorised filter added next to the existing
unlinked filter.

---

## 11. Public “free M-PESA to CSV” tool (later phase, included in design)

* Public route `/tools/mpesa-statement-converter` (lazy, no auth, outside `ProtectedRoute`).
* **100% browser**: `extract/pdf-browser.ts` + shared core; exports CSV/JSON, and XLSX via dynamically
  imported `exceljs` (only loads on click). No network call, no storage, no analytics on file content.
* **Multi-file in the browser** as well: sequential parse with per-file status (the accountant use case),
  combined preview, one export. Memory guard: warn above ~25 files / 50 MB total.
* CSV honours the contract in §8.1 (UTF-8 BOM, RFC-4180, optional hide-charges, sort, date format, PII mask).
* UI states from `mpesa2csv`: idle → password (per file) → parsing → preview (summary + category hints) →
  download. Password hint: “usually your national ID or phone number”.
* Marketing surface mirrors the three published guide intents — **PDF → Excel**, **statement → CSV**, and
  **statements for accountants** — written in our own words, each with an FAQ and a CTA:
  `/tools/mpesa-statement-converter` (converter + CSV), `/tools/mpesa-to-excel` (workbook + analysis sheets),
  `/tools/mpesa-for-accountants` (batch, fee review, client hand-off). These are public, indexable pages;
  they are the acquisition funnel, not the product.
* Privacy banner (“processed on your device — nothing uploaded”), link from Home nav/footer, CTA
  “Import it into FinaFlow to categorise, reconcile and keep it in your books”.
* Rate/abuse: none needed (no server work). Bundle cost contained by a lazy route + dynamic exceljs.

---

## 12. Phases, deliverables and acceptance

### P0 - Parser foundation (no user-visible change)
- Add `shared/` + aliases + vitest include; add `pdfjs-dist@5.4.624`, `exceljs@4.4.0`.
- Implement `types`, `normalize/*`, `table/*`, `parsers/mpesa`, `registry`, `extract/pdf-node`.
- Fixtures: synthetic text-item JSON modelled on the validated layout (date/time split, wrapped details,
  page footer above the y-cutoff, page 1 SUMMARY block, charge+Fuliza receipt groups, page break) plus a
  script that generates a sample PDF with `pdf-lib` (devDependency) for extraction tests.
- Add `scripts/inspect-statement.ts` (local only, not part of the app): path + password → row count, totals,
  balance diagnostics, unclassified detail shapes. This is how other templates/providers get validated
  without committing real statements.
- Tests: amount/date/table reconstruction/detail grammar/duplicate keying (~60 cases), extraction test on
  the generated PDF, password-error mapping with a mocked document loader, and a golden test over the
  synthetic 2,371-shaped fixture (totals + group counts).
- **Acceptance:** `npx vitest run shared` green; `tsc -b` clean; no DB or UI change.

### P1 - Persistence + import
- Migration `0033` (incl. `batchRef`); schema additions; registries; `api/lib/statements/*`; tRPC procedures
  (`parse` one file, `import` 1-12 files, per-file DB transaction); audit log entries.
- Wallet header: the existing **Import** button becomes a tabbed dialog — **Statement** (default) and
  **SMS** (unchanged, the current paste flow). No second button, no removal of SMS.
- Fix `wallet.dailyLedger.create` to use `direction` (regression test).
- Tests: parse→import, dedupe against SMS rows, charge-row linking, batch with one failing file, undo
  (incl. refusal when linked), cross-tenant/location isolation, file guards (size, magic bytes, pages),
  permission enforcement.
- **Acceptance:** import a synthetic statement into a seeded test business; rows visible with
  `statementImportId`; second import imports 0 and reports duplicates; undo restores clean state.

### P2 - Categorisation + analysis + exports
- `categorize/*`, `analyze/*` (all 13 sheet blocks + day-of-week + reconciliation + anomalies),
  `export/*` (CSV contract §8.1, JSON, XLSX with sheet toggles).
- UI: Review/Statements/analysis panel; category editing + learned rules; **batch wizard** (multi-file)
  and per-file progress; export menu.
- Tests: rule precedence, taxonomy resolution, learned-rule application, every analysis block against a
  hand-computed fixture, charge/reversal link methods, recurring cadence, paybill shortcodes, balance-break
  detection, CSV bytes (BOM/quoting/CRLF) and XLSX cells (opened with exceljs and asserted cell-by-cell).
- **Acceptance:** preview shows categories and full analysis; import stores the snapshot; exports match
  the on-screen numbers; manual override persists and is learned.

### P3 — External API
- `api/routes/v1/statements.ts`, scopes, limiter, OpenAPI, `docs/statements.md`.
- Tests: scope enforcement (403 without), API-key tenant isolation, multipart and JSON inputs, export
  headers, rate-limit response, 10 MB/300-page caps.
- **Acceptance:** curl parity with the UI flow; OpenAPI validates (`$ref` resolution, docs page renders).

### P4 - Public converter
- Browser extractor, public pages (converter, PDF→Excel guide, accountants guide), Home links, privacy copy.
- Tests: component tests for state machine; a Playwright run uploading the generated fixture PDF and
  asserting the preview + download (no network request to our API); a multi-file run.
- **Acceptance:** works with the API server stopped; DevTools shows zero uploads.

### P5 — Next providers (follow-on, not this mission)
- Airtel Money / Sasapay statement parsers (CSV first), generic bank CSV mapper UI, OFX/QIF import,
  then the API can advertise `GET /api/v1/statements/providers`.

---

## 13. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Real M-PESA personal layout differs from other templates | **Validated** against a 77-page personal statement (2,371 rows, totals match). Remaining gap: a **paybill-owner** statement (9 columns: Transaction Type + Other Party) and older/other Safaricom templates. Keep the structural parser + header-alias fallback + a local diagnostics script. |
| Fuliza / charge legs break a naïve balance chain | Treat balance continuity as a diagnostic with explained bundle legs; use the statement summary totals as the authoritative check (they match to the cent). |
| pdf.js bundle/runtime in Node under esbuild | `--external:pdfjs-dist/*`; Docker already ships `node_modules`; pinned version verified for CI Node 20 |
| Password-protected PDFs | `getDocument({password})` + explicit error taxonomy; no storage, no logging |
| Large statements (memory/time) | 10 MB / 300-page caps, char cap, per-request limiter, soft-fail with “split the statement” |
| Charge rows double-counting fees | Charges are rows with `txnType='charge'`; analysis sums rows only, never both `fee` column and charge rows for statement imports |
| Category mismatch across businesses | Canonical keys + name aliases; unresolved stays uncategorised; no silent category creation |
| Undo after accounting links | Refuse and list linked rows |
| Cross-tenant leakage via global unique `(provider, provider_txn_id)` | Import checks scope by location; keep the existing index; note the pre-existing cross-tenant existence check as a separate small fix (include `locationId` in the duplicate lookup) |

---

## 14. Testing matrix (minimum)

| Layer | Where | What |
| --- | --- | --- |
| Unit (pure) | `shared/statements/__tests__` | amounts, dates, columns, merged cells, wrapped details, detail grammar, dedupe keys, taxonomy, analysis maths (decimal.js), recurring cadence, anomalies |
| Extraction | `shared/statements/__tests__/extract.test.ts` | generated PDF text items, no-text-layer, mocked password errors, page cap |
| Integration | `api/__tests__/statements-router.test.ts` | parse/import/list/get/undo, dedupe vs SMS, permissions, isolation, export formats, guards |
| API | `api/__tests__/statements-v1.test.ts` | scopes, multipart/JSON, tenant isolation, headers, limits |
| UI | `src/components/statements/__tests__` | wizard state machine, password retry, review toggles, result counts |
| E2E | `e2e/__tests__/statement-import.test.ts` | upload → review → import → rows + analysis, undo |
| Public tool | `e2e/__tests__/mpesa-converter.test.ts` | no network, preview, CSV download |

Every behaviour fix (including the ledger `direction` bug) gets a failing test first.

---

## 15. Explicitly out of scope for this mission

* Storing original statement files or passwords.
* Real bank API feeds / open banking; bank statements arrive only as CSV later.
* Posting statement rows into journals/expenses automatically (bulk “post to expenses” stays a deliberate
  follow-up; P1 imports wallet transactions, which is what the wallet page already understands).
* AI categorisation.
* Airtel Money / Sasapay / bank parsers (registry ready, parsers next).
* Removing the legacy `mpesa_transactions` table/router.
* OFX / QFX / QIF export (the reference app has them as experimental; each is another format with its own
  quirks and no clear demand from our users yet).
* Fuliza attribution on merchant spend (not reliably derivable from the statement; see §8).

---

## 16. Decisions needed before implementation

1. ~~**Sample statements**~~ — **personal format received and validated** (77 pages, 2,371 rows, totals match).
   Still untested: one **paybill-owner** statement (9 columns with Transaction Type + Other Party). The parser
   has the header-alias branch, but it needs a real file before we claim support.
2. ~~**Category model**~~ — **approved and implemented**: `categoryId`, `classificationSource` and
   `classificationConfidence` on `mobile_wallet_transactions` (no `expenses` row per statement line).
3. ~~**SMS import**~~ — **resolved**: stays exactly as it is, as the second tab of the existing Import button.
4. ~~**Missing categories**~~ — **resolved**: best-effort rules only; anything without a confident match is
   left with no category. No silent category creation, no “Miscellaneous” dumping ground.
5. **Phase order** — ship P0–P2 first (parser + import + analysis + categorisation), then P3 API and P4 public
   tool. If you want the API earlier, say so and I’ll move P3 before P2’s UI polish.
6. **Batch scope** — the accountant guide makes multi-file batch a core feature. I’ve included the data model
   (`batchRef`) and API (`files[]`) in P1, but the batch UI in P2. Say if you want batch UI in P1 instead; it
   adds roughly a day to P1 and moves its acceptance date.
