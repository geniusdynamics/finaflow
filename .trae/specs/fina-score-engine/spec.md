# FinaScore Engine — Comprehensive Technical & Business Specification

## Table of Contents
1. Core System & Engine Implementation
2. Research-Backed Scope Validation
3. Future Improvement & Extension Roadmap
4. Independent Platform Spin-Off Feasibility & Proposal

---

## 1. Core System & Engine Implementation

### 1.1 Why FinaScore

FinaScore is a business credit scoring system purpose-built for Small and Medium Enterprises (SMEs) in emerging markets. It leverages existing financial data from the FinaFlow ecosystem (cashflow, accounting, payment behavior) to produce a transparent, multi-dimensional creditworthiness score that serves both business owners and lenders.

### 1.2 What Changes

- New `api/lib/fina-score/` engine module with factor-based scoring architecture
- New database tables: `fina_scores`, `fina_score_history`, `fina_score_access_log`, `fina_score_tokens`
- New API router: `api/fina-score-router.ts` with business-facing, lender-facing, and internal endpoints
- New frontend features: `src/features/fina-score/` with dashboard, gauge, radar chart, trend, share dialog, access log, and webview components
- Hybrid refresh scheduler (daily batch + on-demand trigger events)
- Shareable token-based webview for lenders (partner-infrastructure pattern)
- PDF report generation via existing `BusinessDocuments` infrastructure
- **BREAKING**: None — entirely additive, no existing schema or API changes

### 1.3 Functional Requirements

#### 1.3.1 Credit Data Ingestion

The system SHALL ingest structured financial data from the following existing FinaFlow tables:

| Data Domain | Source Tables | Refresh Cadence |
|---|---|---|
| Cashflow Activity | `daily_sales`, `mobile_wallet_transactions`, `daily_ledger`, `accounts` | Daily batch + on-demand |
| Payment Behavior | `bills`, `bill_payments`, `expenses`, `purchase_orders` | Daily batch + on-demand |
| Revenue Stability | `daily_sales`, `journal_lines` (revenue accounts), `partner_commissions` | Daily batch + on-demand |
| Financial Resilience | `accounts`, `bills`, `journal_entries`, `ledger_entries` | Daily batch + on-demand |

The data ingestion pipeline SHALL:

- Extract data for the trailing 90–180 day window for each scoring calculation
- Normalize multi-currency amounts to the business's base currency using the existing `CurrencyConverter` service
- Filter out deleted records (`deletedAt IS NOT NULL`)
- Respect location-level data isolation (all queries scoped by `locationId`)
- Cache aggregated metrics for 15 minutes to reduce repeated database load

#### 1.3.2 Multi-Model Risk Calculation Engine

The scoring engine SHALL implement four independent factor models, each calculating a normalized score (0–100) and grade letter (A+ through F):

**Cashflow Health (Weight: 35%)**
- Daily inflow/outflow volatility (coefficient of variation over 90 days)
- Coverage ratio (avg daily inflow ÷ avg daily outflow)
- Positive cashflow days ratio (percentage of days with net positive cashflow)
- Cashflow trend direction (slope of 30-day moving average)
- Minimum cash runway in days

**Payment Reliability (Weight: 25%)**
- On-time payment rate (percentage of bills paid on or before due date)
- Average payment delay (mean days early or late)
- Credit utilization ratio (outstanding bills ÷ average monthly revenue)
- Payment consistency (standard deviation of payment timing)
- Supplier concentration (Herfindahl-Hirschman Index of supplier diversity)

**Revenue Stability (Weight: 25%)**
- Month-over-month growth rate (weighted average of last 3 months)
- Revenue consistency (coefficient of variation of monthly revenue)
- Revenue concentration (percentage from top 3 sources)
- Seasonality index (variance from rolling monthly average)
- Days revenue outstanding (average time from sale to payment)

**Financial Resilience (Weight: 15%)**
- Current ratio (liquid assets ÷ short-term liabilities)
- Quick ratio ((cash + equivalents) ÷ current liabilities)
- Debt-to-revenue ratio (total liabilities ÷ annualized revenue)
- Cash runway (cash balance ÷ avg daily operating costs)
- Unreconciled transaction ratio

#### 1.3.3 Composite Score Aggregation

The engine SHALL compute:

- **Composite Score**: Weighted sum of the four factor scores, mapped to a 0–850 scale
- **Overall Grade**: Letter grade derived from the composite score
- **Dimensional Scores**: Individual 0–100 scores for transparency and drill-down

**Grade Mapping:**

| Composite Range | Grade | Meaning |
|---|---|---|
| 781–850 | A+ | Exceptional — low risk, strong financial health |
| 721–780 | A | Strong — stable finances, reliable payment history |
| 661–720 | B | Good — generally stable, minor concerns |
| 561–660 | C | Fair — moderate risk, some warning signs |
| 461–560 | D | Watch — elevated risk, needs attention |
| 301–460 | E | Concerning — high risk, significant issues |
| 0–300 | F | Critical — severe financial distress |

#### 1.3.4 Real-Time Scoring API

The API SHALL expose the following endpoints:

```
# Business-facing endpoints
GET  /fina-score/current           → Latest score with dimensional breakdown
GET  /fina-score/history           → Score trend over time (paginated)
POST /fina-score/refresh           → Manually trigger on-demand recalculation
GET  /fina-score/access-log        → Lender access history (paginated)
POST /fina-score/share             → Generate shareable access token

# Lender/Third-party endpoints
GET  /fina-score/verify/:token     → Authenticated webview with score report
GET  /fina-score/verify/:token/pdf → Downloadable PDF score report

# Internal/Scheduler endpoints
POST /fina-score/trigger-recalc    → Trigger batch recalculation
```

**Performance SLAs:**
- Sub-200ms latency for cached score retrieval (p95)
- Sub-2s latency for on-demand score recalculation (p95)
- 99.99% uptime for read endpoints
- Support for 10,000+ concurrent API requests

#### 1.3.5 Compliance Modules

The system SHALL implement:

- **Automated PII Redaction**: All access logs and shareable tokens SHALL strip PII from API responses that are not explicitly authorized for the requesting party
- **Consent Management**: Shareable tokens SHALL require explicit business owner consent via the `/fina-score/share` endpoint, with configurable expiry (default 7 days, max 30 days). Tokens SHALL be revocable at any time.
- **Regulatory Reporting**: An internal dashboard SHALL expose:
  - Score distribution reports (aggregate, no PII)
  - Access audit trails with timestamps, parties, and data accessed
  - Consent revocation history
  - Data retention compliance metrics

### 1.4 Non-Functional Requirements

| Requirement | Target | Measurement |
|---|---|---|
| Uptime (core scoring reads) | 99.99% | Monthly uptime calculation |
| Read latency (p95) | <200ms | APM tracing |
| Write/recalc latency (p95) | <2s | APM tracing |
| Concurrent API requests | 10,000+ | Load testing |
| Data encryption (at rest) | AES-256 | DB encryption config |
| Data encryption (in transit) | TLS 1.3 | Network config |
| PII redaction latency | <50ms added | Integration testing |
| Audit log retention | 7 years | DB retention policy |

### 1.5 Technical Architecture

#### 1.5.1 Cloud-Native Microservices Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FinaFlow Monolith (Phase 1)                    │
│                                                                      │
│  ┌─────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   HTTP Router        │  │        FinaScore Engine Module       │  │
│  │   (Hono.js/tRPC)     │  │        api/lib/fina-score/           │  │
│  │                      │  │                                      │  │
│  │  /fina-score/*       │──│  index.ts → Facade & orchestration  │  │
│  └──────────┬───────────┘  │  types.ts → Type definitions        │  │
│             │              │  factors/                            │  │
│             │              │   ├── cashflow-health.ts             │  │
│  ┌──────────▼───────────┐  │   ├── payment-reliability.ts        │  │
│  │   Partner Invite      │  │   ├── revenue-stability.ts         │  │
│  │   Infrastructure      │  │   └── financial-resilience.ts      │  │
│  │   (token/access)      │  │  aggregator.ts → Composite & grade │  │
│  └───────────────────────┘  │  scheduler.ts → Batch & triggers   │  │
│                             │  access-control.ts → Token mgmt    │  │
│  ┌───────────────────────┐  │  report-generator.ts → PDF output  │  │
│  │   DB Layer             │  └──────────────────────────────────────┘  │
│  │   (Drizzle ORM)        │                                      │
│  └───────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1.5.2 Data Pipeline Architecture

```
┌────────────┐   ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│  Source    │   │  Metric       │   │  Score Engine     │   │  Storage     │
│  Tables    │──→│  Extractor    │──→│  (Factor Calc)   │──→│  (Scores +   │
│            │   │  (SQL + agg)  │   │  (Node.js)       │   │   History)   │
└────────────┘   └──────────────┘   └──────────────────┘   └──────────────┘
                                                        │
                                                        ▼
                                                ┌──────────────┐
                                                │  Cache Layer  │
                                                │  (15-min TTL) │
                                                └──────────────┘
```

#### 1.5.3 Model Versioning Framework

Each factor calculation SHALL include a `model_version` field in the score snapshot. The version follows semver:

- **Major**: Weight restructuring or new factor introduction
- **Minor**: Formula refinement or data source addition
- **Patch**: Bug fix or calibration adjustment

Version metadata SHALL be stored in a `fina_score_model_versions` table:

```typescript
export const finaScoreModelVersions = pgTable("fina_score_model_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 20 }).notNull(),
  factors: jsonb("factors").notNull(),           // Full weight/config for each factor
  changelog: text("changelog"),
  isActive: boolean("is_active").default(false).notNull(),
  deployedAt: timestamp("deployedAt").defaultNow().notNull(),
});
```

Every score calculation SHALL reference `modelVersion` so historical scores remain reproducible.

#### 1.5.4 Audit Logging

All score calculations and data access events SHALL be logged to:
1. `fina_score_access_log` — lender access events (who, when, token, IP, user-agent)
2. `audit_log` — existing FinaFlow audit trail for system-level events (score recalculations, token generation/revocation, model version changes)

### 1.6 Database Schema

```typescript
// ─── Score snapshots (daily + on-demand) ───
export const finaScores = pgTable("fina_scores", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),

  compositeScore: integer("composite_score").notNull(),              // 0-850

  // Dimensional scores (0-100)
  cashflowHealthScore: integer("cashflow_health_score").notNull(),
  paymentReliabilityScore: integer("payment_reliability_score").notNull(),
  revenueStabilityScore: integer("revenue_stability_score").notNull(),
  financialResilienceScore: integer("financial_resilience_score").notNull(),

  // Letter grades
  cashflowGrade: varchar("cashflow_grade", { length: 2 }).notNull(),
  paymentGrade: varchar("payment_grade", { length: 2 }).notNull(),
  revenueGrade: varchar("revenue_grade", { length: 2 }).notNull(),
  resilienceGrade: varchar("resilience_grade", { length: 2 }).notNull(),
  overallGrade: varchar("overall_grade", { length: 2 }).notNull(),

  // Calculation metadata
  calculationType: varchar("calculation_type", { length: 10 }).notNull(),  // 'daily' | 'on_demand'
  modelVersion: varchar("model_version", { length: 20 }).notNull(),
  scoreSnapshot: jsonb("score_snapshot"),                                   // Full breakdown
  calculationDurationMs: integer("calculation_duration_ms"),

  dataRangeStart: date("data_range_start"),
  dataRangeEnd: date("data_range_end").notNull(),

  lenderAccessCount: integer("lender_access_count").default(0).notNull(),

  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  locationBusinessIdx: index("idx_fina_scores_loc_biz").on(table.locationId, table.businessId),
  calcTypeIdx: index("idx_fina_scores_calc_type").on(table.calculationType),
  compositeScoreIdx: index("idx_fina_scores_composite").on(table.compositeScore),
}));

// ─── Score history (trend tracking, append-only) ───
export const finaScoreHistory = pgTable("fina_score_history", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  compositeScore: integer("composite_score").notNull(),
  scoreSnapshot: jsonb("score_snapshot"),
  modelVersion: varchar("model_version", { length: 20 }).notNull(),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
}, (table) => ({
  locBizDateIdx: index("idx_fina_score_history_loc_biz_date").on(table.locationId, table.businessId, table.calculatedAt),
}));

// ─── Shareable access tokens ───
export const finaScoreTokens = pgTable("fina_score_tokens", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  pinCode: varchar("pin_code", { length: 6 }),                          // Optional PIN for extra security
  recipientName: varchar("recipient_name", { length: 255 }),            // Lender/partner name
  recipientEmail: varchar("recipient_email", { length: 320 }),          // For audit tracking
  maxViews: integer("max_views").default(5).notNull(),
  currentViews: integer("current_views").default(0).notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
});

// ─── Lender access log ───
export const finaScoreAccessLog = pgTable("fina_score_access_log", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  tokenId: bigint("tokenId", { mode: "number" }).references(() => finaScoreTokens.id),
  accessedBy: varchar("accessed_by", { length: 255 }),                  // From token recipient
  accessType: varchar("access_type", { length: 20 }).notNull(),         // 'lender_portal' | 'shared_link' | 'api_direct'
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  action: varchar("action", { length: 20 }).notNull(),                  // 'viewed' | 'downloaded_pdf'
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => ({
  locBizIdx: index("idx_fina_score_access_loc_biz").on(table.locationId, table.businessId),
  tokenIdx: index("idx_fina_score_access_token").on(table.tokenId),
}));
```

### 1.7 Compliance Requirements

#### 1.7.1 GDPR Compliance
- Business owners SHALL have the right to access their scoring data via the dashboard
- Right to erasure: Deleting a business location SHALL cascade-delete all associated score data
- Data portability: Score reports SHALL be exportable in JSON and PDF formats
- Consent records SHALL be maintained for all score sharing events

#### 1.7.2 PCI DSS Alignment
- While FinaScore does not process raw card data, score calculations may reference financial transaction volumes. All data in transit SHALL use TLS 1.3, and all stored data SHALL use AES-256 encryption.
- Access logs SHALL be retained for audit purposes for a minimum of 12 months (extendable to 7 years for regulatory compliance).

#### 1.7.3 CCPA Compliance
- California residents (where applicable) SHALL be able to opt out of score data being shared with third parties
- A "Do Not Share" flag SHALL be available on the business profile settings

#### 1.7.4 Local Financial Regulatory Frameworks
- For operations in Kenya (CBK), Uganda (BOU), Tanzania (BOT), and other markets:
  - Score methodology SHALL be documented and made available to regulators on request
  - Score model changes SHALL be logged with version history for regulatory review
  - Algorithmic fairness testing SHALL be performed quarterly to detect demographic bias

### 1.8 Error Handling & Resilience

| Scenario | Behavior |
|---|---|
| Source data unavailable (table down) | Return last cached score with `dataStaleness` warning |
| Individual factor calculation fails | Return partial score with `failedFactors[]` array |
| Token expired or revoked | Return 401 with `code: "TOKEN_EXPIRED"` or `code: "TOKEN_REVOKED"` |
| Rate limit exceeded | Return 429 with retry-after header |
| Concurrent recalculation request | Debounce: if recalc in progress, return 409 with `code: "CALCULATION_IN_PROGRESS"` |
| Multi-currency conversion failure | Skip currency conversion, use original amounts with warning flag |

---

## 2. Research-Backed Scope Validation

### 2.1 Industry Benchmark Analysis

#### 2.1.1 Traditional Credit Scoring (FICO)

| Feature | FICO Score | FinaScore |
|---|---|---|
| Market Focus | Consumer credit (US-centric) | SME business (emerging markets) |
| Data Sources | Credit bureau reports (payment history, amounts owed, credit history length, new credit, credit mix) | Cashflow, payment behavior, revenue, financial resilience |
| Score Range | 300–850 | 0–850 (familiar mapping) |
| Transparency | Proprietary algorithm (opaque) | Fully transparent (all factors shown) |
| Update Cadence | Monthly (bureau refresh) | Daily + on-demand |
| SME Coverage | Limited (thin credit files) | Built for SME data ecosystem |

**Key Differentiation**: FinaScore serves the 65% of SMEs globally that lack traditional credit bureau files. By using operational cashflow data instead of credit history, FinaScore opens credit access to underserved businesses.

#### 2.1.2 Alternative Scoring Platforms

| Platform | Focus | FinaScore Delta |
|---|---|---|
| **Experian Business** | Credit bureau + public records | FinaScore uses real-time operational data, not historical bureau records |
| **CredoLab** | Smartphone-based digital scoring | FinaScore uses actual financial data, not behavioral proxies |
| **LenddoEFL** | Psychometric + digital footprint | FinaScore uses verifiable accounting data |
| **Cignifi** | Mobile phone usage patterns | FinaScore uses platform-native financial data |
| **Nova Credit** | Cross-border credit history | FinaScore targets domestic SMEs with operational data |

#### 2.1.3 Unique Value Propositions

1. **Platform-Native Data**: FinaScore is embedded in the accounting tool businesses already use — no separate onboarding or data sharing
2. **Transparent, Actionable Breakdown**: Businesses see which factors hurt their score and get specific improvement recommendations
3. **Lender-Verified Access**: Shareable tokens with audit trails build trust between businesses and lenders
4. **Real-Time Adaptation**: Scores update daily and on-demand, reflecting current financial reality (not 3-month-old bureau data)
5. **Emerging Market Optimization**: Built from the ground up for markets where cashflow data is more reliable than credit bureau data

### 2.2 Market Research: SME & Underbanked Credit Scoring

#### 2.2.1 Market Size & Opportunity

| Metric | Value | Source |
|---|---|---|
| Global SME credit gap | $5.7 trillion | IFC (International Finance Corporation) |
| SMEs with unmet credit needs | 65% (approx. 130M businesses) | World Bank |
| SMEs in emerging markets lacking credit | 50%+ | McKinsey Global Institute |
| African SME financing gap | $331 billion | African Development Bank |
| Digital lending market CAGR | 25.6% (2024–2030) | Grand View Research |

#### 2.2.2 Target Use Case Validation

**Primary Use Case: SME Internal Financial Health Assessment**
- Business owners need an objective, quantified measure of financial health
- Current alternatives: manual ratio calculation, expensive accountants, or no analysis at all
- FinaScore provides: automatic, daily-updated, 4-dimensional analysis with improvement guidance

**Secondary Use Case: SME Credit Access for Lenders**
- Lenders need reliable, verifiable SME credit data
- Current alternatives: expensive manual due diligence, collateral-based lending, or rejecting SMEs outright
- FinaScore provides: standardized, verifiable, token-shareable score with full audit trail

**Tertiary Use Case: Supply Chain & Trade Credit**
- Suppliers need to assess buyer creditworthiness before extending trade credit
- FinaScore provides: a standardized reference that reduces information asymmetry

### 2.3 Technical Risk Assessment & Mitigation

| Risk | Description | Severity | Mitigation |
|---|---|---|---|
| **Model Bias** | Score systematically disadvantages certain business types, locations, or industries | High | Quarterly fairness testing; factor weights reviewed by domain experts; demographic parity analysis |
| **Data Drift** | Model accuracy degrades over time as business patterns change | Medium | Automated monitoring of score distribution shifts; monthly recalibration; model versioning |
| **Cyber Threats** | Unauthorized access to score data or token hijacking | High | End-to-end encryption; token expiry (max 30 days); optional PIN codes; rate limiting on verify endpoints |
| **Gaming/Manipulation** | Businesses artificially inflate scores by altering accounting data | Medium | Auditable input data (all source data is double-entry); anomaly detection on data patterns |
| **Regulatory Change** | New financial regulations require scoring methodology changes | Low | Modular factor architecture allows factor addition/removal without overhaul; regulatory dashboard |
| **Adverse Selection** | Only high-risk businesses use FinaScore, skewing the model | Low | Score is optional feature; broad FinaFlow user base provides diverse data |

---

## 3. Future Improvement & Extension Roadmap

### 3.1 12-Month Milestones (Foundation & Core Adoption)

| Quarter | Milestone | Deliverables |
|---|---|---|
| **Q1** (Months 1–3) | MVP Launch | Core 4-factor engine, daily batch scheduler, composite score, business dashboard, basic PDF report |
| **Q2** (Months 4–6) | Shareable Score & Lender Access | Token-based webview, access log dashboard, lender API, share dialog UI, PDF with QR verification |
| **Q3** (Months 7–9) | Enhanced Analytics | Score trend charts, improvement recommendations per factor, industry benchmark comparison (anonymized), email notifications on score changes |
| **Q4** (Months 10–12) | Alternative Data Foundation | FinaBill integration (invoice payment data → Payment Reliability), M-Pesa/Daraja API data enrichment, basic configurable factor weights |

**Success Metrics (12 months):**
- 1,000+ active business scores (daily or weekly viewing)
- 50+ lender/partner organizations using score verification
- 500+ score shares generated
- <5% error rate in score predictions (validated against actual repayment data from pilot lenders)

### 3.2 24-Month Milestones (Expansion & Alternative Data)

| Quarter | Milestone | Deliverables |
|---|---|---|
| **Q1** (Months 13–15) | Alternative Data Integration | Telecom data (airtime recharge patterns as reliability proxy), utility bill payment data integration, e-commerce transaction data ingestion API |
| **Q2** (Months 16–18) | Niche Scoring Models | Gig worker scoring model (irregular income patterns), micro-business scoring (reduced data requirements), cryptocurrency asset lending score (wallet analysis) |
| **Q3** (Months 19–21) | Multi-Tenant Enterprise | Enterprise client onboarding portal, custom model fine-tuning per enterprise, white-label branding for score reports, dedicated API rate tiers |
| **Q4** (Months 22–24) | Predictive Scoring | ML-based default probability prediction (in addition to deterministic score), cashflow forecasting integration, "Score Simulator" (what-if analysis for business owners) |

**Success Metrics (24 months):**
- 10,000+ active business scores
- 200+ enterprise/lender clients
- 85%+ client retention rate
- 15% improvement in loan approval rates for FinaScore-verified SMEs (pilot data)

### 3.3 36-Month Milestones (Platform Maturity & Ecosystem)

| Quarter | Milestone | Deliverables |
|---|---|---|
| **Q1** (Months 25–27) | Self-Service Model Training | Internal data science team UI for training/validating custom models, A/B testing framework for scoring models, automated data drift monitoring |
| **Q2** (Months 28–30) | API Ecosystem & Marketplace | Public developer portal with API documentation, SDK libraries (Python, Node.js, PHP, Java), webhook notifications for score changes |
| **Q3** (Months 31–33) | Regulatory Compliance Suite | Automated regulatory reporting dashboards, cross-border data transfer compliance, AI governance framework & documentation |
| **Q4** (Months 34–36) | Ecosystem Network Effects | Federated scoring (cross-institution data sharing with consent), industry-specific benchmark reports, FinaScore Certification program for lenders |

**Success Metrics (36 months):**
- 50,000+ active business scores
- 500+ enterprise/lender clients
- FinaScore accepted as credit assessment tool by 3+ regulated financial institutions
- Independent revenue stream from standalone platform

### 3.4 Platform Extension Proposals

#### 3.4.1 Multi-Tenant Access
- Each tenant (enterprise/lender) SHALL have isolated configuration: custom factor weights, grade mappings, and report branding
- Tenant onboarding SHALL follow the existing partner allocation infrastructure pattern
- Usage-based billing SHALL be tracked per tenant (API calls, score views, PDF downloads)

#### 3.4.2 Custom Model Fine-Tuning
- Enterprise clients SHALL be able to adjust factor weights within defined guardrails (±20% from baseline)
- Advanced clients SHALL be able to upload custom factors via a plugin interface
- All customizations SHALL be versioned and auditable

#### 3.4.3 White-Label Branding
- Enterprise clients SHALL be able to brand score reports with their own logo, colors, and company name
- The verify endpoint SHALL accept a `brand` parameter to render white-labeled versions
- PDF generator SHALL support custom header/footer, disclaimer text, and color schemes

---

## 4. Independent Platform Spin-Off Feasibility & Proposal

### 4.1 Business Case

#### 4.1.1 Market Size Analysis

| TAM Segment | Market Size | FinaScore Addressable Share |
|---|---|---|
| Global SME Lending Technology | $12.4B (2025) | $500M (SME credit scoring tools) |
| Alternative Credit Scoring | $3.8B (2025) | $800M (platform-native scoring) |
| Embedded Finance Platforms | $7.2B (2025) | $300M (white-label scoring) |
| **Total Addressable Market** | **$23.4B** | **$1.6B (FinaScore TAM)** |

#### 4.1.2 Revenue Model Projections

| Revenue Stream | Pricing Model | Year 1 | Year 3 | Year 5 |
|---|---|---|---|---|
| Usage-Based API | $0.10–$0.50 per score query (tiered by volume) | $120K | $1.2M | $4.8M |
| Enterprise License | $2,000–$10,000/month (custom models + white-label) | $180K | $1.8M | $5.4M |
| Custom Model Dev | $15,000–$50,000 per custom model (one-time) | $75K | $300K | $750K |
| Regulatory Reporting | $500–$2,000/month per institution | $30K | $240K | $600K |
| Data Insights Reports | $200–$1,000 per report (benchmarking) | $20K | $180K | $360K |
| **Total Projected Revenue** | | **$425K** | **$3.72M** | **$11.91M** |

#### 4.1.3 Competitive Positioning

| Competitive Advantage | FinaScore Strength | Barrier to Entry |
|---|---|---|
| **Platform-Native Data** | Scores generated from app data with zero additional effort | High — requires both financial platform + scoring engine |
| **Emerging Market Focus** | Built for cashflow-based markets (Africa, SE Asia, LatAm) | Medium — regional knowledge + local partnerships |
| **Transparent Scoring** | Factor-level breakdown with improvement guidance | Low — competitors could copy, but first-mover advantage |
| **Lender-Verified Access** | Token-based sharing with full audit trail | Medium — technical but feasible |
| **Real-Time Updates** | Daily + event-driven refreshes | Medium — requires event infrastructure |

### 4.2 Technical Refactoring for Spin-Off

#### 4.2.1 Core Dependency Abstraction

The following abstractions SHALL be implemented to decouple the FinaScore engine from the FinaFlow monolith:

| Component | Current Dependency | Abstraction Target |
|---|---|---|
| Data Source | Direct Drizzle queries to FinaFlow DB | DataProvider interface with adapter pattern |
| User/Auth | FinaFlow session cookies | JWT-based auth with separate API keys |
| Currency Conversion | `api/lib/currency-converter.ts` | Abstracted as external dependency (configurable provider) |
| PDF Generation | `api/lib/business-documents.ts` | Self-contained report generator |
| Rate Limiting | `api/lib/rate-limit.ts` | Self-contained rate limiter |
| Audit Logging | `api/lib/audit.ts` | Standalone audit service |

#### 4.2.2 DataProvider Interface

```typescript
// api/lib/fina-score/adapters/data-provider.ts
export interface ScoreDataProvider {
  getCashflowData(params: {
    locationId: number;
    startDate: Date;
    endDate: Date;
  }): Promise<CashflowDataPoint[]>;

  getPaymentData(params: {
    locationId: number;
    startDate: Date;
    endDate: Date;
  }): Promise<PaymentDataPoint[]>;

  getRevenueData(params: {
    locationId: number;
    startDate: Date;
    endDate: Date;
  }): Promise<RevenueDataPoint[]>;

  getResilienceData(params: {
    locationId: number;
    startDate: Date;
    endDate: Date;
  }): Promise<ResilienceDataPoint[]>;
}
```

Two implementations:
1. `FinaFlowDataProvider` — Direct DB queries (Phase 1, in-monolith)
2. `RestApiDataProvider` — HTTP-based data ingestion (Phase 2, standalone)

#### 4.2.3 Tiered Access Control System

| Tier | Features | Target |
|---|---|---|
| **Free** | Self-service score view, basic PDF, 1 share token/month | SME businesses |
| **Pro** | Unlimited share tokens, score history, trend charts, improvement recommendations | SME businesses |
| **Business** | Custom factor weights, API access, white-label PDF, 3 team members | Growing businesses |
| **Enterprise** | Full API, custom models, dedicated support, SLA guarantees, regulatory reports | Lenders, banks, fintechs |

#### 4.2.4 Self-Service Developer Portal

- REST API with OpenAPI 3.1 specification
- SDK packages (npm, pip, composer, gradle)
- Interactive API playground (Swagger UI)
- Webhook subscriptions for score change events
- Usage analytics dashboard for API consumers

### 4.3 Legal & Operational Framework

#### 4.3.1 Data Ownership Agreements

- **Business Data**: The business owner retains full ownership of their financial data. FinaScore acts as a data processor.
- **Score Data**: The calculated score is jointly owned — the business for self-assessment, FinaScore for the derived intellectual property.
- **Usage Data**: Anonymous aggregate usage data (score distributions, factor correlations) belongs to FinaScore for model improvement.
- **Data Processing Agreement (DPA)**: Required for all enterprise clients accessing business score data.

#### 4.3.2 Liability Limitations

- FinaScore SHALL provide a "score" not a "credit decision" — lenders SHALL be required to accept terms explicitly stating that FinaScore is not a credit bureau or financial advisor.
- Disclaimer SHALL appear on all score reports: "This score is for informational purposes only and does not constitute financial advice, credit approval, or guarantee of repayment."
- Liability SHALL be capped at 12 months of subscription fees (standard SaaS limitation).
- Professional liability insurance (errors & omissions) SHALL be maintained at minimum $2M coverage.

#### 4.3.3 Cross-Border Data Transfer

- Data residency SHALL be maintained within the region of origin (e.g., African SME data stays in African data centers)
- Standard Contractual Clauses (SCCs) SHALL be used for EU adequacy decisions
- Local data protection registration SHALL be obtained in each operating jurisdiction (e.g., Kenya's ODPC, Uganda's NITA-U)

### 4.4 Go-To-Market Strategy

#### 4.4.1 Pilot Programs (Months 1–6 post-spin-off)

| Pilot Partner | Integration Type | Success Criteria |
|---|---|---|
| **Partner Bank A** (Microfinance) | API-based score query for loan origination | 500+ score queries, 90% API uptime |
| **Partner Fintech B** (Digital Lender) | Webview-based verification for instant loans | 200+ score shares, <2s verification time |
| **Partner Platform C** (Supply Chain) | Embedded scoring in supplier onboarding | 100+ supplier scores, 80% adoption rate |
| **Partner Accounting Firm D** | White-label score reports for clients | 50+ branded reports, positive NPS |

#### 4.4.2 Developer Outreach & Community

- Monthly developer webinars on scoring methodology
- Open-source sample integrations (GitHub repositories)
- Developer challenge/hackathon (best FinaScore integration wins $10K)
- Technical blog series: "Building Credit Scoring for SMEs in Emerging Markets"

#### 4.4.3 Cloud Marketplace Distribution

| Marketplace | Listing Type | Requirements |
|---|---|---|
| **AWS Marketplace** | SaaS subscription (hourly/monthly) | CloudFormation integration, IAM roles |
| **Azure Marketplace** | Managed application | ARM template, Azure AD integration |
| **Google Cloud Marketplace** | SaaS with private offers | GCP service account, Cloud Run deployment |
| **M-Pesa Daraja API Marketplace** | API product listing | Safaricom partnership agreement |

### 4.5 Financial Projections (Spin-Off Scenario)

| Metric | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Development Cost | $350K | $200K | $150K |
| Operations Cost | $120K | $250K | $400K |
| Marketing & Sales | $80K | $150K | $250K |
| **Total Costs** | **$550K** | **$600K** | **$800K** |
| **Revenue** | **$425K** | **$1.2M** | **$3.72M** |
| **Gross Margin** | -$125K | $600K | $2.92M |
| **Cumulative Cash Flow** | -$125K | $475K | $3.395M |
| **Break-Even** | Month 14–16 | | |

---

## Appendix A: Key Assumptions & Constraints

1. FinaScore is additive to existing FinaFlow infrastructure — no breaking changes to existing functionality
2. Multi-currency support (Phase 1 of the wallet aggregation plan) is a prerequisite for cross-currency score normalization
3. All data used for scoring is already available within the FinaFlow ecosystem (no external data partnerships required for MVP)
4. Regulatory compliance is scoped to Kenyan (CBK), Ugandan (BOU), and Tanzanian (BOT) frameworks initially, with expansion planned
5. The FinaBill platform integration will follow in Q3–Q4 of the 12-month roadmap
6. All pricing figures are in USD and should be adjusted for local market conditions

## Appendix B: Glossary

| Term | Definition |
|---|---|
| Composite Score | 0–850 aggregate score derived from weighted factor scores |
| Dimensional Score | Individual 0–100 score for each of the 4 factors |
| Factor | A scoring dimension (Cashflow Health, Payment Reliability, Revenue Stability, Financial Resilience) |
| Grade Letter | A+ through F letter grade mapping for easy interpretation |
| Share Token | Cryptographic token enabling secure, time-limited score sharing |
| On-Demand Recalculation | Real-time score refresh triggered by specific events or manual request |
| Data Drift | Degradation in model accuracy due to changes in underlying data patterns |
| White-Label | Custom-branded score reports for enterprise/lender clients |
