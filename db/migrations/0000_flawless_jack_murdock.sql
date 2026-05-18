CREATE TYPE "public"."accountSubType" AS ENUM('cash', 'bank', 'accounts_receivable', 'inventory', 'prepaid_expense', 'fixed_asset', 'accumulated_depreciation', 'intangible_asset', 'other_asset', 'accounts_payable', 'accrued_expense', 'current_loan', 'long_term_loan', 'capital', 'retained_earnings', 'drawings', 'current_year_earnings', 'sales_revenue', 'service_revenue', 'subscription_revenue', 'other_income', 'cogs', 'operating_expense', 'admin_expense', 'marketing_expense', 'depreciation_expense');--> statement-breakpoint
CREATE TYPE "public"."accountType" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."accountingClass" AS ENUM('cogs', 'operating_expense', 'admin_expense', 'marketing', 'depreciation', 'other');--> statement-breakpoint
CREATE TYPE "public"."action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT');--> statement-breakpoint
CREATE TYPE "public"."advanceStatus" AS ENUM('pending', 'approved', 'partially_repaid', 'repaid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."allocation_invite_status" AS ENUM('active', 'consumed', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."allocation_rights" AS ENUM('view_only', 'create_view', 'manage');--> statement-breakpoint
CREATE TYPE "public"."billStatus" AS ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."depreciationMethod" AS ENUM('straight_line', 'declining_balance');--> statement-breakpoint
CREATE TYPE "public"."entryType" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."itemType" AS ENUM('inventory', 'fixed_asset', 'service', 'non_inventory');--> statement-breakpoint
CREATE TYPE "public"."leadStatus" AS ENUM('new', 'contacted', 'converted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."orderStatus" AS ENUM('draft', 'sent', 'delivered', 'billed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."partner_allocation_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."paymentMethod2" AS ENUM('cash', 'mpesa', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TYPE "public"."paymentMethod" AS ENUM('cash', 'mpesa', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payrollStatus" AS ENUM('open', 'processing', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."revenueCategoryType" AS ENUM('product_sales', 'service_revenue', 'subscription', 'membership', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'manager', 'employee', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."salaryType" AS ENUM('monthly', 'weekly', 'daily', 'hourly');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('open', 'resolved', 'partial');--> statement-breakpoint
CREATE TYPE "public"."transactionType" AS ENUM('sale', 'expense', 'bill_payment', 'supplier_payment', 'payroll', 'advance', 'transfer', 'opening_balance', 'mpesa_topup', 'drawing', 'deposit', 'journal', 'depreciation', 'asset_disposal');--> statement-breakpoint
CREATE TYPE "public"."txnType" AS ENUM('topup', 'expense', 'transfer', 'bank_transfer', 'airtime', 'utility', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."type" AS ENUM('cash', 'mpesa', 'bank_account');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('standard', 'partner');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"businessId" bigint,
	"name" varchar(100) NOT NULL,
	"type" "type" NOT NULL,
	"accountCode" varchar(20),
	"accountNumber" varchar(100),
	"description" text,
	"systemKey" varchar(120),
	"accountType" "accountType",
	"accountSubType" "accountSubType",
	"openingBalance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"currentBalance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"isPaymentMethod" boolean DEFAULT false NOT NULL,
	"isSystemGenerated" boolean DEFAULT false NOT NULL,
	"isContra" boolean DEFAULT false,
	"parentAccountId" bigint,
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"lastSyncedAt" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "alerts_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"accountId" bigint,
	"minBalance" numeric(15, 2) DEFAULT '10000.00',
	"notifyEmail" varchar(320),
	"notifyPhone" varchar(20),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"locationId" bigint,
	"accountId" bigint,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"ownerAccountId" bigint NOT NULL,
	"businessId" bigint NOT NULL,
	"rightsProfile" "allocation_rights" NOT NULL,
	"status" "allocation_invite_status" DEFAULT 'active' NOT NULL,
	"createdBy" bigint NOT NULL,
	"consumedByPartnerAccountId" bigint,
	"consumedByPartnerUserId" bigint,
	"consumedAt" timestamp,
	"revokedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"keyHash" varchar(255) NOT NULL,
	"keyPrefix" varchar(20) NOT NULL,
	"scopes" json,
	"lastUsedAt" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"key" varchar(100) NOT NULL,
	"value" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"recordType" varchar(50) NOT NULL,
	"recordId" bigint NOT NULL,
	"imageData" text NOT NULL,
	"mimeType" varchar(50) DEFAULT 'image/jpeg',
	"caption" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tableName" varchar(100) NOT NULL,
	"recordId" bigint NOT NULL,
	"action" "action" NOT NULL,
	"oldValues" json,
	"newValues" json,
	"changedBy" bigint,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"billId" bigint NOT NULL,
	"itemName" varchar(255) NOT NULL,
	"quantity" numeric(10, 3) DEFAULT '1.000' NOT NULL,
	"unitPrice" numeric(15, 2) NOT NULL,
	"totalPrice" numeric(15, 2) NOT NULL,
	"categoryId" bigint,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "bill_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"billId" bigint NOT NULL,
	"paymentMethod" "paymentMethod2" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"paymentDate" date NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"accountId" bigint,
	"journalEntryId" bigint,
	"enteredBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"businessId" bigint,
	"supplierId" bigint,
	"categoryId" bigint,
	"billNumber" varchar(100),
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"amountPaid" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"balanceDue" numeric(15, 2) NOT NULL,
	"issueDate" date NOT NULL,
	"dueDate" date NOT NULL,
	"status" "billStatus" DEFAULT 'pending' NOT NULL,
	"journalEntryId" bigint,
	"reversedAt" timestamp,
	"reversedBy" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"categoryId" bigint,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "business_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"documentType" varchar(50) NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileData" text NOT NULL,
	"mimeType" varchar(50),
	"notes" text,
	"uploadedBy" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "business_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessName" varchar(255) NOT NULL,
	"contactName" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(20),
	"position" varchar(100),
	"suggestedPrice" numeric(10, 2),
	"notes" text,
	"status" "leadStatus" DEFAULT 'new' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_logos" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"fileData" text NOT NULL,
	"width" integer,
	"height" integer,
	"sizeBytes" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"uploadedBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" varchar(100) NOT NULL,
	"accountRefId" bigint,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"businessType" varchar(50),
	"country" varchar(100),
	"county" varchar(100),
	"subCounty" varchar(100),
	"address" text,
	"businessRegNumber" varchar(100),
	"phone" varchar(20),
	"natureOfBusiness" varchar(255),
	"kraPin" varchar(20),
	"email" varchar(255),
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"maxBranches" integer DEFAULT 1,
	"maxUsers" integer DEFAULT 1,
	"maxTransactionsPerMonth" integer DEFAULT 100,
	"features" json,
	"subscriptionStatus" varchar(20) DEFAULT 'active',
	"subscriptionExpiry" date,
	"isMultiLocation" boolean DEFAULT true NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"isDemo" boolean DEFAULT false NOT NULL,
	"isWhiteLabel" boolean DEFAULT false NOT NULL,
	"whiteLabelDomain" varchar(255),
	"referralCode" varchar(50),
	"referredByBusinessId" bigint,
	"referredByUserId" bigint,
	"firstMonthDiscountApplied" boolean DEFAULT false NOT NULL,
	"partnerId" bigint,
	"revSharePercent" numeric(5, 2) DEFAULT '20.00',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cogs_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"targetFoodCostPercent" numeric(5, 2) DEFAULT '35.00',
	"alertThresholdPercent" numeric(5, 2) DEFAULT '38.00',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"maxBusinesses" integer DEFAULT 1 NOT NULL,
	"maxUsers" integer DEFAULT 1 NOT NULL,
	"maxTransactionsPerMonth" integer DEFAULT 100 NOT NULL,
	"features" json,
	"subscriptionStatus" varchar(20) DEFAULT 'active' NOT NULL,
	"subscriptionExpiry" date,
	"isActive" boolean DEFAULT true NOT NULL,
	"migratedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "daily_mpesa_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"accountId" bigint NOT NULL,
	"ledgerDate" date NOT NULL,
	"openingBalance" numeric(15, 2) NOT NULL,
	"totalTopups" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"totalExpenditures" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"totalFees" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"closingBalance" numeric(15, 2) NOT NULL,
	"transactionCount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"enteredBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "daily_sale_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"dailySaleId" bigint NOT NULL,
	"paymentMethodId" bigint NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"saleDate" date NOT NULL,
	"cashTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"cardTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"mpesaTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"familyBankTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"coopBankTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"equityBankTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"boltTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"glovoTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"creditCardTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"deliveryPartnerTotal" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"netSales" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"discountAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"voidAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"unpaidAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"ticketCount" integer DEFAULT 0,
	"orderCount" integer DEFAULT 0,
	"voidCount" integer DEFAULT 0,
	"giftCount" integer DEFAULT 0,
	"notes" text,
	"unpaidNotes" text,
	"enteredBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"userId" bigint,
	"fullName" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"idNumber" varchar(20),
	"kraPin" varchar(20),
	"nssfNumber" varchar(20),
	"nhifNumber" varchar(20),
	"salaryType" "salaryType" NOT NULL,
	"basicSalary" numeric(15, 2) NOT NULL,
	"bankName" varchar(100),
	"bankAccount" varchar(50),
	"bankCode" varchar(10),
	"employmentDate" date NOT NULL,
	"terminationDate" date,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"locationId" bigint,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT '#C73E1D',
	"accountingClass" "accountingClass" DEFAULT 'operating_expense',
	"defaultAccountId" bigint NOT NULL,
	"externalAccountCode" varchar(50),
	"externalSystem" varchar(50),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"businessId" bigint,
	"categoryId" bigint NOT NULL,
	"supplierId" bigint,
	"expenseNumber" varchar(50),
	"billId" bigint,
	"refNo" varchar(50),
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"expenseDate" date NOT NULL,
	"paymentMethod" "paymentMethod2" NOT NULL,
	"accountId" bigint,
	"receiptImageUrl" text,
	"mpesaTxnId" varchar(20),
	"expenseRef" varchar(50),
	"isReimbursable" boolean DEFAULT false,
	"reimbursedTo" bigint,
	"isFixedAsset" boolean DEFAULT false,
	"fixedAssetItemId" bigint,
	"usefulLifeMonths" integer,
	"depreciationMethod" "depreciationMethod",
	"salvageValue" numeric(15, 2),
	"journalEntryId" bigint,
	"reversedAt" timestamp,
	"reversedBy" bigint,
	"enteredBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "external_sync_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"systemName" varchar(50) NOT NULL,
	"config" json NOT NULL,
	"lastSyncAt" timestamp,
	"syncStatus" varchar(20) DEFAULT 'idle',
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_questionnaires" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"title" varchar(255) NOT NULL,
	"description" text,
	"questions" json NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"questionnaireId" bigint NOT NULL,
	"respondentName" varchar(255),
	"respondentEmail" varchar(320),
	"answers" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"reportType" varchar(50) NOT NULL,
	"periodStart" date NOT NULL,
	"periodEnd" date NOT NULL,
	"reportData" json NOT NULL,
	"reportMetadata" json,
	"generatedBy" bigint,
	"generatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_depreciation" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemId" bigint NOT NULL,
	"journalEntryId" bigint,
	"periodYear" integer NOT NULL,
	"periodMonth" integer NOT NULL,
	"depreciationAmount" numeric(15, 2) NOT NULL,
	"accumulatedAfter" numeric(15, 2) NOT NULL,
	"bookValueAfter" numeric(15, 2) NOT NULL,
	"isPosted" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"locationId" bigint,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sku" varchar(50),
	"itemType" "itemType" NOT NULL,
	"incomeAccountId" bigint,
	"expenseAccountId" bigint,
	"assetAccountId" bigint,
	"isFixedAsset" boolean DEFAULT false,
	"purchaseDate" date,
	"purchasePrice" numeric(15, 2),
	"usefulLifeMonths" integer,
	"depreciationMethod" "depreciationMethod",
	"salvageValue" numeric(15, 2) DEFAULT '0.00',
	"accumulatedDepreciation" numeric(15, 2) DEFAULT '0.00',
	"currentBookValue" numeric(15, 2),
	"disposalDate" date,
	"disposalValue" numeric(15, 2),
	"notes" text,
	"unitCost" numeric(15, 2),
	"unitPrice" numeric(15, 2),
	"currentStock" numeric(15, 2) DEFAULT '0',
	"reorderLevel" numeric(15, 2),
	"taxRate" numeric(5, 2),
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"lastSyncedAt" timestamp,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deletedAt" timestamp,
	CONSTRAINT "items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"entryNumber" varchar(50),
	"entryDate" date NOT NULL,
	"description" text NOT NULL,
	"reference" varchar(100),
	"sourceType" varchar(50),
	"sourceId" bigint,
	"isPosted" boolean DEFAULT false,
	"postedBy" bigint,
	"postedAt" timestamp,
	"isReversed" boolean DEFAULT false,
	"reversedBy" bigint,
	"reversalOf" bigint,
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"createdBy" bigint,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deletedAt" timestamp,
	CONSTRAINT "journal_entries_entryNumber_unique" UNIQUE("entryNumber")
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journalEntryId" bigint NOT NULL,
	"accountId" bigint NOT NULL,
	"debit" numeric(15, 2) DEFAULT '0.00',
	"credit" numeric(15, 2) DEFAULT '0.00',
	"description" text,
	"lineNumber" integer,
	"createdAt" timestamp DEFAULT now(),
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" bigint NOT NULL,
	"transactionType" "transactionType" NOT NULL,
	"transactionId" bigint NOT NULL,
	"entryType" "entryType" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"balanceAfter" numeric(15, 2) NOT NULL,
	"description" text,
	"refNo" varchar(50),
	"entryDate" date NOT NULL,
	"createdBy" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "location_payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"paymentMethodId" bigint NOT NULL,
	"linkedAccountId" bigint,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"businessType" varchar(50),
	"country" varchar(100),
	"county" varchar(100),
	"subCounty" varchar(100),
	"address" text,
	"businessRegNumber" varchar(100),
	"phone" varchar(20),
	"natureOfBusiness" varchar(255),
	"kraPin" varchar(20),
	"email" varchar(255),
	"isActive" boolean DEFAULT true NOT NULL,
	"defaultMpesaAccountId" bigint,
	"defaultCashAccountId" bigint,
	"nextBillNumber" bigint DEFAULT 1 NOT NULL,
	"nextExpenseNumber" bigint DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "master_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"lastUnitPrice" numeric(15, 2),
	"lastCategoryId" bigint,
	"lastSupplierId" bigint,
	"usageCount" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "master_items_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "mpesa_reconciliation" (
	"id" serial PRIMARY KEY NOT NULL,
	"txnDate" date NOT NULL,
	"orphanCount" integer DEFAULT 0,
	"orphanTotal" numeric(15, 2) DEFAULT '0.00',
	"matchedCount" integer DEFAULT 0,
	"matchedTotal" numeric(15, 2) DEFAULT '0.00',
	"status" "status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "mpesa_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"txnId" varchar(20) NOT NULL,
	"txnDate" date NOT NULL,
	"txnTime" varchar(10),
	"txnType" "txnType" NOT NULL,
	"partyName" varchar(255),
	"amount" numeric(15, 2) NOT NULL,
	"txnFee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"balance" numeric(15, 2),
	"description" text,
	"rawText" text,
	"isLinked" boolean DEFAULT false NOT NULL,
	"linkedExpenseId" bigint,
	"linkedBillId" bigint,
	"linkedSupplierId" bigint,
	"sourceAccountId" bigint,
	"destinationAccountId" bigint,
	"importedBy" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "mpesa_transactions_txnId_unique" UNIQUE("txnId")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"locationId" bigint,
	"entityType" varchar(50),
	"entityId" bigint,
	"isRead" boolean DEFAULT false NOT NULL,
	"isPushed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerAccountId" bigint NOT NULL,
	"ownerBusinessId" bigint NOT NULL,
	"partnerAccountId" bigint NOT NULL,
	"partnerUserId" bigint NOT NULL,
	"rightsProfile" "allocation_rights" NOT NULL,
	"inviteId" bigint NOT NULL,
	"status" "partner_allocation_status" DEFAULT 'active' NOT NULL,
	"revokedAt" timestamp,
	"createdBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "partner_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"partnerId" bigint NOT NULL,
	"businessId" bigint NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"subscriptionAmount" numeric(15, 2) DEFAULT '0.00',
	"commissionPercent" numeric(5, 2) DEFAULT '20.00',
	"commissionAmount" numeric(15, 2) DEFAULT '0.00',
	"status" varchar(20) DEFAULT 'pending',
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"accountRefId" bigint,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"color" varchar(20) DEFAULT '#C73E1D',
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "payroll_advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" bigint NOT NULL,
	"payrollPeriodId" bigint,
	"amount" numeric(15, 2) NOT NULL,
	"balanceRemaining" numeric(15, 2) NOT NULL,
	"requestDate" date NOT NULL,
	"repaymentPeriods" integer DEFAULT 1,
	"status" "advanceStatus" DEFAULT 'pending' NOT NULL,
	"approvedBy" bigint,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"periodId" bigint NOT NULL,
	"employeeId" bigint NOT NULL,
	"basicPay" numeric(15, 2) NOT NULL,
	"advancesDeducted" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"deductions" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"bonuses" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"overtimePay" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"payeDeducted" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"nhifDeducted" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"nssfDeducted" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"netPay" numeric(15, 2) NOT NULL,
	"paymentMethod" "paymentMethod" DEFAULT 'mpesa' NOT NULL,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"periodName" varchar(50) NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"paymentDate" date NOT NULL,
	"status" "payrollStatus" DEFAULT 'open' NOT NULL,
	"generatedBillId" bigint,
	"totalNetPay" numeric(15, 2) DEFAULT '0.00',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "payroll_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"nhifRate" numeric(5, 2) DEFAULT '2.75',
	"nssfTier1Limit" numeric(15, 2) DEFAULT '7000.00',
	"nssfTier1Employee" numeric(15, 2) DEFAULT '420.00',
	"nssfTier1Employer" numeric(15, 2) DEFAULT '420.00',
	"nssfTier2Limit" numeric(15, 2) DEFAULT '36000.00',
	"nssfTier2Employee" numeric(15, 2) DEFAULT '1740.00',
	"nssfTier2Employer" numeric(15, 2) DEFAULT '1740.00',
	"personalRelief" numeric(15, 2) DEFAULT '2400.00',
	"insuranceRelief" numeric(15, 2) DEFAULT '0.00',
	"payeBands" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" bigint,
	"itemName" varchar(255) NOT NULL,
	"expectedPrice" numeric(15, 2),
	"variancePercent" numeric(5, 2) DEFAULT '10.00',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"poId" bigint NOT NULL,
	"itemName" varchar(255) NOT NULL,
	"quantity" numeric(10, 3) DEFAULT '1.000' NOT NULL,
	"unitPrice" numeric(15, 2) NOT NULL,
	"totalPrice" numeric(15, 2) NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"supplierId" bigint,
	"billId" bigint,
	"poNumber" varchar(50),
	"description" text,
	"status" "orderStatus" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0.00',
	"taxAmount" numeric(15, 2) DEFAULT '0.00',
	"total" numeric(15, 2) DEFAULT '0.00',
	"deliveryDate" date,
	"deliveryNotes" text,
	"terms" text,
	"createdBy" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint,
	"subscription" json NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_actions_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint,
	"action" varchar(50) NOT NULL,
	"entityType" varchar(50),
	"entityId" bigint,
	"details" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bill_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"businessId" bigint,
	"supplierId" bigint,
	"categoryId" bigint,
	"liabilityAccountId" bigint,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"frequency" "frequency" NOT NULL,
	"dayOfWeek" integer,
	"dayOfMonth" integer,
	"monthOfYear" integer,
	"nextDueDate" date NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"deviceInfo" text,
	"isRevoked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"name" varchar(100) NOT NULL,
	"description" text,
	"incomeAccountId" bigint,
	"accountCode" varchar(20),
	"categoryType" "revenueCategoryType" DEFAULT 'other',
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleKey" varchar(50) NOT NULL,
	"roleLabel" varchar(100) NOT NULL,
	"permissions" json NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" bigint,
	"itemName" varchar(255) NOT NULL,
	"billId" bigint,
	"unitPrice" numeric(15, 2) NOT NULL,
	"quantity" numeric(10, 3) DEFAULT '1.000' NOT NULL,
	"priceDate" date NOT NULL,
	"locationId" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"locationId" bigint,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"contactPerson" varchar(255),
	"kraPin" varchar(20),
	"paymentTermsDays" integer DEFAULT 30 NOT NULL,
	"creditLimit" numeric(15, 2),
	"currentBalance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"totalBilled" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"totalPaid" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"autoCategoryId" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"businessId" bigint NOT NULL,
	"role" varchar(50) DEFAULT 'admin',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"unionId" varchar(255),
	"username" varchar(100) NOT NULL,
	"passwordHash" varchar(255),
	"name" varchar(255),
	"email" varchar(320),
	"avatar" text,
	"role" "role" DEFAULT 'viewer' NOT NULL,
	"userType" "user_type" DEFAULT 'standard' NOT NULL,
	"phone" varchar(20),
	"locationId" bigint,
	"currentBusinessId" bigint,
	"accountId" varchar(100),
	"accountRefId" bigint,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignInAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "users_unionId_unique" UNIQUE("unionId")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhookId" bigint NOT NULL,
	"event" varchar(50) NOT NULL,
	"payload" json,
	"status" varchar(50) NOT NULL,
	"statusCode" integer,
	"response" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" varchar(500) NOT NULL,
	"events" json NOT NULL,
	"secret" varchar(255),
	"isActive" boolean DEFAULT true NOT NULL,
	"lastTriggeredAt" timestamp,
	"lastStatus" varchar(50),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_accountRefId_customer_accounts_id_fk" FOREIGN KEY ("accountRefId") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_accountRefId_customer_accounts_id_fk" FOREIGN KEY ("accountRefId") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_accountRefId_customer_accounts_id_fk" FOREIGN KEY ("accountRefId") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_type" ON "accounts" USING btree ("accountType");--> statement-breakpoint
CREATE INDEX "idx_accounts_business" ON "accounts" USING btree ("businessId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_business_system_key" ON "accounts" USING btree ("businessId","systemKey");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_allocation_invites_code" ON "allocation_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_ownerAccountId" ON "allocation_invites" USING btree ("ownerAccountId");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_businessId" ON "allocation_invites" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_status" ON "allocation_invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_deletedAt" ON "allocation_invites" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_business_logos_businessId" ON "business_logos" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_business_logos_isActive" ON "business_logos" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_business_logos_uploadedBy" ON "business_logos" USING btree ("uploadedBy");--> statement-breakpoint
CREATE INDEX "idx_business_logos_deletedAt" ON "business_logos" USING btree ("deletedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_accounts_accountId" ON "customer_accounts" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "idx_expense_category_business" ON "expense_categories" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_expense_categories_default_account" ON "expense_categories" USING btree ("defaultAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_config_business_system" ON "external_sync_config" USING btree ("businessId","systemName");--> statement-breakpoint
CREATE INDEX "idx_financial_report_business" ON "financial_reports" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_financial_report_type_period" ON "financial_reports" USING btree ("reportType","periodStart","periodEnd");--> statement-breakpoint
CREATE INDEX "idx_depreciation_item" ON "fixed_asset_depreciation" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "idx_depreciation_period" ON "fixed_asset_depreciation" USING btree ("periodYear","periodMonth");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_depreciation_item_period" ON "fixed_asset_depreciation" USING btree ("itemId","periodYear","periodMonth");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_items_sku" ON "items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_items_business" ON "items" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_items_type" ON "items" USING btree ("itemType");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_journal_entry_number" ON "journal_entries" USING btree ("entryNumber");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_date" ON "journal_entries" USING btree ("entryDate");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_source" ON "journal_entries" USING btree ("sourceType","sourceId");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_business" ON "journal_entries" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_journal_line_entry" ON "journal_lines" USING btree ("journalEntryId");--> statement-breakpoint
CREATE INDEX "idx_journal_line_account" ON "journal_lines" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_ownerAccountId" ON "partner_allocations" USING btree ("ownerAccountId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_ownerBusinessId" ON "partner_allocations" USING btree ("ownerBusinessId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_partnerAccountId" ON "partner_allocations" USING btree ("partnerAccountId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_partnerUserId" ON "partner_allocations" USING btree ("partnerUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partner_allocations_inviteId" ON "partner_allocations" USING btree ("inviteId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_status" ON "partner_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_deletedAt" ON "partner_allocations" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_userId" ON "refresh_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_tokenHash" ON "refresh_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_revenue_category_business" ON "revenue_categories" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "business_idx" ON "suppliers" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "location_idx" ON "suppliers" USING btree ("locationId");--> statement-breakpoint
CREATE INDEX "deleted_idx" ON "suppliers" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_users_id" ON "users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_users_deletedAt" ON "users" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_users_isActive" ON "users" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_users_currentBusinessId" ON "users" USING btree ("currentBusinessId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username_accountId" ON "users" USING btree ("username","accountId");

-- ============================================================
-- DOWN: Rollback the entire migration
-- Drops all tables and enums created by this migration
-- Run this to completely revert the database to a clean state
-- ============================================================

-- Step 1: Drop foreign key constraints
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_accountRefId_customer_accounts_id_fk";
ALTER TABLE IF EXISTS "payment_methods" DROP CONSTRAINT IF EXISTS "payment_methods_accountRefId_customer_accounts_id_fk";
ALTER TABLE IF EXISTS "businesses" DROP CONSTRAINT IF EXISTS "businesses_accountRefId_customer_accounts_id_fk";

-- Step 2: Drop all tables with CASCADE
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "alerts_config" CASCADE;
DROP TABLE IF EXISTS "alerts_log" CASCADE;
DROP TABLE IF EXISTS "allocation_invites" CASCADE;
DROP TABLE IF EXISTS "api_keys" CASCADE;
DROP TABLE IF EXISTS "app_settings" CASCADE;
DROP TABLE IF EXISTS "attachments" CASCADE;
DROP TABLE IF EXISTS "audit_log" CASCADE;
DROP TABLE IF EXISTS "bill_items" CASCADE;
DROP TABLE IF EXISTS "bill_payments" CASCADE;
DROP TABLE IF EXISTS "bills" CASCADE;
DROP TABLE IF EXISTS "budgets" CASCADE;
DROP TABLE IF EXISTS "business_documents" CASCADE;
DROP TABLE IF EXISTS "business_inquiries" CASCADE;
DROP TABLE IF EXISTS "business_logos" CASCADE;
DROP TABLE IF EXISTS "businesses" CASCADE;
DROP TABLE IF EXISTS "cogs_targets" CASCADE;
DROP TABLE IF EXISTS "customer_accounts" CASCADE;
DROP TABLE IF EXISTS "daily_mpesa_ledger" CASCADE;
DROP TABLE IF EXISTS "daily_sale_payments" CASCADE;
DROP TABLE IF EXISTS "daily_sales" CASCADE;
DROP TABLE IF EXISTS "employees" CASCADE;
DROP TABLE IF EXISTS "expense_categories" CASCADE;
DROP TABLE IF EXISTS "expenses" CASCADE;
DROP TABLE IF EXISTS "external_sync_config" CASCADE;
DROP TABLE IF EXISTS "feedback_questionnaires" CASCADE;
DROP TABLE IF EXISTS "feedback_responses" CASCADE;
DROP TABLE IF EXISTS "financial_reports" CASCADE;
DROP TABLE IF EXISTS "fixed_asset_depreciation" CASCADE;
DROP TABLE IF EXISTS "items" CASCADE;
DROP TABLE IF EXISTS "journal_entries" CASCADE;
DROP TABLE IF EXISTS "journal_lines" CASCADE;
DROP TABLE IF EXISTS "ledger_entries" CASCADE;
DROP TABLE IF EXISTS "location_payment_methods" CASCADE;
DROP TABLE IF EXISTS "locations" CASCADE;
DROP TABLE IF EXISTS "master_items" CASCADE;
DROP TABLE IF EXISTS "mpesa_reconciliation" CASCADE;
DROP TABLE IF EXISTS "mpesa_transactions" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "partner_allocations" CASCADE;
DROP TABLE IF EXISTS "partner_commissions" CASCADE;
DROP TABLE IF EXISTS "payment_methods" CASCADE;
DROP TABLE IF EXISTS "payroll_advances" CASCADE;
DROP TABLE IF EXISTS "payroll_entries" CASCADE;
DROP TABLE IF EXISTS "payroll_periods" CASCADE;
DROP TABLE IF EXISTS "payroll_settings" CASCADE;
DROP TABLE IF EXISTS "price_alert_rules" CASCADE;
DROP TABLE IF EXISTS "purchase_order_items" CASCADE;
DROP TABLE IF EXISTS "purchase_orders" CASCADE;
DROP TABLE IF EXISTS "push_subscriptions" CASCADE;
DROP TABLE IF EXISTS "quick_actions_log" CASCADE;
DROP TABLE IF EXISTS "recurring_bill_templates" CASCADE;
DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
DROP TABLE IF EXISTS "revenue_categories" CASCADE;
DROP TABLE IF EXISTS "role_permissions" CASCADE;
DROP TABLE IF EXISTS "supplier_price_history" CASCADE;
DROP TABLE IF EXISTS "suppliers" CASCADE;
DROP TABLE IF EXISTS "user_businesses" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "webhook_deliveries" CASCADE;
DROP TABLE IF EXISTS "webhooks" CASCADE;

-- Step 3: Drop all custom enum types
DROP TYPE IF EXISTS "public"."accountSubType";
DROP TYPE IF EXISTS "public"."accountType";
DROP TYPE IF EXISTS "public"."accountingClass";
DROP TYPE IF EXISTS "public"."action";
DROP TYPE IF EXISTS "public"."advanceStatus";
DROP TYPE IF EXISTS "public"."allocation_invite_status";
DROP TYPE IF EXISTS "public"."allocation_rights";
DROP TYPE IF EXISTS "public"."billStatus";
DROP TYPE IF EXISTS "public"."depreciationMethod";
DROP TYPE IF EXISTS "public"."entryType";
DROP TYPE IF EXISTS "public"."frequency";
DROP TYPE IF EXISTS "public"."itemType";
DROP TYPE IF EXISTS "public"."leadStatus";
DROP TYPE IF EXISTS "public"."orderStatus";
DROP TYPE IF EXISTS "public"."partner_allocation_status";
DROP TYPE IF EXISTS "public"."paymentMethod";
DROP TYPE IF EXISTS "public"."paymentMethod2";
DROP TYPE IF EXISTS "public"."payrollStatus";
DROP TYPE IF EXISTS "public"."revenueCategoryType";
DROP TYPE IF EXISTS "public"."role";
DROP TYPE IF EXISTS "public"."salaryType";
DROP TYPE IF EXISTS "public"."severity";
DROP TYPE IF EXISTS "public"."status";
DROP TYPE IF EXISTS "public"."transactionType";
DROP TYPE IF EXISTS "public"."txnType";
DROP TYPE IF EXISTS "public"."type";
DROP TYPE IF EXISTS "public"."user_type";
