> vitest run --coverage


 RUN  v4.1.6 /home/runner/work/finaflow/finaflow
      Coverage enabled with v8

 ✓ api/__tests__/business-reset.test.ts (9 tests) 2785ms
     ✓ clears all transactional data while preserving setup records  338ms
 ❯ api/__tests__/budgets-router.test.ts (17 tests | 4 failed) 1381ms
     × creates a monthly budget with 12 buckets 79ms
     ✓ creates a quarterly budget with 4 buckets 22ms
     × creates half-yearly (2) and annual (1) budgets 40ms
     ✓ (setup) creates a monthly draft plan for shared use 48ms
     ✓ lists plans by year and filters by status 17ms
     ✓ gets a single plan with buckets and enriched lines 10ms
     ✓ updateLines replaces lines on one bucket and leaves others unchanged 33ms
     ✓ updateLines does not change plan status 40ms
     × copyMonthlyBucket copies lines to target buckets 18ms
     × copyMonthlyBucket rejects source bucket in targets 7ms
     ✓ activates, locks, and archives a plan in sequence 121ms
     ✓ throws NOT_FOUND when updating lines on a non-existent plan 6ms
     ✓ throws NOT_FOUND when getting a non-existent plan 4ms
     ✓ throws NOT_FOUND when activating a non-existent plan 3ms
     ✓ throws NOT_FOUND when locking a non-existent plan 6ms
     ✓ throws NOT_FOUND when archiving a non-existent plan 4ms
     ✓ (cleanup) removes the shared plan 3ms
 ✓ api/__tests__/wallet-router.test.ts (19 tests) 1441ms
 ✓ api/__tests__/recurring-bills-isolation.test.ts (12 tests) 1183ms
 ✓ api/__tests__/posted-delete-guards.test.ts (4 tests) 1064ms
 ✓ api/lib/__tests__/notification-lifecycle.test.ts (21 tests) 884ms
stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] customerAccount: id=22

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] business: id=57

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] customerAccount: id=25

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] business: id=60

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] customerAccount: id=27

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] business: id=62

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] attempt accountId="NONEXISTENT999" username="nobody"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] customerAccount: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] business: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] input.accountId="SCOPETEST1" normalized="SCOPETEST1"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] customerAccount found: id=32

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] business found: id=67, name="Scope Test Business"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] input.accountId="NOTEXIST" normalized="NOTEXIST"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] customerAccount found: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] business found: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] customerAccount: id=35

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] business: id=70

 ✓ src/lib/budgets/__tests__/rollups.test.ts (19 tests) 967ms
stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] customerAccount: id=37

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] business: id=72

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] attempt accountId="DEMO" username="owner"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] customerAccount: id=39

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] business: id=74

 ✓ api/__tests__/local-auth-scope.test.ts (12 tests) 2385ms
     ✓ registers and creates both customer_accounts and accountRefId on user/business  315ms
 ✓ api/__tests__/cross-account-isolation.test.ts (15 tests) 4631ms
     ✓ permissions.listUsers returns only users from caller's account  493ms
     ✓ new account can only access its own user data  331ms
 ✓ db/__tests__/0014_budget_plan_model_migration.test.ts (25 tests) 776ms
 ✓ api/__tests__/notification-bill-clearance.test.ts (4 tests) 1491ms
stdout | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[login] attempt accountId="ALICEVENTURES" username="alice-owner"

stdout | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[login] customerAccount: id=42

stdout | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[login] business: id=78

 ✓ api/__tests__/notification-scope.test.ts (1 test) 962ms
stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > rejects duplicate username and duplicate email for a different signup
[register] signup failed TRPCError: Account ID already taken. Choose another.
    at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:536:19
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at NodePgSession.transaction (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:186:22)
    at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:528:30
    at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13
    at /home/runner/work/finaflow/finaflow/api/__tests__/local-auth-registration.test.ts:183:5 {
  cause: undefined,
  code: 'CONFLICT'
}

stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > rejects duplicate username and duplicate email for a different signup
[register] signup failed TRPCError: Email address already in use
    at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:582:19
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at NodePgSession.transaction (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:186:22)
    at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:528:30
    at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13
    at /home/runner/work/finaflow/finaflow/api/__tests__/local-auth-registration.test.ts:191:5 {
  cause: undefined,
  code: 'CONFLICT'
}

stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > rolls back user creation when downstream account creation fails
[register] signup failed Error: Simulated registration failure before default account creation
    at provisionBusiness (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:88:11)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:599:32
    at NodePgSession.transaction (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:186:22)
    at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:528:30
    at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13

 ✓ api/__tests__/local-auth-registration.test.ts (5 tests) 2279ms
     ✓ registers, creates linked rows, and issues auth cookies  309ms
 ✓ api/lib/__tests__/mpesa-provider.test.ts (24 tests) 713ms
stderr | api/__tests__/subscriptions.test.ts > Subscription lifecycle > downgrades expired trials without a payment method and creates notifications
[email] SMTP not configured; skipping outbound email {
  to: 'expireco@example.com',
  subject: 'EXPIRECO Business has been downgraded to Free'
}

 ✓ api/__tests__/user-location-enforcement.test.ts (4 tests) 1049ms
 ✓ api/__tests__/subscriptions.test.ts (4 tests) 1083ms
 ✓ src/lib/budgets/__tests__/period.test.ts (26 tests) 843ms
 ✓ e2e/__tests__/user-multi-location-flow.test.ts (1 test) 872ms
 ✓ src/components/pricing/__tests__/PricingCard.test.tsx (11 tests) 857ms
 ✓ db/__tests__/0009_wallet_migration.test.ts (19 tests) 942ms
 ✓ src/components/pricing/__tests__/ChangeablePricingSection.test.tsx (9 tests) 1098ms
 ✓ src/lib/__tests__/currency.test.ts (27 tests) 836ms
 ❯ api/__tests__/expenses-dual-mode.test.ts (0 test)
 ✓ api/__tests__/user-deletion-flow.test.ts (4 tests) 1175ms
stderr | api/lib/__tests__/sasapay-provider.test.ts > SasapayProvider > processWebhook rejects invalid HMAC
[SasapayProvider] processWebhook: Error: Invalid HMAC signature
    at SasapayProvider.processWebhook (/home/runner/work/finaflow/finaflow/api/lib/mobile-wallet/providers/sasapay-provider.ts:169:41)
    at /home/runner/work/finaflow/finaflow/api/lib/__tests__/sasapay-provider.test.ts:55:35
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:302:11
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:26
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:2326:20
    at new Promise (<anonymous>)
    at runWithCancel (file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:2323:10)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:2305:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:2272:10) {
  received: 'wrong-signature',
  expected: '316219abce00aaf7c0b9ce9a7f35d6655b670184fe2a740373283175738e66f5'
}

 ✓ api/lib/__tests__/sasapay-provider.test.ts (8 tests) 863ms
 ✓ api/lib/__tests__/provider-registry.test.ts (8 tests) 767ms
 ✓ src/lib/budgets/__tests__/validation.test.ts (18 tests) 805ms
 ✓ src/pages/__tests__/Login.test.tsx (9 tests) 1075ms
 ✓ api/__tests__/account-subscription-context.test.ts (1 test) 906ms
 ✓ api/lib/__tests__/airtel-money-provider.test.ts (13 tests) 816ms
 ✓ src/pages/__tests__/business-details-profile.test.ts (2 tests) 870ms
 ✓ api/lib/__tests__/tax.test.ts (16 tests) 687ms
 ✓ api/__tests__/payroll.test.ts (4 tests) 856ms
 ✓ api/__tests__/future-date-validation.test.ts (9 tests) 972ms
 ✓ api/lib/__tests__/user-references.test.ts (8 tests) 786ms
 ✓ api/lib/__tests__/accounting-foundations.test.ts (5 tests) 680ms
 ✓ src/pages/__tests__/Home.test.tsx (8 tests) 1773ms
 ✓ src/features/reports/__tests__/chart-data.test.ts (4 tests) 803ms
 ✓ api/lib/__tests__/currency-converter.test.ts (9 tests) 719ms
 ✓ api/__tests__/account-subscription-migration.test.ts (1 test) 748ms
stderr | api/lib/__tests__/webhook-handler.test.ts > handleWalletWebhook > returns 200 for processed webhook
[WebhookHandler] Failed to log transaction: DrizzleQueryError: Failed query: insert into "mobile_wallet_transactions" ("id", "locationId", "provider", "provider_txn_id", "provider_ref", "txnDate", "txnTime", "txn_type", "direction", "partyName", "party_identifier", "amount", "currency", "txnFee", "balance", "description", "rawText", "raw_payload", "status", "is_reconciled", "is_linked", "linkedExpenseId", "linkedBillId", "linkedSupplierId", "sourceAccountId", "destinationAccountId", "importedBy", "base_currency", "base_amount", "conversion_rate", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, default, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, default, default, default, default, default, default, $20, $21, default, default, default, default) returning "id"
params: 0,webhook_mock,WHK123,2026-06-15,,payment,in,,,500.00,KES,0.00,,,,{"rawBody":"{\"event\":\"payment\",\"amount\":500}"},completed,false,false,,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:117:22
    ... 3 lines matching cause stack trace ...
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20 {
  query: 'insert into "mobile_wallet_transactions" ("id", "locationId", "provider", "provider_txn_id", "provider_ref", "txnDate", "txnTime", "txn_type", "direction", "partyName", "party_identifier", "amount", "currency", "txnFee", "balance", "description", "rawText", "raw_payload", "status", "is_reconciled", "is_linked", "linkedExpenseId", "linkedBillId", "linkedSupplierId", "sourceAccountId", "destinationAccountId", "importedBy", "base_currency", "base_amount", "conversion_rate", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, default, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, default, default, default, default, default, default, $20, $21, default, default, default, default) returning "id"',
  params: [
    0,
    'webhook_mock',
    'WHK123',
    '2026-06-15',
    null,
    'payment',
    'in',
    null,
    null,
    '500.00',
    'KES',
    '0.00',
    null,
    null,
    null,
    '{"rawBody":"{\\"event\\":\\"payment\\",\\"amount\\":500}"}',
    'completed',
    false,
    false,
    null,
    null
  ],
  cause: error: insert or update on table "mobile_wallet_transactions" violates foreign key constraint "mobile_wallet_transactions_provider_mobile_wallet_providers_cod"
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:124:18
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:117:22
      at logWalletTransaction (/home/runner/work/finaflow/finaflow/api/lib/mobile-wallet/transaction-logger.ts:85:20)
      at handleWalletWebhook (/home/runner/work/finaflow/finaflow/api/lib/mobile-wallet/webhook-handler.ts:32:9)
      at /home/runner/work/finaflow/finaflow/api/lib/__tests__/webhook-handler.test.ts:60:20
      at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20 {
    length: 404,
    severity: 'ERROR',
    code: '23503',
    detail: 'Key (provider)=(webhook_mock) is not present in table "mobile_wallet_providers".',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'mobile_wallet_transactions',
    column: undefined,
    dataType: undefined,
    constraint: 'mobile_wallet_transactions_provider_mobile_wallet_providers_cod',
    file: 'ri_triggers.c',
    line: '2608',
    routine: 'ri_ReportViolation'
  }
}

 ✓ api/lib/__tests__/debt-classification.test.ts (7 tests) 755ms
 ✓ api/lib/__tests__/webhook-handler.test.ts (2 tests) 911ms
 ✓ src/components/pricing/__tests__/BillingCycleToggle.test.tsx (5 tests) 714ms
 ✓ api/lib/__tests__/decimal.test.ts (12 tests) 788ms
 ✓ api/lib/__tests__/accounting-system-accounts.test.ts (1 test) 827ms
 ✓ api/__tests__/auth.test.ts (8 tests) 743ms
 ✓ api/__tests__/seed-demo-plan.test.ts (2 tests) 816ms
 ✓ api/__tests__/accounts.test.ts (5 tests) 709ms
 ✓ src/components/landing/__tests__/RotatingHeadline.test.tsx (6 tests) 713ms
 ✓ db/__tests__/0013_user_locations_migration.test.ts (4 tests) 818ms
 ✓ api/__tests__/partner-allocations-contract.test.ts (8 tests) 826ms
 ✓ src/components/landing/__tests__/AnimatedCounter.test.tsx (5 tests) 718ms
 ✓ api/lib/__tests__/currency-lock.test.ts (5 tests) 801ms
 ✓ e2e/__tests__/user-management-flow.test.ts (3 tests) 690ms
 ✓ api/__tests__/frontend-regressions.test.ts (4 tests) 1748ms
     ✓ exposes a default export for the Businesses page lazy route  890ms
 ✓ api/__tests__/partner-allocations-rights.test.ts (3 tests) 814ms
 ✓ api/lib/__tests__/schema-readiness.test.ts (2 tests) 812ms
 ✓ api/lib/__tests__/transaction-logger.test.ts (2 tests) 800ms
 ✓ src/features/reports/__tests__/report-scope.test.ts (3 tests) 735ms
 ✓ api/__tests__/users-create-values.test.ts (3 tests) 701ms
 ❯ api/__tests__/journal-and-sales.test.ts (0 test)
 ✓ e2e/__tests__/bills-cycle.test.ts (3 tests) 819ms
 ✓ api/__tests__/business-documents-router-contract.test.ts (3 tests) 937ms
 ✓ api/__tests__/business-logo-router-contract.test.ts (3 tests) 945ms
 ✓ e2e/__tests__/payroll-cycle.test.ts (2 tests) 819ms
 ❯ api/__tests__/accounts-coa-integration.test.ts (0 test)
 ✓ src/features/business-profile/__tests__/BusinessLetterhead.test.tsx (1 test) 644ms
 ✓ api/__tests__/logo-validation.test.ts (4 tests) 808ms
 ✓ src/features/business-profile/__tests__/logo-utils.test.ts (4 tests) 1029ms
 ✓ api/__tests__/po-router.test.ts (2 tests) 989ms
 ✓ api/__tests__/server-runtime.test.ts (2 tests) 746ms
 ✓ api/__tests__/business-documents-utils.test.ts (3 tests) 844ms
 ❯ api/__tests__/account-subscription-enforcement.test.ts (0 test)
 ✓ src/features/business-profile/__tests__/formatters.test.ts (3 tests) 835ms
 ✓ e2e/__tests__/sales-cycle.test.ts (2 tests) 682ms
 ✓ api/__tests__/date-key.test.ts (2 tests) 745ms
 ✓ src/pages/__tests__/business-details-export.test.ts (1 test) 552ms

⎯⎯⎯⎯⎯⎯ Failed Suites 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/account-subscription-enforcement.test.ts [ api/__tests__/account-subscription-enforcement.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/account-subscription-enforcement.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/8]⎯

 FAIL  api/__tests__/accounts-coa-integration.test.ts [ api/__tests__/accounts-coa-integration.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/accounts-coa-integration.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/8]⎯

 FAIL  api/__tests__/expenses-dual-mode.test.ts [ api/__tests__/expenses-dual-mode.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/expenses-dual-mode.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/8]⎯

 FAIL  api/__tests__/journal-and-sales.test.ts [ api/__tests__/journal-and-sales.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/journal-and-sales.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/8]⎯


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > creates a monthly budget with 12 buckets
AssertionError: expected [] to have a length of 24 but got +0

- Expected
+ Received

- 24
+ 0

 ❯ api/__tests__/budgets-router.test.ts:174:22
    172|       sql`${bbl.bucketId} IN (${sql.join(buckets.map((b) => sql`${b.id…
    173|     );
    174|     expect(allLines).toHaveLength(24);
       |                      ^
    175|
    176|     // Clean up

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/8]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > creates half-yearly (2) and annual (1) budgets
AssertionError: expected [] to have a length of 1 but got +0

- Expected
+ Received

- 1
+ 0

 ❯ api/__tests__/budgets-router.test.ts:224:27
    222|     });
    223|     const annualBuckets = await db.select().from(bpb).where(eq(bpb.pla…
    224|     expect(annualBuckets).toHaveLength(1);
       |                           ^
    225|     expect(annualBuckets[0].bucketType).toBe("annual");
    226|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/8]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > copyMonthlyBucket copies lines to target buckets
TRPCError: Bucket not found for this plan
 ❯ api/budgets-router.ts:151:28
    149|       validateBudgetLines(input.lines);
    150|       const [bucket] = await db.select().from(budgetPlanBuckets).where…
    151|       if (!bucket) { throw new TRPCError({ code: "NOT_FOUND", message:…
       |                            ^
    152|       await db.transaction(async (tx) => {
    153|         await tx.delete(budgetBucketLines).where(eq(budgetBucketLines.…
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:345:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/8]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > copyMonthlyBucket rejects source bucket in targets

TRPCError: Budget plan not found or access denied
 ❯ requirePlanAccess api/budgets-router.ts:29:22
     27|   const locIdSql = sql.join(locIds.map((id) => sql`${id}`), sql`, `);
     28|   const [plan] = await db.select().from(budgetPlans).where(and(eq(budg…
     29|   if (!plan) { throw new TRPCError({ code: "NOT_FOUND", message: "Budg…
       |                      ^
     30|   return plan;
     31| }
 ❯ api/budgets-router.ts:126:20
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 Test Files  5 failed | 72 passed (77)
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:382:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/8]⎯

      Tests  4 failed | 536 passed (540)
   Start at  14:57:21
   Duration  44.25s (transform 4.39s, setup 19.52s, import 15.67s, tests 73.65s, environment 14ms)


Error: AssertionError: expected [] to have a length of 24 but got +0

- Expected
+ Received

- 24
+ 0

 ❯ api/__tests__/budgets-router.test.ts:174:22



Error: AssertionError: expected [] to have a length of 1 but got +0

- Expected
+ Received

- 1
+ 0

 ❯ api/__tests__/budgets-router.test.ts:224:27



Error: TRPCError: Bucket not found for this plan
 ❯ api/budgets-router.ts:151:28
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:345:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'NOT_FOUND' }


Error: TRPCError: Budget plan not found or access denied
 ❯ requirePlanAccess api/budgets-router.ts:29:22
 ❯ api/budgets-router.ts:126:20
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:382:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'NOT_FOUND' }

Error: Process completed with exit code 1.
0s
0s
1s
