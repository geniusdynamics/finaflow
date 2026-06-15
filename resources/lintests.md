> my-app@1.0.0 test
> vitest run --coverage


 RUN  v4.1.6 /home/runner/work/finaflow/finaflow
      Coverage enabled with v8

 ❯ api/__tests__/business-reset.test.ts (9 tests | 4 failed) 2975ms
     × clears all transactional data while preserving setup records 256ms
     × preserves all immutable records after reset 211ms
     × validatePreReset returns valid state for a business with data 159ms
     × createResetSnapshot captures accurate pre-reset record counts 149ms
     ✓ returns complete result structure with per-table counts 212ms
     ✓ handles businesses with multiple locations 73ms
     ✓ completes successfully even when no locations exist 24ms
     ✓ clears payroll periods, entries, and advances 141ms
     ✓ clears budgets, purchase orders, and recurring bill templates 137ms
 ❯ api/__tests__/budgets-router.test.ts (17 tests | 7 failed) 1284ms
     ✓ creates a monthly budget with 12 buckets 78ms
     ✓ creates a quarterly budget with 4 buckets 27ms
     ✓ creates half-yearly (2) and annual (1) budgets 32ms
     ✓ (setup) creates a monthly draft plan for shared use 42ms
     × lists plans by year and filters by status 17ms
     × gets a single plan with buckets and enriched lines 8ms
     × updateLines replaces lines on one bucket and leaves others unchanged 4ms
     × updateLines does not change plan status 5ms
     × copyMonthlyBucket copies lines to target buckets 6ms
     × copyMonthlyBucket rejects source bucket in targets 6ms
     × activates, locks, and archives a plan in sequence 106ms
     ✓ throws NOT_FOUND when updating lines on a non-existent plan 6ms
     ✓ throws NOT_FOUND when getting a non-existent plan 3ms
     ✓ throws NOT_FOUND when activating a non-existent plan 3ms
     ✓ throws NOT_FOUND when locking a non-existent plan 3ms
     ✓ throws NOT_FOUND when archiving a non-existent plan 3ms
     ✓ (cleanup) removes the shared plan 2ms
 ✓ api/__tests__/wallet-router.test.ts (19 tests) 1382ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.listUsers returns only users from caller's account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 30,31,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    30,
    31,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (13, 30, 31, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:48.124391, 2026-06-15 07:11:48.124391, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.listUsers returns only users from caller's account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 35,36,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    35,
    36,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (15, 35, 36, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:48.305636, 2026-06-15 07:11:48.305636, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

 ✓ api/__tests__/recurring-bills-isolation.test.ts (12 tests) 1203ms
 ✓ api/__tests__/posted-delete-guards.test.ts (4 tests) 1063ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.listUsers prevents cross-account visibility
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 38,39,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    38,
    39,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (17, 38, 39, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:48.615908, 2026-06-15 07:11:48.615908, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.listUsers prevents cross-account visibility
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 39,40,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    39,
    40,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (18, 39, 40, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:48.728801, 2026-06-15 07:11:48.728801, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.list returns only users from caller's account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 40,41,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    40,
    41,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (19, 40, 41, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:49.078211, 2026-06-15 07:11:49.078211, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.list returns only users from caller's account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 41,42,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    41,
    42,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (20, 41, 42, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:49.162039, 2026-06-15 07:11:49.162039, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.get returns null for user from another account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 42,43,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    42,
    43,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 388,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (21, 42, 43, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:49.54045, 2026-06-15 07:11:49.54045, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.get returns null for user from another account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 43,44,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    43,
    44,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 388,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (22, 43, 44, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:49.61975, 2026-06-15 07:11:49.61975, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.get returns user from own account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 44,45,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    44,
    45,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (23, 44, 45, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:49.951648, 2026-06-15 07:11:49.951648, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.get returns user from own account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 45,46,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    45,
    46,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (24, 45, 46, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.188154, 2026-06-15 07:11:50.188154, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.update rejects cross-account update
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 46,47,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    46,
    47,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (25, 46, 47, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.446257, 2026-06-15 07:11:50.446257, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

 ✓ api/lib/__tests__/notification-lifecycle.test.ts (21 tests) 1460ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.update rejects cross-account update
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 47,48,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    47,
    48,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (26, 47, 48, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.509482, 2026-06-15 07:11:50.509482, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > registers and creates both customer_accounts and accountRefId on user/business
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 48,49,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    48,
    49,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (27, 48, 49, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.538814, 2026-06-15 07:11:50.538814, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 49,50,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    49,
    50,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (28, 49, 50, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.751834, 2026-06-15 07:11:50.751834, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] customerAccount: id=14

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] business: id=49

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.delete rejects cross-account delete
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 50,51,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    50,
    51,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (29, 50, 51, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.796408, 2026-06-15 07:11:50.796408, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.delete rejects cross-account delete
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 51,52,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    51,
    52,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (30, 51, 52, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.863404, 2026-06-15 07:11:50.863404, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 52,53,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    52,
    53,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (31, 52, 53, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:50.976113, 2026-06-15 07:11:50.976113, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] customerAccount: id=17

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] business: id=52

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.changePassword rejects cross-account change
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 53,54,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    53,
    54,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (32, 53, 54, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.133813, 2026-06-15 07:11:51.133813, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.changePassword rejects cross-account change
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 54,55,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    54,
    55,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (33, 54, 55, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.203902, 2026-06-15 07:11:51.203902, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 55,56,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    55,
    56,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (34, 55, 56, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.211459, 2026-06-15 07:11:51.211459, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] customerAccount: id=20

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] business: id=55

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] attempt accountId="NONEXISTENT999" username="nobody"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] customerAccount: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] business: null

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > checks account availability correctly
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 56,57,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    56,
    57,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (35, 56, 57, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.464305, 2026-06-15 07:11:51.464305, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.updateUserRole rejects cross-account role update
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 57,58,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    57,
    58,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (36, 57, 58, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.482399, 2026-06-15 07:11:51.482399, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.updateUserRole rejects cross-account role update
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 58,59,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    58,
    59,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (37, 58, 59, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.549076, 2026-06-15 07:11:51.549076, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 59,60,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    59,
    60,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (38, 59, 60, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.697547, 2026-06-15 07:11:51.697547, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] input.accountId="SCOPETEST1" normalized="SCOPETEST1"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] customerAccount found: id=24

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] business found: id=59, name="Scope Test Business"

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.get returns null for business from another account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 60,61,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    60,
    61,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (39, 60, 61, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.777657, 2026-06-15 07:11:51.777657, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] input.accountId="NOTEXIST" normalized="NOTEXIST"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] customerAccount found: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] business found: null

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.get returns null for business from another account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 61,62,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    61,
    62,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (40, 61, 62, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.853406, 2026-06-15 07:11:51.853406, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 62,63,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    62,
    63,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (41, 62, 63, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:51.899784, 2026-06-15 07:11:51.899784, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] customerAccount: id=27

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] business: id=62

 ✓ src/lib/budgets/__tests__/rollups.test.ts (19 tests) 973ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.members rejects cross-account access
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 64,65,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    64,
    65,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (42, 64, 65, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.101651, 2026-06-15 07:11:52.101651, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 63,64,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    63,
    64,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (43, 63, 64, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.108624, 2026-06-15 07:11:52.108624, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] attempt accountId="SCOPETEST1" username="scopetest-user"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] customerAccount: id=28

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] business: id=63

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.members rejects cross-account access
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 65,66,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    65,
    66,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (44, 65, 66, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.157999, 2026-06-15 07:11:52.157999, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[seedDefaults] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 66,67,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13
    at /home/runner/work/finaflow/finaflow/api/__tests__/local-auth-scope.test.ts:312:20
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    66,
    67,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:794:7
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
      at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (45, 66, 67, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.323456, 2026-06-15 07:11:52.323456, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] attempt accountId="DEMO" username="owner"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] customerAccount: id=31

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] business: id=66

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.addMember rejects cross-account user addition
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 67,69,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    67,
    69,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (46, 67, 69, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.402686, 2026-06-15 07:11:52.402686, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.addMember rejects cross-account user addition
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 68,70,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    68,
    70,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (47, 68, 70, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.483152, 2026-06-15 07:11:52.483152, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

 ✓ api/__tests__/local-auth-scope.test.ts (12 tests) 2814ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.removeMember rejects cross-account access
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 69,71,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    69,
    71,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (48, 69, 71, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.755508, 2026-06-15 07:11:52.755508, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.removeMember rejects cross-account access
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 70,72,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    70,
    72,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (49, 70, 72, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:52.821396, 2026-06-15 07:11:52.821396, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > new account can only access its own user data
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 71,73,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    71,
    73,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (50, 71, 73, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:53.064225, 2026-06-15 07:11:53.064225, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > new account can only access its own user data
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 72,74,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    72,
    74,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (51, 72, 74, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:53.136884, 2026-06-15 07:11:53.136884, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > new account can only access its own user data
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 73,75,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    73,
    75,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (52, 73, 75, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:53.239836, 2026-06-15 07:11:53.239836, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

 ✓ db/__tests__/0014_budget_plan_model_migration.test.ts (25 tests) 808ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > rejects unauthenticated access to user endpoints
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 74,76,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    74,
    76,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (53, 74, 76, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:53.554739, 2026-06-15 07:11:53.554739, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > rejects unauthenticated access to user endpoints
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 75,77,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    75,
    77,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (54, 75, 77, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:53.636661, 2026-06-15 07:11:53.636661, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

 ✓ api/__tests__/cross-account-isolation.test.ts (15 tests) 6586ms
     ✓ permissions.listUsers returns only users from caller's account  573ms
     ✓ permissions.listUsers prevents cross-account visibility  439ms
     ✓ users.list returns only users from caller's account  450ms
     ✓ users.get returns null for user from another account  434ms
     ✓ users.get returns user from own account  524ms
     ✓ users.update rejects cross-account update  346ms
     ✓ users.delete rejects cross-account delete  347ms
     ✓ users.changePassword rejects cross-account change  335ms
     ✓ businesses.get returns null for business from another account  337ms
     ✓ businesses.addMember rejects cross-account user addition  355ms
     ✓ businesses.removeMember rejects cross-account access  308ms
     ✓ new account can only access its own user data  483ms
     ✓ rejects unauthenticated access to user endpoints  316ms
 ✓ api/__tests__/notification-bill-clearance.test.ts (4 tests) 961ms
stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > registers, creates linked rows, and issues auth cookies
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 77,79,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    77,
    79,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (56, 77, 79, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:55.625263, 2026-06-15 07:11:55.625263, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 80,82,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    80,
    82,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (58, 80, 82, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:55.923741, 2026-06-15 07:11:55.923741, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stdout | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[login] attempt accountId="ALICEVENTURES" username="alice-owner"

stdout | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[login] customerAccount: id=42

stdout | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[login] business: id=80

 ✓ api/__tests__/notification-scope.test.ts (1 test) 930ms
stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > treats an exact retry as success instead of creating duplicates
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 81,83,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    81,
    83,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (59, 81, 83, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:56.144867, 2026-06-15 07:11:56.144867, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > rejects duplicate username and duplicate email for a different signup
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 82,84,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    82,
    84,
    'Food Supplies',
    'Ingredients and raw materials',
    '#C73E1D',
    'cogs',
    null
  ],
  cause: error: null value in column "defaultAccountId" of relation "expense_categories" violates not-null constraint
      at /home/runner/work/finaflow/finaflow/node_modules/pg-pool/index.js:45:11
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/node-postgres/session.js:113:20
      at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:39:16)
      at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (60, 82, 84, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-15 07:11:56.363928, 2026-06-15 07:11:56.363928, null).',
    hint: undefined,
    position: undefined,
    internalPosition: undefined,
    internalQuery: undefined,
    where: undefined,
    schema: 'public',
    table: 'expense_categories',
    column: 'defaultAccountId',
    dataType: undefined,
    constraint: undefined,
    file: 'execMain.c',
    line: '2057',
    routine: 'ExecConstraints'
  }
}

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

 ✓ api/__tests__/local-auth-registration.test.ts (5 tests) 2124ms
     ✓ registers, creates linked rows, and issues auth cookies  364ms
stderr | api/__tests__/subscriptions.test.ts > Subscription lifecycle > downgrades expired trials without a payment method and creates notifications
[email] SMTP not configured; skipping outbound email {
  to: 'expireco@example.com',
  subject: 'EXPIRECO Business has been downgraded to Free'
}

 ✓ api/__tests__/subscriptions.test.ts (4 tests) 1373ms
 ✓ api/__tests__/user-location-enforcement.test.ts (4 tests) 1335ms
 ✓ api/lib/__tests__/mpesa-provider.test.ts (24 tests) 1087ms
 ✓ src/lib/budgets/__tests__/period.test.ts (26 tests) 725ms
 ✓ e2e/__tests__/user-multi-location-flow.test.ts (1 test) 971ms
 ✓ src/components/pricing/__tests__/PricingCard.test.tsx (11 tests) 1171ms
 ✓ src/components/pricing/__tests__/ChangeablePricingSection.test.tsx (9 tests) 1145ms
 ✓ db/__tests__/0009_wallet_migration.test.ts (19 tests) 803ms
 ❯ api/__tests__/expenses-dual-mode.test.ts (0 test)
 ✓ src/lib/__tests__/currency.test.ts (27 tests) 872ms
 ✓ api/__tests__/user-deletion-flow.test.ts (4 tests) 985ms
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

 ✓ api/lib/__tests__/sasapay-provider.test.ts (8 tests) 1063ms
 ✓ api/lib/__tests__/provider-registry.test.ts (8 tests) 930ms
 ✓ src/lib/budgets/__tests__/validation.test.ts (18 tests) 713ms
 ✓ src/pages/__tests__/Login.test.tsx (9 tests) 990ms
 ✓ api/lib/__tests__/airtel-money-provider.test.ts (13 tests) 827ms
 ✓ api/__tests__/account-subscription-context.test.ts (1 test) 1124ms
 ✓ src/pages/__tests__/business-details-profile.test.ts (2 tests) 752ms
 ✓ api/lib/__tests__/tax.test.ts (16 tests) 839ms
 ✓ api/__tests__/payroll.test.ts (4 tests) 842ms
 ✓ api/lib/__tests__/user-references.test.ts (8 tests) 803ms
 ✓ api/__tests__/future-date-validation.test.ts (9 tests) 805ms
 ✓ src/pages/__tests__/Home.test.tsx (8 tests) 1800ms
 ✓ src/features/reports/__tests__/chart-data.test.ts (4 tests) 1015ms
 ✓ api/lib/__tests__/accounting-foundations.test.ts (5 tests) 1025ms
 ✓ api/lib/__tests__/currency-converter.test.ts (9 tests) 799ms
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

 ✓ api/lib/__tests__/webhook-handler.test.ts (2 tests) 839ms
 ✓ api/__tests__/account-subscription-migration.test.ts (1 test) 837ms
 ✓ api/lib/__tests__/debt-classification.test.ts (7 tests) 703ms
 ✓ api/lib/__tests__/decimal.test.ts (12 tests) 722ms
 ✓ api/lib/__tests__/accounting-system-accounts.test.ts (1 test) 920ms
 ✓ src/components/pricing/__tests__/BillingCycleToggle.test.tsx (5 tests) 755ms
 ✓ api/__tests__/seed-demo-plan.test.ts (2 tests) 769ms
 ✓ api/__tests__/auth.test.ts (8 tests) 915ms
 ✓ src/components/landing/__tests__/RotatingHeadline.test.tsx (6 tests) 715ms
 ✓ api/__tests__/accounts.test.ts (5 tests) 785ms
 ✓ api/__tests__/partner-allocations-contract.test.ts (8 tests) 733ms
 ✓ db/__tests__/0013_user_locations_migration.test.ts (4 tests) 722ms
 ✓ api/lib/__tests__/currency-lock.test.ts (5 tests) 712ms
 ✓ e2e/__tests__/user-management-flow.test.ts (3 tests) 804ms
 ✓ src/components/landing/__tests__/AnimatedCounter.test.tsx (5 tests) 781ms
 ✓ api/lib/__tests__/schema-readiness.test.ts (2 tests) 733ms
 ✓ api/__tests__/partner-allocations-rights.test.ts (3 tests) 700ms
 ✓ api/__tests__/frontend-regressions.test.ts (4 tests) 1967ms
     ✓ exposes a default export for the Businesses page lazy route  1027ms
 ✓ api/lib/__tests__/transaction-logger.test.ts (2 tests) 825ms
 ✓ api/__tests__/users-create-values.test.ts (3 tests) 740ms
 ✓ src/features/reports/__tests__/report-scope.test.ts (3 tests) 793ms
 ✓ api/__tests__/business-documents-router-contract.test.ts (3 tests) 729ms
 ✓ e2e/__tests__/bills-cycle.test.ts (3 tests) 739ms
 ❯ api/__tests__/journal-and-sales.test.ts (0 test)
 ✓ e2e/__tests__/payroll-cycle.test.ts (2 tests) 914ms
 ✓ api/__tests__/business-logo-router-contract.test.ts (3 tests) 786ms
 ✓ src/features/business-profile/__tests__/BusinessLetterhead.test.tsx (1 test) 768ms
 ❯ api/__tests__/accounts-coa-integration.test.ts (0 test)
 ✓ api/__tests__/logo-validation.test.ts (4 tests) 1021ms
 ✓ src/features/business-profile/__tests__/logo-utils.test.ts (4 tests) 793ms
 ✓ api/__tests__/po-router.test.ts (2 tests) 739ms
 ✓ api/__tests__/server-runtime.test.ts (2 tests) 830ms
 ✓ api/__tests__/business-documents-utils.test.ts (3 tests) 721ms
 ✓ src/features/business-profile/__tests__/formatters.test.ts (3 tests) 733ms
 ❯ api/__tests__/account-subscription-enforcement.test.ts (0 test)
 ✓ e2e/__tests__/sales-cycle.test.ts (2 tests) 745ms
 ✓ api/__tests__/date-key.test.ts (2 tests) 734ms
 ✓ src/pages/__tests__/business-details-export.test.ts (1 test) 493ms

⎯⎯⎯⎯⎯⎯ Failed Suites 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/account-subscription-enforcement.test.ts [ api/__tests__/account-subscription-enforcement.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/account-subscription-enforcement.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/15]⎯

 FAIL  api/__tests__/accounts-coa-integration.test.ts [ api/__tests__/accounts-coa-integration.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/accounts-coa-integration.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/15]⎯

 FAIL  api/__tests__/expenses-dual-mode.test.ts [ api/__tests__/expenses-dual-mode.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/expenses-dual-mode.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/15]⎯

 FAIL  api/__tests__/journal-and-sales.test.ts [ api/__tests__/journal-and-sales.test.ts ]
Error: No test suite found in file /home/runner/work/finaflow/finaflow/api/__tests__/journal-and-sales.test.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/15]⎯


⎯⎯⎯⎯⎯⎯ Failed Tests 11 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > lists plans by year and filters by status
AssertionError: expected 0 to be greater than or equal to 1
 ❯ api/__tests__/budgets-router.test.ts:249:28
    247|
    248|     const listAll = await caller.budgets.listByYear({ year: 2025 });
    249|     expect(listAll.length).toBeGreaterThanOrEqual(1);
       |                            ^
    250|     expect(listAll.some((p) => p.id === sharedPlanId)).toBe(true);
    251|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/15]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > gets a single plan with buckets and enriched lines
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
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:267:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/15]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > updateLines replaces lines on one bucket and leaves others unchanged
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
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:281:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/15]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > updateLines does not change plan status
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
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:312:20

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/15]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > copyMonthlyBucket copies lines to target buckets
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
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:339:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/15]⎯

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
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:382:18

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/15]⎯

 FAIL  api/__tests__/budgets-router.test.ts > Budgets Router > activates, locks, and archives a plan in sequence
TRPCError: Budget plan not found or access denied
 ❯ requirePlanAccess api/budgets-router.ts:29:22
     27|   const locIdSql = sql.join(locIds.map((id) => sql`${id}`), sql`, `);
     28|   const [plan] = await db.select().from(budgetPlans).where(and(eq(budg…
     29|   if (!plan) { throw new TRPCError({ code: "NOT_FOUND", message: "Budg…
       |                      ^
     30|   return plan;
     31| }
 ❯ api/budgets-router.ts:198:18
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:409:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/15]⎯

 FAIL  api/__tests__/business-reset.test.ts > rpDr5A77MDGrZBABiXNLkExAbJSbnaUkqJ > clears all transactional data while preserving setup records
 FAIL  api/__tests__/business-reset.test.ts > rpDr5A77MDGrZBABiXNLkExAbJSbnaUkqJ > preserves all immutable records after reset
 FAIL  api/__tests__/business-reset.test.ts > rpDr5A77MDGrZBABiXNLkExAbJSbnaUkqJ > validatePreReset returns valid state for a business with data
 FAIL  api/__tests__/business-reset.test.ts > rpDr5A77MDGrZBABiXNLkExAbJSbnaUkqJ > createResetSnapshot captures accurate pre-reset record counts
Error: Failed query: delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0
params: 
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
    444|   await db.delete(bills).where(eq(bills.businessId, business.id));
    445|   // Delete budget bucket lines first (FK references expenseCategories…
    446|   await db.delete(budgetBucketLines).where(sql`${budgetBucketLines.id}…
       |   ^
    447|   await db.delete(budgetPlanBuckets).where(sql`${budgetPlanBuckets.id}…
    448|   await db.delete(budgetPlans).where(sql`${budgetPlans.id} > 0`);
 ❯ api/__tests__/business-reset.test.ts:479:9

Caused by: error: relation "budget_bucket_lines" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 118, severity: 'ERROR', code: '42P01', detail: undefined, hint: undefined, position: '13', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'parserOpenTable' }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/15]⎯


 Test Files  6 failed | 71 passed (77)
      Tests  11 failed | 529 passed (540)
   Start at  07:11:42
   Duration  45.98s (transform 5.06s, setup 20.15s, import 16.51s, tests 77.58s, environment 12ms)


Error: AssertionError: expected 0 to be greater than or equal to 1
 ❯ api/__tests__/budgets-router.test.ts:249:28



Error: TRPCError: Budget plan not found or access denied
 ❯ requirePlanAccess api/budgets-router.ts:29:22
 ❯ api/budgets-router.ts:126:20
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:267:18

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
 ❯ api/__tests__/budgets-router.test.ts:281:18

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
 ❯ api/__tests__/budgets-router.test.ts:312:20

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
 ❯ api/__tests__/budgets-router.test.ts:339:18

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


Error: TRPCError: Budget plan not found or access denied
 ❯ requirePlanAccess api/budgets-router.ts:29:22
 ❯ api/budgets-router.ts:198:18
 ❯ resolveMiddleware node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:576:21
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ callRecursive node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:642:19
 ❯ procedure node_modules/@trpc/server/src/unstable-core-do-not-import/procedureBuilder.ts:682:19
 ❯ node_modules/@trpc/server/src/unstable-core-do-not-import/router.ts:474:19
 ❯ api/__tests__/budgets-router.test.ts:409:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'NOT_FOUND' }


Error: Error: Failed query: delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0
params: 
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0', params: [] }
Caused by: Caused by: error: relation "budget_bucket_lines" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 118, severity: 'ERROR', code: '42P01', detail: undefined, hint: undefined, position: '13', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'parserOpenTable' }


Error: Error: Failed query: delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0
params: 
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0', params: [] }
Caused by: error: relation "budget_bucket_lines" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 118, severity: 'ERROR', code: '42P01', detail: undefined, hint: undefined, position: '13', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'parserOpenTable' }


Error: Error: Failed query: delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0
params: 
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0', params: [] }
Caused by: error: relation "budget_bucket_lines" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 118, severity: 'ERROR', code: '42P01', detail: undefined, hint: undefined, position: '13', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'parserOpenTable' }


Error: Error: Failed query: delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0
params: 
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'delete from "budget_bucket_lines" where "budget_bucket_lines"."id" > 0', params: [] }
Caused by: error: relation "budget_bucket_lines" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:446:3
 ❯ api/__tests__/business-reset.test.ts:479:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 118, severity: 'ERROR', code: '42P01', detail: undefined, hint: undefined, position: '13', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'parserOpenTable' }

Error: Process completed with exit code 1.
0s
0s
1s
