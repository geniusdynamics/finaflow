13s
21s
Run npm run typecheck

> my-app@0.0.0 typecheck
> tsc -b

Error: api/alerts-router.ts(55,72): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.
Error: api/bills-router.ts(43,23): error TS18048: 'input' is possibly 'undefined'.
Error: api/bills-router.ts(43,41): error TS18048: 'input' is possibly 'undefined'.
Error: api/bills-router.ts(44,99): error TS18048: 'input' is possibly 'undefined'.
Error: api/bills-router.ts(100,20): error TS2454: Variable 'billId' is used before being assigned.
Error: api/bills-router.ts(163,20): error TS2454: Variable 'paymentId' is used before being assigned.
Error: api/bills-router.ts(306,55): error TS2322: Type 'Date' is not assignable to type 'string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | undefined'.
Error: api/bills-router.ts(318,16): error TS2454: Variable 'billId' is used before being assigned.
Error: api/daily-sales-router.ts(168,20): error TS2454: Variable 'saleId' is used before being assigned.
Error: api/expenses-router.ts(74,104): error TS2304: Cannot find name 'id'.
Error: api/expenses-router.ts(93,23): error TS18048: 'input' is possibly 'undefined'.
Error: api/expenses-router.ts(93,41): error TS18048: 'input' is possibly 'undefined'.
Error: api/expenses-router.ts(94,109): error TS18048: 'input' is possibly 'undefined'.
Error: api/expenses-router.ts(203,20): error TS2454: Variable 'expenseId' is used before being assigned.
Error: api/feedback-router.ts(11,44): error TS2339: Property 'deletedAt' does not exist on type 'PgTableWithColumns<{ name: "feedback_questionnaires"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "feedback_questionnaires"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; ... 8 more ...; generated: undefined; }, {}, {}>; ... 5 more ...; createdAt: PgColumn<......'.
Error: api/feedback-router.ts(67,53): error TS2353: Object literal may only specify known properties, and 'deletedAt' does not exist in type '{ title?: string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | undefined; questions?: unknown; id?: number | SQL<...> | PgColumn<...> | undefined; isActive?: boolean | ... 2 more ... | undefined; createdAt?: SQL<...> | ... 2 more ... | undefined; businessId?: number | ... 3 more ... |...'.
Error: api/feedback-router.ts(95,51): error TS2345: Argument of type 'SQL<unknown>' is not assignable to parameter of type 'never'.
Error: api/lib/csrf.ts(1,10): error TS1485: 'Context' resolves to a type-only declaration and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
Error: api/lib/csrf.ts(1,19): error TS1484: 'Next' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
Error: api/mpesa-router.ts(216,16): error TS2454: Variable 'expenseId' is used before being assigned.
Error: api/permissions-router.ts(114,100): error TS2345: Argument of type 'string' is not assignable to parameter of type '"sales:view" | "sales:create" | "expenses:view" | "expenses:create" | "expenses:manage" | "bills:view" | "bills:create" | "bills:pay" | "suppliers:view" | "suppliers:manage" | ... 24 more ... | "transactions:reset"'.
Error: api/reports-router.ts(95,21): error TS2345: Argument of type '{ month: number; monthName: string; revenue: string; cogs: string; expenses: string; payroll: string; netProfit: string; }' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(18,37): error TS2345: Argument of type 'SQL<unknown>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(19,39): error TS2345: Argument of type 'SQL<unknown>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(71,15): error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>, right: number | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number | null' is not assignable to parameter of type 'number | SQLWrapper'.
      Type 'null' is not assignable to type 'number | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number | null>, right: number | SQLWrapper | null): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number | null>'.
      Type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number | null>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(79,63): error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: number | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number | null' is not assignable to parameter of type 'number | SQLWrapper'.
      Type 'null' is not assignable to type 'number | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number | null>, right: number | SQLWrapper | null): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number | null>'.
      Type 'PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number | null>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(81,24): error TS2345: Argument of type '{ itemName: string; supplierName: string; supplierId: number | null; latestPrice: string; previousPrice: string; averagePrice: string; changePercent: string; isIncrease: boolean; purchases: number; }' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(95,59): error TS2339: Property 'changePercent' does not exist on type 'never'.
Error: api/supplier-prices-router.ts(95,99): error TS2339: Property 'changePercent' does not exist on type 'never'.
Error: api/supplier-prices-router.ts(132,15): error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>, right: number | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number | null' is not assignable to parameter of type 'number | SQLWrapper'.
      Type 'null' is not assignable to type 'number | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number | null>, right: number | SQLWrapper | null): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number | null>'.
      Type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number | null>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(144,15): error TS2322: Type 'number | null' is not assignable to type 'number'.
  Type 'null' is not assignable to type 'number'.
Error: src/pages/Bills.tsx(79,27): error TS2345: Argument of type '{ imageData: string; mimeType: string; caption: string; }' is not assignable to parameter of type 'never'.
Error: src/pages/Bills.tsx(185,136): error TS2339: Property 'billNumber' does not exist on type '{ locationId: string; supplierId: string; description: string; amount: string; issueDate: string; dueDate: string; }'.
Error: src/pages/DailyPayments.tsx(65,329): error TS2367: This comparison appears to be unintentional because the types '"open" | "cancelled" | "processing"' and '"processed"' have no overlap.
Error: src/pages/DailySales.tsx(142,27): error TS2345: Argument of type '{ imageData: string; mimeType: string; caption: string; }' is not assignable to parameter of type 'never'.
Error: src/pages/Expenses.tsx(132,27): error TS2345: Argument of type '{ imageData: string; mimeType: string; caption: string; }' is not assignable to parameter of type 'never'.
Error: src/pages/PartnerDashboard.tsx(201,88): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string | number'.
  Type 'null' is not assignable to type 'string | number'.
Error: src/pages/PartnerDashboard.tsx(203,117): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string | number'.
  Type 'null' is not assignable to type 'string | number'.
Error: src/pages/Payroll.tsx(84,61): error TS2339: Property 'compute' does not exist on type 'DecorateRouterRecord<{ ctx: TrpcCtx; meta: object; errorShape: { data: { zodError: $ZodFlattenedError<unknown, string> | null; code: "PARSE_ERROR" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR" | ... 17 more ... | "CLIENT_CLOSED_REQUEST"; httpStatus: number; path?: string | undefined; stack?: string | undefined; }; messa...'.
Error: src/pages/Payroll.tsx(111,332): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
Error: src/pages/Reports.tsx(67,21): error TS2322: Type 'string | null' is not assignable to type 'string'.
  Type 'null' is not assignable to type 'string'.
Error: src/pages/Reports.tsx(67,63): error TS2322: Type 'string | null' is not assignable to type 'string'.
  Type 'null' is not assignable to type 'string'.
Error: src/pages/Reports.tsx(103,9): error TS2339: Property 'paymentMethod' does not exist on type '{ payments: { id: number; dailySaleId: number; paymentMethodId: number; amount: string; createdAt: Date; }[]; id: number; locationId: number; saleDate: string; cashTotal: string; cardTotal: string; ... 21 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(103,26): error TS2339: Property 'grossSales' does not exist on type '{ payments: { id: number; dailySaleId: number; paymentMethodId: number; amount: string; createdAt: Date; }[]; id: number; locationId: number; saleDate: string; cashTotal: string; cardTotal: string; ... 21 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(103,52): error TS2339: Property 'taxAmount' does not exist on type '{ payments: { id: number; dailySaleId: number; paymentMethodId: number; amount: string; createdAt: Date; }[]; id: number; locationId: number; saleDate: string; cashTotal: string; cardTotal: string; ... 21 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(103,95): error TS2339: Property 'receiptNo' does not exist on type '{ payments: { id: number; dailySaleId: number; paymentMethodId: number; amount: string; createdAt: Date; }[]; id: number; locationId: number; saleDate: string; cashTotal: string; cardTotal: string; ... 21 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(103,114): error TS2339: Property 'recordedBy' does not exist on type '{ payments: { id: number; dailySaleId: number; paymentMethodId: number; amount: string; createdAt: Date; }[]; id: number; locationId: number; saleDate: string; cashTotal: string; cardTotal: string; ... 21 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(127,109): error TS2339: Property 'isReconciled' does not exist on type '{ id: number; locationId: number; txnId: string; txnDate: string; txnTime: string | null; txnType: "expense" | "transfer" | "bank_transfer" | "topup" | "airtime" | "utility" | "withdrawal"; ... 15 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(143,67): error TS2339: Property 'paymentMethod' does not exist on type '{ payments: { id: number; dailySaleId: number; paymentMethodId: number; amount: string; createdAt: Date; }[]; id: number; locationId: number; saleDate: string; cashTotal: string; cardTotal: string; ... 21 more ...; deletedAt: Date | null; }'.
Error: src/pages/Reports.tsx(148,83): error TS2339: Property 'netProfit' does not exist on type 'never'.
Error: src/pages/Reports.tsx(149,83): error TS2339: Property 'netProfit' does not exist on type 'never'.
Error: src/pages/Reports.tsx(298,42): error TS2339: Property 'netProfit' does not exist on type 'never'.
Error: src/pages/Reports.tsx(299,42): error TS2339: Property 'revenue' does not exist on type 'never'.
Error: src/pages/Reports.tsx(303,31): error TS2339: Property 'month' does not exist on type 'never'.
Error: src/pages/Reports.tsx(312,69): error TS2339: Property 'monthName' does not exist on type 'never'.
Error: src/pages/Settings.tsx(316,84): error TS2345: Argument of type 'string' is not assignable to parameter of type 'PlanKey'.
Error: src/pages/Suppliers.tsx(50,5): error TS2769: No overload matches this call.
  Overload 1 of 2, '(input: { itemName?: string | undefined; supplierId?: number | undefined; limit?: number | undefined; } | typeof skipToken, opts: DefinedUseTRPCQueryOptions<{ id: number; supplierId: number | null; ... 6 more ...; createdAt: Date; }[], { ...; }[], TRPCClientErrorLike<...>, { ...; }[]>): DefinedUseTRPCQueryResult<...>', gave the following error.
    Argument of type '{ itemName: string; limit: number; } | undefined' is not assignable to parameter of type '{ itemName?: string | undefined; supplierId?: number | undefined; limit?: number | undefined; } | unique symbol'.
      Type 'undefined' is not assignable to type '{ itemName?: string | undefined; supplierId?: number | undefined; limit?: number | undefined; } | unique symbol'.
  Overload 2 of 2, '(input: { itemName?: string | undefined; supplierId?: number | undefined; limit?: number | undefined; } | typeof skipToken, opts?: UseTRPCQueryOptions<{ id: number; supplierId: number | null; ... 6 more ...; createdAt: Date; }[], { ...; }[], TRPCClientErrorLike<...>, { ...; }[]> | undefined): UseTRPCQueryResult<...>', gave the following error.
    Argument of type '{ itemName: string; limit: number; } | undefined' is not assignable to parameter of type '{ itemName?: string | undefined; supplierId?: number | undefined; limit?: number | undefined; } | unique symbol'.
      Type 'undefined' is not assignable to type '{ itemName?: string | undefined; supplierId?: number | undefined; limit?: number | undefined; } | unique symbol'.
Error: src/pages/Suppliers.tsx(388,89): error TS2339: Property 'itemName' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(389,77): error TS2339: Property 'supplierName' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(390,93): error TS2339: Property 'latestPrice' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(391,108): error TS2339: Property 'previousPrice' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(392,108): error TS2339: Property 'averagePrice' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(394,130): error TS2339: Property 'isIncrease' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(395,37): error TS2339: Property 'isIncrease' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(396,37): error TS2339: Property 'isIncrease' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(396,65): error TS2339: Property 'changePercent' does not exist on type 'never'.
Error: src/pages/Suppliers.tsx(399,89): error TS2339: Property 'purchases' does not exist on type 'never'.
Error: api/__tests__/account-subscription-context.test.ts(57,9): error TS2739: Type '{ id: number; accountId: string; accountRefId: number; }' is missing the following properties from type 'CurrentBusinessContext': plan, maxUsers, features, maxBranches
Error: api/__tests__/account-subscription-context.test.ts(74,9): error TS2739: Type '{ id: number; accountId: string; accountRefId: number; }' is missing the following properties from type 'CurrentBusinessContext': plan, maxUsers, features, maxBranches
Error: api/__tests__/account-subscription-context.test.ts(83,12): error TS18047: 'subscriptionA' is possibly 'null'.
Error: api/__tests__/account-subscription-context.test.ts(84,12): error TS18047: 'subscriptionB' is possibly 'null'.
Error: api/__tests__/account-subscription-context.test.ts(85,12): error TS18047: 'subscriptionA' is possibly 'null'.
Error: api/__tests__/account-subscription-context.test.ts(86,12): error TS18047: 'subscriptionB' is possibly 'null'.
Error: api/__tests__/frontend-regressions.test.ts(9,33): error TS6142: Module '../../src/pages/Businesses' was resolved to '/home/runner/work/finaflow/finaflow/src/pages/Businesses.tsx', but '--jsx' is not set.
Error: api/__tests__/frontend-regressions.test.ts(15,33): error TS6142: Module '../../src/providers/trpc' was resolved to '/home/runner/work/finaflow/finaflow/src/providers/trpc.tsx', but '--jsx' is not set.
Error: api/__tests__/frontend-regressions.test.ts(22,33): error TS6142: Module '../../src/pages/Expenses' was resolved to '/home/runner/work/finaflow/finaflow/src/pages/Expenses.tsx', but '--jsx' is not set.
Error: api/__tests__/subscriptions.test.ts(117,39): error TS2345: Argument of type '{ role: "owner" | "admin" | "manager" | "employee" | "viewer"; id: number; accountId: string | null; name: string | null; isActive: boolean; createdAt: Date; updatedAt: Date; ... 11 more ...; lastSignInAt: Date; }' is not assignable to parameter of type '{ id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null; }'.
  Types of property 'currentBusinessId' are incompatible.
    Type 'number | null' is not assignable to type 'number'.
      Type 'null' is not assignable to type 'number'.
Error: api/__tests__/subscriptions.test.ts(133,39): error TS2345: Argument of type '{ role: "owner" | "admin" | "manager" | "employee" | "viewer"; id: number; accountId: string | null; name: string | null; isActive: boolean; createdAt: Date; updatedAt: Date; ... 11 more ...; lastSignInAt: Date; }' is not assignable to parameter of type '{ id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null; }'.
  Types of property 'currentBusinessId' are incompatible.
    Type 'number | null' is not assignable to type 'number'.
      Type 'null' is not assignable to type 'number'.
Error: api/alerts-router.ts(55,72): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.
Error: api/bills-router.ts(43,23): error TS18048: 'input' is possibly 'undefined'.
Error: api/bills-router.ts(43,41): error TS18048: 'input' is possibly 'undefined'.
Error: api/bills-router.ts(44,99): error TS18048: 'input' is possibly 'undefined'.
Error: api/bills-router.ts(100,20): error TS2454: Variable 'billId' is used before being assigned.
Error: api/bills-router.ts(163,20): error TS2454: Variable 'paymentId' is used before being assigned.
Error: api/bills-router.ts(306,55): error TS2322: Type 'Date' is not assignable to type 'string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | undefined'.
Error: api/bills-router.ts(318,16): error TS2454: Variable 'billId' is used before being assigned.
Error: api/daily-sales-router.ts(168,20): error TS2454: Variable 'saleId' is used before being assigned.
Error: api/expenses-router.ts(74,104): error TS2304: Cannot find name 'id'.
Error: api/expenses-router.ts(93,23): error TS18048: 'input' is possibly 'undefined'.
Error: api/expenses-router.ts(93,41): error TS18048: 'input' is possibly 'undefined'.
Error: api/expenses-router.ts(94,109): error TS18048: 'input' is possibly 'undefined'.
Error: api/expenses-router.ts(203,20): error TS2454: Variable 'expenseId' is used before being assigned.
Error: api/feedback-router.ts(11,44): error TS2339: Property 'deletedAt' does not exist on type 'PgTableWithColumns<{ name: "feedback_questionnaires"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "feedback_questionnaires"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; ... 8 more ...; generated: undefined; }, {}, {}>; ... 5 more ...; createdAt: PgColumn<......'.
Error: api/feedback-router.ts(67,53): error TS2353: Object literal may only specify known properties, and 'deletedAt' does not exist in type '{ title?: string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | undefined; questions?: unknown; id?: number | SQL<...> | PgColumn<...> | undefined; isActive?: boolean | ... 2 more ... | undefined; createdAt?: SQL<...> | ... 2 more ... | undefined; businessId?: number | ... 3 more ... |...'.
Error: api/feedback-router.ts(95,51): error TS2345: Argument of type 'SQL<unknown>' is not assignable to parameter of type 'never'.
Error: api/mpesa-router.ts(216,16): error TS2454: Variable 'expenseId' is used before being assigned.
Error: api/permissions-router.ts(114,100): error TS2345: Argument of type 'string' is not assignable to parameter of type '"sales:view" | "sales:create" | "expenses:view" | "expenses:create" | "expenses:manage" | "bills:view" | "bills:create" | "bills:pay" | "suppliers:view" | "suppliers:manage" | ... 24 more ... | "transactions:reset"'.
Error: api/reports-router.ts(95,21): error TS2345: Argument of type '{ month: number; monthName: string; revenue: string; cogs: string; expenses: string; payroll: string; netProfit: string; }' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(18,37): error TS2345: Argument of type 'SQL<unknown>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(19,39): error TS2345: Argument of type 'SQL<unknown>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(71,15): error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>, right: number | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number | null' is not assignable to parameter of type 'number | SQLWrapper'.
      Type 'null' is not assignable to type 'number | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number | null>, right: number | SQLWrapper | null): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number | null>'.
      Type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number | null>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(79,63): error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: number | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number | null' is not assignable to parameter of type 'number | SQLWrapper'.
      Type 'null' is not assignable to type 'number | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number | null>, right: number | SQLWrapper | null): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number | null>'.
      Type 'PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number | null>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "id"; tableName: "suppliers"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(81,24): error TS2345: Argument of type '{ itemName: string; supplierName: string; supplierId: number | null; latestPrice: string; previousPrice: string; averagePrice: string; changePercent: string; isIncrease: boolean; purchases: number; }' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(95,59): error TS2339: Property 'changePercent' does not exist on type 'never'.
Error: api/supplier-prices-router.ts(95,99): error TS2339: Property 'changePercent' does not exist on type 'never'.
Error: api/supplier-prices-router.ts(132,15): error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>, right: number | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number | null' is not assignable to parameter of type 'number | SQLWrapper'.
      Type 'null' is not assignable to type 'number | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number | null>, right: number | SQLWrapper | null): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number | null>'.
      Type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number | null>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "supplierId"; tableName: "supplier_price_history"; dataType: "number"; columnType: "PgBigInt53"; data: number; driverParam: string | number; notNull: false; hasDefault: false; ... 6 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.
Error: api/supplier-prices-router.ts(144,15): error TS2322: Type 'number | null' is not assignable to type 'number'.
  Type 'null' is not assignable to type 'number'.
Error: db/seed.ts(65,37): error TS2769: No overload matches this call.
  Overload 1 of 2, '(value: { name: string | SQL<unknown> | Placeholder<string, any>; businessId: number | SQL<unknown> | Placeholder<string, any>; id?: number | SQL<unknown> | Placeholder<...> | undefined; ... 14 more ...; autoCategoryId?: number | ... 3 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Argument of type '{ name: string; phone: string; paymentTermsDays: number; notes: string; }[]' is not assignable to parameter of type '{ name: string | SQL<unknown> | Placeholder<string, any>; businessId: number | SQL<unknown> | Placeholder<string, any>; id?: number | SQL<unknown> | Placeholder<string, any> | undefined; ... 14 more ...; autoCategoryId?: number | ... 3 more ... | undefined; }'.
      Type '{ name: string; phone: string; paymentTermsDays: number; notes: string; }[]' is missing the following properties from type '{ name: string | SQL<unknown> | Placeholder<string, any>; businessId: number | SQL<unknown> | Placeholder<string, any>; id?: number | SQL<unknown> | Placeholder<string, any> | undefined; ... 14 more ...; autoCategoryId?: number | ... 3 more ... | undefined; }': name, businessId
Error: Process completed with exit code 2.