Run npm run test -- --coverage

> my-app@0.0.0 test
> vitest run --coverage


 RUN  v4.1.6 /home/runner/work/finaflow/finaflow
      Coverage enabled with v8

 ❯ api/__tests__/subscriptions.test.ts (4 tests | 4 skipped) 456ms
     ↓ returns the full subscription matrix for the current business
     ↓ extends a trial once and blocks a second extension
     ↓ downgrades expired trials without a payment method and creates notifications
     ↓ converts expired paid trials into active subscriptions
 ❯ api/__tests__/local-auth-registration.test.ts (5 tests | 5 skipped) 451ms
     ↓ registers, creates linked rows, and issues auth cookies
     ↓ logs in successfully after registration and issues fresh auth cookies
     ↓ treats an exact retry as success instead of creating duplicates
     ↓ rejects duplicate username and duplicate email for a different signup
     ↓ rolls back user creation when downstream account creation fails
 ❯ api/__tests__/local-auth-scope.test.ts (12 tests | 12 failed) 952ms
     × registers and creates both customer_accounts and accountRefId on user/business 49ms
     × logs in using accountId on user row (new-style) 41ms
     × logs in using accountRefId on user row (legacy-style, no accountId) 45ms
     × rejects login with wrong password 27ms
     × rejects login for non-existent account 24ms
     × checks account availability correctly 27ms
     × rejects short account names in availability check 29ms
     × looks up account and returns associated users 50ms
     × fails lookup for non-existent account 71ms
     × sets currentBusinessId and accountRefId on login 35ms
     × me endpoint returns authenticated user with correct scope 31ms
     × seedDefaults creates working demo account with accountRefId 29ms
 ✓ api/__tests__/account-subscription-context.test.ts (1 test) 166ms
 ✓ api/__tests__/account-subscription-enforcement.test.ts (2 tests) 146ms
 ✓ api/lib/__tests__/tax.test.ts (16 tests) 187ms
 ✓ src/pages/__tests__/business-details-profile.test.ts (2 tests) 284ms
 ✓ api/__tests__/payroll.test.ts (4 tests) 208ms
 ✓ src/features/reports/__tests__/chart-data.test.ts (4 tests) 185ms
 ✓ api/__tests__/future-date-validation.test.ts (9 tests) 61ms
 ✓ api/lib/__tests__/decimal.test.ts (12 tests) 205ms
 ✓ api/__tests__/account-subscription-migration.test.ts (1 test) 100ms
 ✓ api/__tests__/seed-demo-plan.test.ts (2 tests) 195ms
 ✓ api/__tests__/auth.test.ts (8 tests) 282ms
 ✓ api/__tests__/accounts.test.ts (5 tests) 201ms
 ✓ api/__tests__/partner-allocations-contract.test.ts (8 tests) 73ms
 ✓ api/__tests__/partner-allocations-rights.test.ts (3 tests) 72ms
 ✓ api/__tests__/business-documents-router-contract.test.ts (3 tests) 58ms
 ✓ api/__tests__/frontend-regressions.test.ts (4 tests) 1084ms
     ✓ exposes a default export for the Businesses page lazy route  818ms
 ✓ api/__tests__/business-logo-router-contract.test.ts (3 tests) 72ms
 ✓ api/__tests__/logo-validation.test.ts (4 tests) 175ms
 ✓ src/features/business-profile/__tests__/BusinessLetterhead.test.tsx (1 test) 234ms
 ✓ src/features/business-profile/__tests__/logo-utils.test.ts (4 tests) 197ms
 ✓ api/__tests__/server-runtime.test.ts (2 tests) 188ms
 ✓ api/__tests__/po-router.test.ts (2 tests) 55ms
 ✓ api/__tests__/business-documents-utils.test.ts (3 tests) 165ms
 ✓ src/features/business-profile/__tests__/formatters.test.ts (3 tests) 199ms
 ✓ api/__tests__/users-create-values.test.ts (1 test) 66ms
 ✓ api/__tests__/date-key.test.ts (2 tests) 158ms
 ✓ src/pages/__tests__/business-details-export.test.ts (1 test) 115ms

⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/local-auth-registration.test.ts [ api/__tests__/local-auth-registration.test.ts ]
 FAIL  api/__tests__/subscriptions.test.ts [ api/__tests__/subscriptions.test.ts ]
error: duplicate key value violates unique constraint "pg_type_typname_nsp_index"
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ ensureTestDatabase api/test/setup.ts:76:7
     74|
     75|       const sql = fs.readFileSync(migrationPath, "utf8").replaceAll("-…
     76|       await testPool.query(sql);
       |       ^
     77|     }
     78|   } finally {
 ❯ api/test/setup.ts:88:3

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/26]⎯


⎯⎯⎯⎯⎯⎯ Failed Tests 12 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > registers and creates both customer_accounts and accountRefId on user/business
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > checks account availability correctly
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects short account names in availability check
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
     33|   const db = getDb();
     34|
     35|   const matchingUsers = await db.select().from(users).where(
       |                         ^
     36|     and(
     37|       or(
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/26]⎯

 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > registers and creates both customer_accounts and accountRefId on user/business
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountId on user row (new-style)
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > logs in using accountRefId on user row (legacy-style, no accountId)
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login with wrong password
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects login for non-existent account

 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > checks account availability correctly
 Test Files  3 failed | 27 passed (30)
      Tests  12 failed | 110 passed | 9 skipped (131)
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > rejects short account names in availability check
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > looks up account and returns associated users
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > fails lookup for non-existent account
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > sets currentBusinessId and accountRefId on login
 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > me endpoint returns authenticated user with correct scope
   Start at  06:45:20
   Duration  9.05s (transform 2.40s, setup 2.38s, import 8.16s, tests 6.99s, environment 6ms)

 FAIL  api/__tests__/local-auth-scope.test.ts > Local Auth - Account/Business Scope Separation > seedDefaults creates working demo account with accountRefId
Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)

Error: error: duplicate key value violates unique constraint "pg_type_typname_nsp_index"
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ ensureTestDatabase api/test/setup.ts:76:7
 ❯ api/test/setup.ts:88:3

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 246, severity: 'ERROR', code: '23505', detail: 'Key (typname, typnamespace)=(action, 2200) already exists.', hint: undefined, position: undefined, internalPosition: undefined, internalQuery: undefined, where: undefined, schema: 'pg_catalog', table: 'pg_type', dataType: undefined, constraint: 'pg_type_typname_nsp_index', file: 'nbtinsert.c', routine: '_bt_check_unique' }

params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
     33|   const db = getDb();
     34|
     35|   const matchingUsers = await db.select().from(users).where(
       |                         ^
     36|     and(
     37|       or(
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/26]⎯


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:110:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: Error: Failed query: select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)
params: SCOPETEST1,-1
 ❯ NodePgPreparedQuery.queryWithCache node_modules/src/pg-core/session.ts:73:10
 ❯ node_modules/src/node-postgres/session.ts:154:18
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { query: 'select "id", "unionId", "username", "passwordHash", "name", "email", "avatar", "role", "userType", "phone", "locationId", "currentBusinessId", "accountId", "accountRefId", "isActive", "createdAt", "updatedAt", "lastSignInAt", "deletedAt" from "users" where (("users"."accountId" = $1 or "users"."accountRefId" = $2) and "users"."deletedAt" is null)', params: [ 'SCOPETEST1', -1 ] }
Caused by: error: column "userType" does not exist
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ node_modules/drizzle-orm/node-postgres/session.js:124:18
 ❯ NodePgPreparedQuery.queryWithCache node_modules/drizzle-orm/pg-core/session.js:39:16
 ❯ node_modules/drizzle-orm/node-postgres/session.js:117:22
 ❯ cleanupAccount api/__tests__/local-auth-scope.test.ts:35:25
 ❯ api/__tests__/local-auth-scope.test.ts:115:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 169, severity: 'ERROR', code: '42703', detail: undefined, hint: 'Perhaps you meant to reference the column "users.username".', position: '88', internalPosition: undefined, internalQuery: undefined, where: undefined, schema: undefined, table: undefined, dataType: undefined, constraint: undefined, file: 'parse_relation.c', routine: 'errorMissingColumn' }


Error: error: duplicate key value violates unique constraint "pg_type_typname_nsp_index"
 ❯ node_modules/pg-pool/index.js:45:11
 ❯ ensureTestDatabase api/test/setup.ts:76:7
 ❯ api/test/setup.ts:88:3

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { length: 246, severity: 'ERROR', code: '23505', detail: 'Key (typname, typnamespace)=(action, 2200) already exists.', hint: undefined, position: undefined, internalPosition: undefined, internalQuery: undefined, where: undefined, schema: 'pg_catalog', table: 'pg_type', dataType: undefined, constraint: 'pg_type_typname_nsp_index', file: 'nbtinsert.c', routine: '_bt_check_unique' }

Error: Process completed with exit code 1.
0s
0s
2s
