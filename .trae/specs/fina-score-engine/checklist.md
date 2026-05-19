# FinaScore Engine — Verification Checklist

## Schema & Data Layer

- [ ] All 5 new database tables (`finaScores`, `finaScoreHistory`, `finaScoreTokens`, `finaScoreAccessLog`, `finaScoreModelVersions`) exist in `db/schema.ts` with correct columns, types, constraints, and indexes
- [ ] Migration SQL file is generated under `db/migrations/` and is syntactically valid
- [ ] `npm run build` passes with the new schema definitions
- [ ] All tables have `locationId` and `businessId` for data isolation
- [ ] Indexes exist on frequently queried columns (location+business, calculation type, composite score, token)

## Type System

- [ ] `types.ts` contains all required interfaces (`ScoreFactor`, `FactorResult`, `ScoreContext`, `FinaScoreResult`)
- [ ] `GradeLetter` type covers all 7 grades (A+, A, B, C, D, E, F)
- [ ] `ScoreDataProvider` adapter interface is defined with all 4 data methods
- [ ] All types are exported from `api/lib/fina-score/types.ts`

## Factor Engines

- [ ] Cashflow Health factor correctly computes: volatility (coefficient of variation), coverage ratio, positive days ratio, trend slope, cash runway
- [ ] Payment Reliability factor correctly computes: on-time rate, avg delay, credit utilization, payment consistency, supplier concentration (HHI)
- [ ] Revenue Stability factor correctly computes: MoM growth (weighted), revenue consistency (CoV), concentration (top 3), seasonality index, DRO
- [ ] Financial Resilience factor correctly computes: current ratio, quick ratio, debt-to-revenue, cash runway days, unreconciled ratio
- [ ] Each factor handles edge cases: insufficient data, zero values, negative values, missing source data
- [ ] Each factor returns normalized 0–100 score
- [ ] Each factor has unit tests with >80% branch coverage

## Aggregator

- [ ] Composite score correctly computes weighted sum of 4 factors
- [ ] Composite mapped to 0–850 scale correctly (0–100 weighted → 0–850 scaled)
- [ ] Grade mapping is correct for all boundary values (781, 721, 661, 561, 461, 301, 0)
- [ ] Partial factor failure (one factor returns error) still computes with remaining factors
- [ ] Score snapshot JSON contains all metadata for historical reproducibility
- [ ] Aggregator has unit tests covering all boundary grades and partial failures

## Engine Facade

- [ ] `calculateScore()` orchestrates all 4 factors → aggregator → DB persistence
- [ ] `getCachedScore()` returns latest score from `finaScores` table
- [ ] `getScoreHistory()` returns paginated history from `finaScoreHistory`
- [ ] 15-minute metric cache prevents repeated DB queries within window
- [ ] Integration tests pass for full pipeline, cache behavior, concurrent requests

## Scheduler & Triggers

- [ ] Daily batch iterates all active locations and calculates scores
- [ ] On-demand refresh respects 15-minute debounce cooldown
- [ ] Trigger events (bill paid, large sale, token verification) initiate recalculation
- [ ] Daily batch is registered in `api/boot.ts` timer
- [ ] Scheduler tests verify batch processing, cooldown enforcement, and trigger firing

## Access Control & Tokens

- [ ] Token generation produces unique 64-character crypto random tokens
- [ ] Token expiry is enforced (expired tokens return 401)
- [ ] Token revocation works immediately (revoked tokens return 401)
- [ ] Optional PIN verification works correctly
- [ ] Max view limits are enforced (tokens expire after N views)
- [ ] All access events are logged to `finaScoreAccessLog` with IP, user-agent, timestamp
- [ ] Access control tests verify all security scenarios

## API Layer

- [ ] `GET /fina-score/current` returns latest score with dimensional breakdown
- [ ] `GET /fina-score/history` returns paginated history (with cursor/offset)
- [ ] `POST /fina-score/refresh` triggers on-demand recalculation
- [ ] `GET /fina-score/access-log` returns paginated access events for the business
- [ ] `POST /fina-score/share` generates shareable token with configurable params
- [ ] `GET /fina-score/verify/:token` returns score data for valid tokens
- [ ] `GET /fina-score/verify/:token/pdf` returns downloadable PDF
- [ ] `POST /fina-score/trigger-recalc` triggers batch recalculation
- [ ] Rate limiting: 100 req/min reads, 10 req/min mutations
- [ ] CSRF protection on all mutation endpoints
- [ ] All endpoints wired into `api/router.ts`
- [ ] Integration tests pass for all endpoints with auth, permissions, errors

## PDF Report Generator

- [ ] PDF contains: composite score (gauge), dimensional breakdown (radar data), trend line, factor explanations
- [ ] White-label branding works (custom logo, colors, disclaimer)
- [ ] Verification QR code is present on the report
- [ ] PDF renders correctly for all score states (high, low, partial)
- [ ] PDF generation tests pass for various data scenarios

## Frontend Components

- [ ] `FinaScoreDashboard.tsx` renders composite score with gauge, dimensional breakdown, and action buttons
- [ ] `FinaScoreGauge.tsx` renders circular gauge correctly for 0–850 range
- [ ] `FinaScoreRadar.tsx` renders 4-dimensional spider chart correctly
- [ ] `FinaScoreTrend.tsx` renders historical trend line chart
- [ ] `FinaScoreBreakdown.tsx` shows expandable factor cards with metrics and recommendations
- [ ] `FinaScoreShareDialog.tsx` correctly generates and displays share tokens
- [ ] `FinaScoreAccessLog.tsx` renders paginated access table
- [ ] `FinaScoreWebview.tsx` renders correctly for valid, expired, and revoked tokens
- [ ] All components are mobile-responsive and keyboard-accessible
- [ ] All components use existing shadcn/ui components for visual consistency
- [ ] New components are lazy-loaded with React.lazy + Suspense

## Compliance

- [ ] PII is automatically redacted from lender-facing API responses
- [ ] Token generation requires explicit business owner consent
- [ ] Tokens are revocable at any time (revoked tokens immediately invalid)
- [ ] GDPR right to erasure: deleting a business cascades to score data
- [ ] Data portability: scores exportable in JSON and PDF formats
- [ ] Regulatory dashboard exposes: score distribution, access audit, consent history

## Performance

- [ ] Read latency <200ms p95 for cached score retrieval
- [ ] Recalculation latency <2s p95 for on-demand scores
- [ ] Cache layer effectively reduces DB queries (hit rate >80% under load)
- [ ] Load test confirms 10,000+ concurrent API requests handled without degradation
- [ ] DB indexes are properly created for score queries

## Spin-Off Readiness

- [ ] `ScoreDataProvider` adapter interface is implemented and documented
- [ ] `FinaFlowDataProvider` implementation exists and passes tests
- [ ] `RestApiDataProvider` specification is documented for future standalone deployment
- [ ] OpenAPI 3.1 specification covers all public endpoints
- [ ] Configuration points documented: DB connection, auth, rate limits, cache TTL, external dependencies
