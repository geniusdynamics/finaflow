// ABOUTME: Section-level Monthly/Yearly billing toggle for the Finaflow pricing page.
// ABOUTME: Pill-shaped switcher with a sliding dark indicator; controlled component, used at the section header on tablet+ while the mobile accordion keeps its own internal toggle.
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BillingCycle } from "./ChangeablePricingSection";

export interface BillingCycleToggleProps {
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
  monthlyLabel?: string;
  yearlyLabel?: string;
  yearlyBadge?: string;
  className?: string;
}

export default function BillingCycleToggle({
  value,
  onChange,
  monthlyLabel = "Monthly",
  yearlyLabel = "Yearly",
  yearlyBadge = "−17%",
  className,
}: BillingCycleToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-white p-1 rounded-full border border-[#E8E0D8] shadow-sm relative z-0",
        className,
      )}
      role="group"
      aria-label="Billing cycle"
    >
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#2D2A26] rounded-full shadow-sm -z-10"
        animate={{ x: value === "monthly" ? 0 : "100%" }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
        style={{ left: 4 }}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => onChange("monthly")}
        aria-pressed={value === "monthly"}
        className={cn(
          "min-w-[88px] py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 z-10",
          value === "monthly" ? "text-white" : "text-[#2D2A26]",
        )}
      >
        {monthlyLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        aria-pressed={value === "yearly"}
        className={cn(
          "min-w-[100px] py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 z-10 inline-flex items-center justify-center gap-1.5",
          value === "yearly" ? "text-white" : "text-[#2D2A26]",
        )}
      >
        {yearlyLabel}
        <span
          className={cn(
            "text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-colors duration-300",
            value === "yearly"
              ? "bg-[#2E7D32] text-white"
              : "bg-[#2E7D32]/10 text-[#2E7D32]",
          )}
        >
          {yearlyBadge}
        </span>
      </button>
    </div>
  );
}
