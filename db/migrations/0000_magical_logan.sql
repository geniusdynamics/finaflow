CREATE TYPE "public"."action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT');--> statement-breakpoint
CREATE TYPE "public"."advanceStatus" AS ENUM('pending', 'approved', 'partially_repaid', 'repaid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."billStatus" AS ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."entryType" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."leadStatus" AS ENUM('new', 'contacted', 'converted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."orderStatus" AS ENUM('draft', 'sent', 'delivered', 'billed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."paymentMethod2" AS ENUM('cash', 'mpesa', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TYPE "public"."paymentMethod" AS ENUM('cash', 'mpesa', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payrollStatus" AS ENUM('open', 'processing', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'manager', 'employee', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."salaryType" AS ENUM('monthly', 'weekly', 'daily', 'hourly');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('open', 'resolved', 'partial');--> statement-breakpoint
CREATE TYPE "public"."transactionType" AS ENUM('sale', 'expense', 'bill_payment', 'supplier_payment', 'payroll', 'advance', 'transfer', 'opening_balance', 'mpesa_topup', 'drawing', 'deposit');--> statement-breakpoint
CREATE TYPE "public"."txnType" AS ENUM('topup', 'expense', 'transfer', 'bank_transfer', 'airtime', 'utility', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."type" AS ENUM('cash', 'mpesa', 'bank_account');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "type" NOT NULL,
	"accountCode" varchar(20),
	"accountNumber" varchar(100),
	"openingBalance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"currentBalance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"isPaymentMethod" boolean DEFAULT false NOT NULL,
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
	"enteredBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
	"supplierId" bigint,
	"billNumber" varchar(100),
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"amountPaid" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"balanceDue" numeric(15, 2) NOT NULL,
	"issueDate" date NOT NULL,
	"dueDate" date NOT NULL,
	"status" "billStatus" DEFAULT 'pending' NOT NULL,
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
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" varchar(100) NOT NULL,
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
	CONSTRAINT "businesses_accountId_unique" UNIQUE("accountId"),
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
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT '#C73E1D',
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint NOT NULL,
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
	"enteredBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
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
	"nextBillNumber" bigint DEFAULT '1' NOT NULL,
	"nextExpenseNumber" bigint DEFAULT '1' NOT NULL,
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
	"supplierId" bigint,
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
	"phone" varchar(20),
	"locationId" bigint,
	"currentBusinessId" bigint,
	"accountId" varchar(100),
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
CREATE INDEX "idx_refresh_tokens_userId" ON "refresh_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_tokenHash" ON "refresh_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_users_id" ON "users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_users_deletedAt" ON "users" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_users_isActive" ON "users" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_users_currentBusinessId" ON "users" USING btree ("currentBusinessId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username_accountId" ON "users" USING btree ("username","accountId");