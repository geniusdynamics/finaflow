// ABOUTME: Centralized hook for financial statement report generation mutations.
// ABOUTME: Provides consistent loading states, error handling, and toast notifications for all report types.
import { useState, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentBusinessId } from "@/hooks/useAuth";

export interface GenerateOptions {
  businessId: number;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  locationId?: number;
}

export type ReportType = "income" | "balance" | "trial" | "assets";

export interface FinancialReportData {
  totalRevenue: string;
  totalCOGS: string;
  grossProfit: string;
  totalExpenses: string;
  netIncome: string;
}

export interface BalanceSheetData {
  assets: {
    current: string[];
    fixed: string[];
    total: string;
  };
  liabilities: { total: string };
  equity: { total: string };
  totalLiabilitiesAndEquity: string;
  balanceCheck: boolean;
}

export interface TrialBalanceData {
  accounts: {
    accountName: string;
    debit: string;
    credit: string;
  }[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
}

export interface AssetRegisterData {
  assets: {
    name: string;
    purchasePrice: string;
    accumulatedDepreciation: string;
    currentBookValue: string;
    status: string;
    purchaseDate: string;
  }[];
  totals: {
    totalCost: string;
    totalAccumulatedDepreciation: string;
    totalBookValue: string;
  };
}

export function useFinancialStatements() {
  const businessId = getCurrentBusinessId() || 1;
  const queryClient = useQueryClient();

  const incomeStatementMutation = trpc.reports.incomeStatement.useMutation();
  const balanceSheetMutation = trpc.reports.balanceSheet.useMutation();
  const trialBalanceMutation = trpc.reports.trialBalance.useMutation();
  const assetRegisterMutation = trpc.reports.assetRegister.useMutation();

  const [incomeStatementData, setIncomeStatementData] = useState<FinancialReportData | null>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceData | null>(null);
  const [assetRegisterData, setAssetRegisterData] = useState<AssetRegisterData | null>(null);
  const [financialTab, setFinancialTabState] = useState<ReportType>("income");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);

  const generateIncomeStatement = useCallback(
    async (options: GenerateOptions) => {
      try {
        const result = await incomeStatementMutation.mutateAsync(options);
        setIncomeStatementData(result);
        queryClient.invalidateQueries({ queryKey: ["reports.incomeStatement"] });
        toast.success("Income Statement generated successfully");
      } catch (e: any) {
        toast.error(`Failed to generate Income Statement: ${e?.message || "Unknown error"}`);
      }
    },
    [incomeStatementMutation, queryClient]
  );

  const generateBalanceSheet = useCallback(
    async (options: GenerateOptions) => {
      try {
        const result = await balanceSheetMutation.mutateAsync(options);
        setBalanceSheetData(result);
        queryClient.invalidateQueries({ queryKey: ["reports.balanceSheet"] });
        toast.success("Balance Sheet generated successfully");
      } catch (e: any) {
        toast.error(`Failed to generate Balance Sheet: ${e?.message || "Unknown error"}`);
      }
    },
    [balanceSheetMutation, queryClient]
  );

  const generateTrialBalance = useCallback(
    async (options: GenerateOptions) => {
      try {
        const result = await trialBalanceMutation.mutateAsync(options);
        setTrialBalanceData(result);
        queryClient.invalidateQueries({ queryKey: ["reports.trialBalance"] });
        toast.success("Trial Balance generated successfully");
      } catch (e: any) {
        toast.error(`Failed to generate Trial Balance: ${e?.message || "Unknown error"}`);
      }
    },
    [trialBalanceMutation, queryClient]
  );

  const generateAssetRegister = useCallback(
    async (options: GenerateOptions) => {
      try {
        const result = await assetRegisterMutation.mutateAsync(options);
        setAssetRegisterData(result);
        queryClient.invalidateQueries({ queryKey: ["reports.assetRegister"] });
        toast.success("Asset Register generated successfully");
      } catch (e: any) {
        toast.error(`Failed to generate Asset Register: ${e?.message || "Unknown error"}`);
      }
    },
    [assetRegisterMutation, queryClient]
  );

  const updateReportDate = useCallback((date: string) => {
    setReportDate(date);
  }, []);

  const changeFinancialTab = useCallback((tab: ReportType) => {
    setFinancialTabState(tab);
  }, []);

  return {
    businessId,
    reportDate,
    financialTab,
    generateIncomeStatement,
    generateBalanceSheet,
    generateTrialBalance,
    generateAssetRegister,
    updateReportDate,
    setFinancialTab: changeFinancialTab,
    incomeStatementData,
    balanceSheetData,
    trialBalanceData,
    assetRegisterData,
    incomeStatementMutation: { ...incomeStatementMutation, isPending: incomeStatementMutation.isPending },
    balanceSheetMutation: { ...balanceSheetMutation, isPending: balanceSheetMutation.isPending },
    trialBalanceMutation: { ...trialBalanceMutation, isPending: trialBalanceMutation.isPending },
    assetRegisterMutation: { ...assetRegisterMutation, isPending: assetRegisterMutation.isPending },
  };
}
