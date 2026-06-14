Run npm run test -- --coverage

> my-app@1.0.0 test
> vitest run --coverage


 RUN  v4.1.6 /home/runner/work/finaflow/finaflow
      Coverage enabled with v8

 ❯ api/__tests__/business-reset.test.ts (9 tests | 1 failed) 2432ms
     ✓ clears all transactional data while preserving setup records 289ms
     ✓ preserves all immutable records after reset 145ms
     ✓ validatePreReset returns valid state for a business with data 96ms
     ✓ createResetSnapshot captures accurate pre-reset record counts 94ms
     ✓ returns complete result structure with per-table counts 111ms
     ✓ handles businesses with multiple locations 60ms
     ✓ completes successfully even when no locations exist 18ms
     × clears payroll periods, entries, and advances 113ms
     ✓ clears budgets, purchase orders, and recurring bill templates 223ms
 ✓ api/__tests__/wallet-router.test.ts (19 tests) 1362ms
 ✓ api/__tests__/expenses-dual-mode.test.ts (17 tests) 2532ms
 ✓ api/__tests__/budgets-router.test.ts (17 tests) 1377ms
 ✓ api/__tests__/recurring-bills-isolation.test.ts (12 tests) 991ms
 ✓ api/__tests__/posted-delete-guards.test.ts (4 tests) 1103ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.listUsers returns only users from caller's account
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
    detail: 'Failing row contains (41, 54, 55, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:18.998603, 2026-06-14 15:36:18.998603, null).',
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
    detail: 'Failing row contains (42, 55, 56, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.046349, 2026-06-14 15:36:19.046349, null).',
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
    detail: 'Failing row contains (43, 56, 57, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.159197, 2026-06-14 15:36:19.159197, null).',
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
    detail: 'Failing row contains (44, 57, 58, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.307807, 2026-06-14 15:36:19.307807, null).',
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
[login] customerAccount: id=4

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
[login] business: id=57

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.listUsers prevents cross-account visibility
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
    detail: 'Failing row contains (45, 58, 59, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.437747, 2026-06-14 15:36:19.437747, null).',
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
    detail: 'Failing row contains (46, 59, 60, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.532492, 2026-06-14 15:36:19.532492, null).',
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
    detail: 'Failing row contains (47, 60, 61, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.547429, 2026-06-14 15:36:19.547429, null).',
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
[login] customerAccount: id=7

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
[login] business: id=60

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
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
    detail: 'Failing row contains (48, 61, 62, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.753527, 2026-06-14 15:36:19.753527, null).',
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
[login] customerAccount: id=8

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
[login] business: id=61

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.list returns only users from caller's account
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
    detail: 'Failing row contains (49, 62, 63, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.822617, 2026-06-14 15:36:19.822617, null).',
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

 ✓ api/lib/__tests__/notification-lifecycle.test.ts (21 tests) 1031ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.list returns only users from caller's account
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
    detail: 'Failing row contains (50, 63, 64, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.895204, 2026-06-14 15:36:19.895204, null).',
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

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] attempt accountId="NONEXISTENT999" username="nobody"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] customerAccount: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
[login] business: null

stderr | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > checks account availability correctly
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
    detail: 'Failing row contains (51, 64, 65, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:19.967385, 2026-06-14 15:36:19.967385, null).',
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
    length: 388,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (52, 65, 66, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.13403, 2026-06-14 15:36:20.13403, null).',
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
params: 66,67,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
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
      at seedBusinessAccounting (/home/runner/work/finaflow/finaflow/api/lib/business-provisioning.ts:103:3)
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:657:9
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18) {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (53, 66, 67, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.210094, 2026-06-14 15:36:20.210094, null).',
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
params: 67,68,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    68,
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
    detail: 'Failing row contains (54, 67, 68, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.225233, 2026-06-14 15:36:20.225233, null).',
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
[lookupAccount] customerAccount found: id=14

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
[lookupAccount] business found: id=67, name="Scope Test Business"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] input.accountId="NOTEXIST" normalized="NOTEXIST"

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] customerAccount found: null

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
[lookupAccount] business found: null

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.get returns user from own account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 68,69,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    detail: 'Failing row contains (55, 68, 69, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.439261, 2026-06-14 15:36:20.439261, null).',
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
params: 69,70,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    detail: 'Failing row contains (56, 69, 70, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.451903, 2026-06-14 15:36:20.451903, null).',
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
[login] customerAccount: id=16

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
[login] business: id=69

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.get returns user from own account
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 70,71,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    detail: 'Failing row contains (57, 70, 71, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.508627, 2026-06-14 15:36:20.508627, null).',
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
params: 71,72,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    detail: 'Failing row contains (58, 71, 72, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.648661, 2026-06-14 15:36:20.648661, null).',
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
[login] customerAccount: id=18

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
[login] business: id=71

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.update rejects cross-account update
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 72,73,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    detail: 'Failing row contains (59, 72, 73, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.738569, 2026-06-14 15:36:20.738569, null).',
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
params: 73,74,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
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
    detail: 'Failing row contains (60, 73, 74, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.803758, 2026-06-14 15:36:20.803758, null).',
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
params: 74,75,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13
    at /home/runner/work/finaflow/finaflow/api/__tests__/local-auth-scope.test.ts:312:20
    at file:///home/runner/work/finaflow/finaflow/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    74,
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
      at /home/runner/work/finaflow/finaflow/api/local-auth-router.ts:794:7
      at resolveMiddleware (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:221:17)
      at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
      at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
      at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
    length: 390,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (61, 74, 75, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:20.857575, 2026-06-14 15:36:20.857575, null).',
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
[login] customerAccount: id=21

stdout | api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
[login] business: id=74

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.delete rejects cross-account delete
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
    detail: 'Failing row contains (62, 75, 77, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:21.020095, 2026-06-14 15:36:21.020095, null).',
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
params: 76,78,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    76,
    78,
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
    detail: 'Failing row contains (63, 76, 78, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:21.07003, 2026-06-14 15:36:21.07003, null).',
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

 ✓ api/__tests__/local-auth-scope.test.ts (12 tests) 2935ms
     ✓ registers and creates both customer_accounts and accountRefId on user/business  353ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > users.changePassword rejects cross-account change
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
    length: 388,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (64, 77, 79, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:21.28382, 2026-06-14 15:36:21.28382, null).',
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
params: 78,80,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    78,
    80,
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
    detail: 'Failing row contains (65, 78, 80, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:21.380584, 2026-06-14 15:36:21.380584, null).',
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

 ✓ src/lib/budgets/__tests__/rollups.test.ts (19 tests) 963ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > permissions.updateUserRole rejects cross-account role update
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 79,81,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    79,
    81,
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
    detail: 'Failing row contains (66, 79, 81, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:21.657241, 2026-06-14 15:36:21.657241, null).',
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
    detail: 'Failing row contains (67, 80, 82, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:21.740694, 2026-06-14 15:36:21.740694, null).',
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

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.get returns null for business from another account
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
    detail: 'Failing row contains (68, 81, 83, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:22.023834, 2026-06-14 15:36:22.023834, null).',
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

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.get returns null for business from another account
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
    detail: 'Failing row contains (69, 82, 84, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:22.096131, 2026-06-14 15:36:22.096131, null).',
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

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.members rejects cross-account access
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 83,85,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    83,
    85,
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
    detail: 'Failing row contains (70, 83, 85, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:22.356497, 2026-06-14 15:36:22.356497, null).',
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

stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.members rejects cross-account access
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 84,86,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    84,
    86,
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
    detail: 'Failing row contains (71, 84, 86, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:22.434571, 2026-06-14 15:36:22.434571, null).',
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

 ✓ db/__tests__/0014_budget_plan_model_migration.test.ts (25 tests) 1002ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > businesses.addMember rejects cross-account user addition
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 85,87,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    85,
    87,
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
    detail: 'Failing row contains (72, 85, 87, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:22.785237, 2026-06-14 15:36:22.785237, null).',
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
params: 86,88,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    86,
    88,
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
    detail: 'Failing row contains (73, 86, 88, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:22.920916, 2026-06-14 15:36:22.920916, null).',
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
params: 87,89,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    87,
    89,
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
    detail: 'Failing row contains (74, 87, 89, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:23.294446, 2026-06-14 15:36:23.294446, null).',
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
params: 88,90,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    88,
    90,
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
    detail: 'Failing row contains (75, 88, 90, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:23.386063, 2026-06-14 15:36:23.386063, null).',
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
params: 89,91,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    89,
    91,
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
    detail: 'Failing row contains (76, 89, 91, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:23.67329, 2026-06-14 15:36:23.67329, null).',
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
params: 90,92,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    90,
    92,
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
    detail: 'Failing row contains (77, 90, 92, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:23.746447, 2026-06-14 15:36:23.746447, null).',
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
params: 91,93,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    91,
    93,
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
    detail: 'Failing row contains (78, 91, 93, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:23.868171, 2026-06-14 15:36:23.868171, null).',
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
params: 93,95,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    93,
    95,
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
    detail: 'Failing row contains (80, 93, 95, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:24.134237, 2026-06-14 15:36:24.134237, null).',
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

 ✓ api/__tests__/notification-bill-clearance.test.ts (4 tests) 1499ms
stderr | api/__tests__/cross-account-isolation.test.ts > Cross-Account Data Isolation > rejects unauthenticated access to user endpoints
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 94,96,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    94,
    96,
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
    detail: 'Failing row contains (81, 94, 96, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:24.222599, 2026-06-14 15:36:24.222599, null).',
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

 ✓ api/__tests__/cross-account-isolation.test.ts (15 tests) 6374ms
     ✓ permissions.listUsers returns only users from caller's account  533ms
     ✓ permissions.listUsers prevents cross-account visibility  380ms
     ✓ users.list returns only users from caller's account  310ms
     ✓ users.get returns null for user from another account  320ms
     ✓ users.changePassword rejects cross-account change  357ms
     ✓ permissions.updateUserRole rejects cross-account role update  371ms
     ✓ businesses.get returns null for business from another account  329ms
     ✓ businesses.members rejects cross-account access  402ms
     ✓ businesses.addMember rejects cross-account user addition  531ms
     ✓ businesses.removeMember rejects cross-account access  375ms
     ✓ new account can only access its own user data  474ms
     ✓ rejects unauthenticated access to user endpoints  341ms
 ✓ api/__tests__/journal-and-sales.test.ts (2 tests) 1248ms
stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > registers, creates linked rows, and issues auth cookies
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 97,99,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    97,
    99,
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
    detail: 'Failing row contains (83, 97, 99, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:26.571718, 2026-06-14 15:36:26.571718, null).',
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

 ✓ api/__tests__/notification-scope.test.ts (1 test) 982ms
stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > logs in successfully after registration and issues fresh auth cookies
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 100,102,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    100,
    102,
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
    detail: 'Failing row contains (84, 100, 102, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:26.81765, 2026-06-14 15:36:26.81765, null).',
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
[login] business: id=100

stderr | api/__tests__/local-auth-registration.test.ts > Local Auth Registration > treats an exact retry as success instead of creating duplicates
[register] seedAccountingData failed DrizzleQueryError: Failed query: insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing
params: 101,103,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    101,
    103,
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
    length: 392,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (85, 101, 103, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:27.034099, 2026-06-14 15:36:27.034099, null).',
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
params: 102,104,Food Supplies,Ingredients and raw materials,#C73E1D,cogs,
    at NodePgPreparedQuery.queryWithCache (file:///home/runner/work/finaflow/finaflow/node_modules/drizzle-orm/pg-core/session.js:41:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at seedAccountingData (/home/runner/work/finaflow/finaflow/db/seed-accounting.ts:138:5)
    ... 4 lines matching cause stack trace ...
    at callRecursive (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:256:18)
    at procedure (file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/initTRPC-BRf4imah.mjs:281:18)
    at file:///home/runner/work/finaflow/finaflow/node_modules/@trpc/server/dist/tracked-DWInO6EQ.mjs:307:13 {
  query: 'insert into "expense_categories" ("id", "businessId", "locationId", "name", "description", "color", "accountingClass", "defaultAccountId", "externalAccountCode", "externalSystem", "isActive", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, $4, $5, $6, $7, default, default, default, default, default, default) on conflict do nothing',
  params: [
    102,
    104,
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
    length: 392,
    severity: 'ERROR',
    code: '23502',
    detail: 'Failing row contains (86, 102, 104, Food Supplies, Ingredients and raw materials, #C73E1D, cogs, null, null, null, t, 2026-06-14 15:36:27.219095, 2026-06-14 15:36:27.219095, null).',
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

 ✓ api/__tests__/local-auth-registration.test.ts (5 tests) 2022ms
     ✓ registers, creates linked rows, and issues auth cookies  333ms
stderr | api/__tests__/subscriptions.test.ts > Subscription lifecycle > downgrades expired trials without a payment method and creates notifications
[email] SMTP not configured; skipping outbound email {
  to: 'expireco@example.com',
  subject: 'EXPIRECO Business has been downgraded to Free'
}

 ✓ api/__tests__/subscriptions.test.ts (4 tests) 1460ms
 ✓ api/__tests__/user-location-enforcement.test.ts (4 tests) 1023ms
 ✓ api/lib/__tests__/mpesa-provider.test.ts (24 tests) 772ms
 ✓ src/lib/budgets/__tests__/period.test.ts (26 tests) 739ms
 ✓ api/__tests__/accounts-coa-integration.test.ts (3 tests) 1025ms
 ✓ e2e/__tests__/user-multi-location-flow.test.ts (1 test) 1072ms
 ✓ api/__tests__/account-subscription-enforcement.test.ts (2 tests) 890ms
 ✓ src/components/pricing/__tests__/PricingCard.test.tsx (11 tests) 875ms
 ✓ db/__tests__/0009_wallet_migration.test.ts (19 tests) 816ms
 ✓ src/lib/__tests__/currency.test.ts (27 tests) 758ms
 ✓ src/components/pricing/__tests__/ChangeablePricingSection.test.tsx (9 tests) 793ms
 ✓ api/__tests__/user-deletion-flow.test.ts (4 tests) 1009ms
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

 ✓ api/lib/__tests__/sasapay-provider.test.ts (8 tests) 831ms
 ✓ api/lib/__tests__/provider-registry.test.ts (8 tests) 776ms
 ✓ src/lib/budgets/__tests__/validation.test.ts (18 tests) 893ms
 ✓ src/pages/__tests__/Login.test.tsx (9 tests) 892ms
 ✓ api/__tests__/account-subscription-context.test.ts (1 test) 830ms
 ✓ api/lib/__tests__/airtel-money-provider.test.ts (13 tests) 817ms
 ✓ api/lib/__tests__/tax.test.ts (16 tests) 714ms
 ✓ src/pages/__tests__/business-details-profile.test.ts (2 tests) 784ms
 ✓ api/__tests__/payroll.test.ts (4 tests) 870ms
 ✓ api/__tests__/future-date-validation.test.ts (9 tests) 1003ms
 ✓ api/lib/__tests__/user-references.test.ts (8 tests) 803ms
 ✓ api/lib/__tests__/accounting-foundations.test.ts (5 tests) 715ms
 ✓ src/pages/__tests__/Home.test.tsx (8 tests) 1833ms
 ✓ src/features/reports/__tests__/chart-data.test.ts (4 tests) 839ms
 ✓ api/lib/__tests__/currency-converter.test.ts (9 tests) 778ms
 ✓ api/__tests__/account-subscription-migration.test.ts (1 test) 767ms
stderr | api/lib/__tests__/webhook-handler.test.ts > handleWalletWebhook > returns 200 for processed webhook
[WebhookHandler] Failed to log transaction: DrizzleQueryError: Failed query: insert into "mobile_wallet_transactions" ("id", "locationId", "provider", "provider_txn_id", "provider_ref", "txnDate", "txnTime", "txn_type", "direction", "partyName", "party_identifier", "amount", "currency", "txnFee", "balance", "description", "rawText", "raw_payload", "status", "is_reconciled", "is_linked", "linkedExpenseId", "linkedBillId", "linkedSupplierId", "sourceAccountId", "destinationAccountId", "importedBy", "base_currency", "base_amount", "conversion_rate", "createdAt", "updatedAt", "deletedAt") values (default, $1, $2, $3, default, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, default, default, default, default, default, default, $20, $21, default, default, default, default) returning "id"
params: 0,webhook_mock,WHK123,2026-06-14,,payment,in,,,500.00,KES,0.00,,,,{"rawBody":"{\"event\":\"payment\",\"amount\":500}"},completed,false,false,,
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
    '2026-06-14',
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

 ✓ api/lib/__tests__/webhook-handler.test.ts (2 tests) 1014ms
 ✓ api/lib/__tests__/debt-classification.test.ts (7 tests) 821ms
 ✓ src/components/pricing/__tests__/BillingCycleToggle.test.tsx (5 tests) 757ms
 ✓ api/lib/__tests__/decimal.test.ts (12 tests) 757ms
 ✓ api/lib/__tests__/accounting-system-accounts.test.ts (1 test) 869ms
 ✓ api/__tests__/auth.test.ts (8 tests) 768ms
 ✓ api/__tests__/seed-demo-plan.test.ts (2 tests) 842ms
 ✓ api/__tests__/accounts.test.ts (5 tests) 714ms
 ✓ src/components/landing/__tests__/RotatingHeadline.test.tsx (6 tests) 734ms
 ✓ db/__tests__/0013_user_locations_migration.test.ts (4 tests) 834ms
 ✓ api/__tests__/partner-allocations-contract.test.ts (8 tests) 802ms
 ✓ src/components/landing/__tests__/AnimatedCounter.test.tsx (5 tests) 741ms
 ✓ api/lib/__tests__/currency-lock.test.ts (5 tests) 781ms
 ❯ e2e/__tests__/user-management-flow.test.ts (3 tests | 1 failed) 723ms
     ✓ builds an employee username from first name 3ms
     ✓ uses biz-abbr_fallback when first name is taken 0ms
     × formats the blocked-deletion message with a disable fallback hint 9ms
 ✓ api/__tests__/frontend-regressions.test.ts (4 tests) 1790ms
     ✓ exposes a default export for the Businesses page lazy route  933ms
 ✓ api/lib/__tests__/schema-readiness.test.ts (2 tests) 835ms
 ✓ api/__tests__/partner-allocations-rights.test.ts (3 tests) 860ms
 ✓ api/lib/__tests__/transaction-logger.test.ts (2 tests) 879ms
 ✓ src/features/reports/__tests__/report-scope.test.ts (3 tests) 832ms
 ✓ api/__tests__/users-create-values.test.ts (3 tests) 777ms
 ✓ e2e/__tests__/bills-cycle.test.ts (3 tests) 800ms
 ✓ api/__tests__/business-documents-router-contract.test.ts (3 tests) 724ms
 ✓ api/__tests__/business-logo-router-contract.test.ts (3 tests) 719ms
 ✓ api/__tests__/logo-validation.test.ts (4 tests) 687ms
 ✓ e2e/__tests__/payroll-cycle.test.ts (2 tests) 814ms
 ✓ src/features/business-profile/__tests__/BusinessLetterhead.test.tsx (1 test) 784ms
 ✓ src/features/business-profile/__tests__/logo-utils.test.ts (4 tests) 833ms
 ✓ api/__tests__/server-runtime.test.ts (2 tests) 772ms
 ✓ api/__tests__/po-router.test.ts (2 tests) 678ms
 ✓ api/__tests__/business-documents-utils.test.ts (3 tests) 784ms
 ✓ src/features/business-profile/__tests__/formatters.test.ts (3 tests) 762ms
 ✓ e2e/__tests__/sales-cycle.test.ts (2 tests) 711ms
 ✓ api/__tests__/date-key.test.ts (2 tests) 822ms
 ✓ src/pages/__tests__/business-details-export.test.ts (1 test) 571ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/business-reset.test.ts > rpDr5A77MDGrZBABiXNLkExAbJSbnaUkqJ > clears payroll periods, entries, and advances
Error: Failed query: delete from "expense_categories" where "expense_categories"."businessId" = $1
params: 8
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:443:3
    441|   await db.delete(bills).where(eq(bills.businessId, business.id));
    442|   // Delete expense_categories FIRST (FK references accounts.id via de…
    443|   await db.delete(expenseCategories).where(eq(expenseCategories.busine…
       |   ^
    444|   await db.delete(accounts).where(eq(accounts.businessId, business.id)…
    445|   // Also clean up accounts with only locationId (no businessId)
 ❯ api/__tests__/business-reset.test.ts:471:9

Caused by: error: update or delete on table "expense_categories" violates foreign key constraint "budget_bucket_lines_categoryId_fkey" on table "budget_bucket_lines"
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:443:3
 ❯ api/__tests__/business-reset.test.ts:471:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 350, severity: 'ERROR', code: '23503', detail: 'Key (id)=(6) is still referenced from table "budget_bucket_lines".', hint: undefined, position: undefined, internalPosition: undefined, internalQuery: undefined, where: undefined, schema: 'public', table: 'budget_bucket_lines', dataType: undefined, constraint: 'budget_bucket_lines_categoryId_fkey', file: 'ri_triggers.c', routine: 'ri_ReportViolation' }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  e2e/__tests__/user-management-flow.test.ts > Business owner user management flow > formats the blocked-deletion message with a disable fallback hint
AssertionError: expected 'This user cannot be deleted because h…' to contain 'disable'

- Expected
+ Received

- disable
+ This user cannot be deleted because historical records still reference the account.
+
+ Blocking records:
+ - Sales (2)
+ - Expenses (1)
+
+ Informational records:
+ - Refresh Tokens (1)
+
+ Disable the account instead if you need to stop access without losing history.

 ❯ e2e/__tests__/user-management-flow.test.ts:38:21
     36|     });
     37|
     38|     expect(message).toContain("disable");
       |                     ^
     39|     expect(message).toContain("Sales (2)");
     40|     expect(message).toContain("Expenses (1)");

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  2 failed | 75 passed (77)
      Tests  2 failed | 562 passed (564)
   Start at  15:36:11
   Duration  47.36s (transform 4.27s, setup 19.11s, import 17.96s, tests 80.82s, environment 10ms)


Error: Error: Failed query: delete from "expense_categories" where "expense_categories"."businessId" = $1
params: 8
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:443:3
 ❯ api/__tests__/business-reset.test.ts:471:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'delete from "expense_categories" where "expense_categories"."businessId" = $1', params: [ 8 ] }
Caused by: Caused by: error: update or delete on table "expense_categories" violates foreign key constraint "budget_bucket_lines_categoryId_fkey" on table "budget_bucket_lines"
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:113:20
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ cleanupResetContext api/__tests__/business-reset.test.ts:443:3
 ❯ api/__tests__/business-reset.test.ts:471:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 350, severity: 'ERROR', code: '23503', detail: 'Key (id)=(6) is still referenced from table "budget_bucket_lines".', hint: undefined, position: undefined, internalPosition: undefined, internalQuery: undefined, where: undefined, schema: 'public', table: 'budget_bucket_lines', dataType: undefined, constraint: 'budget_bucket_lines_categoryId_fkey', file: 'ri_triggers.c', routine: 'ri_ReportViolation' }


Error: AssertionError: expected 'This user cannot be deleted because h…' to contain 'disable'

- Expected
+ Received

- disable
+ This user cannot be deleted because historical records still reference the account.
+
+ Blocking records:
+ - Sales (2)
+ - Expenses (1)
+
+ Informational records:
+ - Refresh Tokens (1)
+
+ Disable the account instead if you need to stop access without losing history.

 ❯ e2e/__tests__/user-management-flow.test.ts:38:21


Error: Process completed with exit code 1.
0s
1s
0s
