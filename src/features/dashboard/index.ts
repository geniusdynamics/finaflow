// ABOUTME: Barrel exports for the dashboard feature sub-components.
// ABOUTME: Mirrors the pattern in src/features/reports/index.ts.
export { CashPositionCard } from "./CashPositionCard";
export { CashflowTrendCard } from "./CashflowTrendCard";
export { MobileWalletSummaryCard } from "./MobileWalletSummaryCard";
export { TrendKpiCard, type TrendDirection, type TrendKpiCardProps } from "./TrendKpiCard";
export { BillsPipelineCard, type PipelineBill } from "./BillsPipelineCard";
export { TodayStrip } from "./TodayStrip";
export {
  aggregateCashPosition,
  emptyCashPosition,
  type AccountLike,
  type CashPosition,
} from "./cash-position";
export {
  buildCashflowTrendSeries,
  cashflowTrendIsEmpty,
  computeCashflowYAxisMax,
  type CashflowDay,
  type CashflowChartPoint,
} from "./cashflow-trend-data";
