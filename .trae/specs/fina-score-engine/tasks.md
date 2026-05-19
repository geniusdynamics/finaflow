# Tasks — FinaScore Engine Implementation

## Overall Task Sequencing
Implementation follows a bottom-up order: schema → engine core → API layer → frontend → sharing/webview → infrastructure. Each phase builds on the previous, and testing is integrated at every level.

---

### Phase 1: Foundation (Weeks 1–2)

- [ ] **Task 1**: Create database schema for FinaScore
  - Define and add to `db/schema.ts`:
    - [ ] `finaScores` table with composite score, dimensional scores, grades, calculation metadata
    - [ ] `finaScoreHistory` table (append-only trend tracking)
    - [ ] `finaScoreTokens` table (shareable access tokens with expiry, PIN, view limits)
    - [ ] `finaScoreAccessLog` table (lender access audit trail)
    - [ ] `finaScoreModelVersions` table (model versioning metadata)
  - [ ] Run `npm run build` to validate Drizzle schema compilation
  - [ ] Create `db/migrations/` SQL migration file
  - **Sub-Agent**: Use `backend-architect` to add schema definitions following Drizzle ORM patterns

- [ ] **Task 2**: Create FinaScore type system and interfaces
  - [ ] Create `api/lib/fina-score/types.ts` with:
    - `ScoreFactor` interface, `FactorResult`, `ScoreContext`, `FinaScoreResult`
    - `GradeLetter` type, `ScoreDataPoint` interfaces
    - Adapter interfaces (`ScoreDataProvider`)
  - **Sub-Agent**: Use `backend-architect`

### Phase 2: Scoring Engine Core (Weeks 3–5)

- [ ] **Task 3**: Implement Cashflow Health factor
  - [ ] Create `api/lib/fina-score/factors/cashflow-health.ts`
  - [ ] Implement: daily inflow/outflow volatility (coefficient of variation), coverage ratio, positive cashflow days ratio, cashflow trend (30-day moving average slope), minimum cash runway
  - [ ] Queries against `daily_sales`, `mobile_wallet_transactions`, `daily_ledger`, `accounts`
  - [ ] Returns normalized 0–100 score
  - [ ] Write unit tests covering: normal cashflow, volatile cashflow, negative cashflow, insufficient data edge case
  - **Sub-Agent**: Use `backend-architect`

- [ ] **Task 4**: Implement Payment Reliability factor
  - [ ] Create `api/lib/fina-score/factors/payment-reliability.ts`
  - [ ] Implement: on-time payment rate, average payment delay, credit utilization ratio, payment consistency std dev, supplier concentration (Herfindahl-Hirschman Index)
  - [ ] Queries against `bills`, `bill_payments`, `expenses`, `purchase_orders`
  - [ ] Returns normalized 0–100 score
  - [ ] Write unit tests covering: perfect payment history, consistently late payments, no bills (graceful degradation), single supplier concentration
  - **Sub-Agent**: Use `backend-architect`

- [ ] **Task 5**: Implement Revenue Stability factor
  - [ ] Create `api/lib/fina-score/factors/revenue-stability.ts`
  - [ ] Implement: month-over-month growth (weighted 3-month), revenue consistency (coefficient of variation), revenue concentration (top 3 sources %), seasonality index, days revenue outstanding
  - [ ] Queries against `daily_sales`, `journal_lines` (revenue accounts), `partner_commissions`
  - [ ] Returns normalized 0–100 score
  - [ ] Write unit tests covering: steady growth, seasonal business (restaurant/hotel), declining revenue, new business (limited data)
  - **Sub-Agent**: Use `backend-architect`

- [ ] **Task 6**: Implement Financial Resilience factor
  - [ ] Create `api/lib/fina-score/factors/financial-resilience.ts`
  - [ ] Implement: current ratio, quick ratio, debt-to-revenue, cash runway (days), unreconciled transaction ratio
  - [ ] Queries against `accounts`, `bills`, `journal_entries`, `ledger_entries`
  - [ ] Returns normalized 0–100 score
  - [ ] Write unit tests covering: strong balance sheet, high debt load, negative cash runway, unreconciled transactions
  - **Sub-Agent**: Use `backend-architect`

- [ ] **Task 7**: Implement Score Aggregator
  - [ ] Create `api/lib/fina-score/aggregator.ts`
  - [ ] Implement: weighted composite score (0–850), grade letter mapping, score snapshot (JSON) generation
  - [ ] Grade mapping: 781–850→A+, 721–780→A, 661–720→B, 561–660→C, 461–560→D, 301–460→E, 0–300→F
  - [ ] Handle partial results (one factor fails → still compute with remaining)
  - [ ] Write unit tests covering: all weights at extremes, mid-range scores, partial factor failure, grade boundary values
  - **Sub-Agent**: Use `backend-architect`

- [ ] **Task 8**: Implement Engine Facade
  - [ ] Create `api/lib/fina-score/index.ts` — public API facade
  - [ ] `calculateScore(context)`: orchestrates all 4 factors → aggregator → persist
  - [ ] `getCachedScore(locationId, businessId)`: return latest from `finaScores`
  - [ ] `getScoreHistory(locationId, businessId)`: return paginated history
  - [ ] Implement 15-minute metric cache to reduce DB load
  - [ ] Write integration tests: full score calculation pipeline, cache hits/misses, concurrent recalc debounce
  - **Sub-Agent**: Use `backend-architect`

### Phase 3: Hybrid Refresh Scheduler (Week 6)

- [ ] **Task 9**: Implement Scheduler & Trigger System
  - [ ] Create `api/lib/fina-score/scheduler.ts`
  - [ ] Daily batch: Iterate all active locations, calculate scores, archive to history
  - [ ] On-demand trigger: Recalculate when `POST /refresh` called, debounce (15 min cooldown)
  - [ ] Wake-up triggers: bill paid, large sale recorded, lender token verification
  - [ ] Register daily batch in `api/boot.ts` timer
  - [ ] Write tests: batch processes all locations correctly, on-demand respects cooldown, triggers fire correctly
  - **Sub-Agent**: Use `backend-architect`

### Phase 4: Access Control & Token System (Week 7)

- [ ] **Task 10**: Implement Access Control
  - [ ] Create `api/lib/fina-score/access-control.ts`
  - [ ] Token generation: 64-char crypto random token, configurable expiry (7–30 days), optional PIN
  - [ ] Token verification: validate not expired, not revoked, under max view limit
  - [ ] Token revocation: immediate invalidation, logged to audit
  - [ ] Access logging: IP, user-agent, timestamp, action type
  - [ ] Write tests: token generation uniqueness, expiry enforcement, revocation, PIN verification, max view limits
  - **Sub-Agent**: Use `backend-architect`

### Phase 5: API Layer (Week 8)

- [ ] **Task 11**: Create FinaScore API Router
  - [ ] Create `api/fina-score-router.ts`
  - [ ] Business endpoints:
    - `GET /fina-score/current` — latest score with dimensional breakdown
    - `GET /fina-score/history` — paginated history
    - `POST /fina-score/refresh` — manual recalc trigger
    - `GET /fina-score/access-log` — lender access history
    - `POST /fina-score/share` — generate shareable token
  - [ ] Lender endpoints:
    - `GET /fina-score/verify/:token` — authenticated webview data
    - `GET /fina-score/verify/:token/pdf` — PDF download
  - [ ] Internal endpoint:
    - `POST /fina-score/trigger-recalc` — scheduler trigger
  - [ ] Rate limiting: 100 req/min for reads, 10 req/min for mutations
  - [ ] CSRF protection on all mutation endpoints
  - [ ] Wire into `api/router.ts`
  - [ ] Write integration tests: all endpoints with auth, permission checks, rate limiting, error scenarios
  - **Sub-Agent**: Use `backend-architect`

### Phase 6: PDF Report Generator (Week 9)

- [ ] **Task 12**: Implement PDF Report Generator
  - [ ] Create `api/lib/fina-score/report-generator.ts`
  - [ ] Generate PDF with: composite score (gauge visualization), dimensional breakdown (radar chart data), trend data, factor explanations
  - [ ] Leverage existing `api/lib/business-documents.ts` infrastructure
  - [ ] Support white-label branding (logo, colors, custom disclaimer)
  - [ ] Include verification QR code on report
  - [ ] Write tests: PDF generation with various data states, brand customization, error handling for missing data
  - **Sub-Agent**: Use `backend-architect`

### Phase 7: Frontend (Weeks 10–12)

- [ ] **Task 13**: Build FinaScore Dashboard Components
  - [ ] Create `src/features/fina-score/FinaScoreDashboard.tsx` — main score card for business dashboard
  - [ ] Render composite score with gauge visualization and overall grade
  - [ ] Show dimensional breakdown with grade letters for each factor
  - [ ] Add quick-action buttons: Refresh, Share, View History
  - [ ] Integrate into existing Dashboard page or dedicated nav section
  - **Sub-Agent**: Use `frontend-engineer`

- [ ] **Task 14**: Build FinaScore Gauge & Radar Components
  - [ ] `src/features/fina-score/FinaScoreGauge.tsx` — circular gauge showing 0–850
  - [ ] `src/features/fina-score/FinaScoreRadar.tsx` — spider/radar chart for 4 dimensions
  - [ ] Use existing charting infrastructure (recharts from chart-data.ts)
  - [ ] Mobile-responsive, accessible (ARIA labels)
  - **Sub-Agent**: Use `frontend-engineer`

- [ ] **Task 15**: Build FinaScore Trend & Breakdown
  - [ ] `src/features/fina-score/FinaScoreTrend.tsx` — historical trend line chart
  - [ ] `src/features/fina-score/FinaScoreBreakdown.tsx` — expandable factor detail cards with raw metrics
  - [ ] Show improvement recommendations per factor where scores are low
  - **Sub-Agent**: Use `frontend-engineer`

- [ ] **Task 16**: Build Share Dialog & Access Log
  - [ ] `src/features/fina-score/FinaScoreShareDialog.tsx` — modal for generating share tokens
  - [ ] Fields: recipient name/email, expiry, optional PIN
  - [ ] Token display with copy-to-clipboard and direct email link
  - [ ] `src/features/fina-score/FinaScoreAccessLog.tsx` — paginated table of access events
  - [ ] Show: who viewed, when, how many times, PDF downloads
  - **Sub-Agent**: Use `frontend-engineer`

- [ ] **Task 17**: Build Lender Webview
  - [ ] `src/features/fina-score/FinaScoreWebview.tsx` — lender-facing secure page
  - [ ] Route: `/fina-score/verify/:token`
  - [ ] Public route (no auth required — authenticated via token)
  - [ ] Show: composite score, dimensional breakdown, professional PDF download
  - [ ] Mobile-optimized (lenders view on phones)
  - [ ] Error states: expired token, revoked token, invalid token
  - **Sub-Agent**: Use `frontend-engineer`

### Phase 8: Infrastructure & Compliance (Week 13)

- [ ] **Task 18**: Implement Compliance Features
  - [ ] Automated PII redaction in access log API responses
  - [ ] Consent management (token generation requires explicit consent, revocable)
  - [ ] GDPR right to erasure cascade (delete business → delete scores)
  - [ ] Data portability export (JSON + PDF)
  - [ ] Regulatory dashboard data (score distribution, access audit, consent history)
  - **Sub-Agent**: Use `backend-architect`

- [ ] **Task 19**: Performance Optimization & Load Testing
  - [ ] Implement 15-min metric cache layer
  - [ ] Add DB indexes for score queries
  - [ ] Run load test: simulate 10,000 concurrent API requests
  - [ ] Verify: read latency <200ms p95, recalc latency <2s p95
  - [ ] Optimize factor queries (materialized view for frequently-accessed metrics if needed)
  - **Sub-Agent**: Use `backend-architect`

### Phase 9: Spin-Off Preparation (Week 14)

- [ ] **Task 20**: Abstract Core Dependencies for Spin-Off
  - [ ] Create `ScoreDataProvider` adapter interface
  - [ ] Implement `FinaFlowDataProvider` (direct DB queries)
  - [ ] Document `RestApiDataProvider` specification for future standalone deployment
  - [ ] Create OpenAPI 3.1 specification for public API
  - [ ] Document all configuration points for standalone deployment (env vars, DB connection, auth)
  - **Sub-Agent**: Use `backend-architect`

---

# Task Dependencies

- [Task 1] has no dependencies (schema foundation)
- [Task 2] depends on [Task 1]
- [Tasks 3–6] depend on [Task 2] (can be done in parallel)
- [Task 7] depends on [Tasks 3, 4, 5, 6]
- [Task 8] depends on [Task 7]
- [Task 9] depends on [Task 8]
- [Task 10] has no dependencies on engine (can be done in parallel with Phase 2)
- [Task 11] depends on [Tasks 8, 10]
- [Task 12] depends on [Task 8]
- [Tasks 13–17] depend on [Task 11] (can be done in parallel)
- [Task 18] depends on [Task 11]
- [Task 19] depends on [Tasks 8, 11]
- [Task 20] depends on [Task 8] (can be done in parallel with frontend)
