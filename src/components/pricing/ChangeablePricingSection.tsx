// ABOUTME: Mobile-first accordion pricing section with animated billing toggle.
// ABOUTME: Reused from the watermelon ChangeablePricingSection pattern and adapted for the Finaflow marketing page (brand-red highlights, accessible buttons, shareable via a single pricing data array).
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type BillingCycle = "monthly" | "yearly";

export interface PricingFeature {
  text: string;
  hasInfo?: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  badge?: string;
  featuresLabel?: string;
  features: PricingFeature[];
  cta: string;
  highlight?: boolean;
}

export interface ChangeablePricingSectionProps {
  plans: PricingPlan[];
  defaultPlanId?: string;
  defaultBillingCycle?: BillingCycle;
  monthlyLabel?: string;
  yearlyLabel?: string;
  yearlyDiscountNote?: string;
  footerText?: string;
  buttonText?: string;
  ctaHref?: string;
  onContinue?: (planId: string, billingCycle: BillingCycle) => void;
  className?: string;
}

export default function ChangeablePricingSection({
  plans,
  defaultPlanId,
  defaultBillingCycle = "monthly",
  monthlyLabel = "Monthly",
  yearlyLabel = "Yearly",
  yearlyDiscountNote,
  footerText = "Cancel anytime. No long-term contract.",
  buttonText = "Continue",
  ctaHref,
  onContinue,
  className,
}: ChangeablePricingSectionProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(
    defaultPlanId || (plans.length > 0 ? plans[0].id : ""),
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    defaultBillingCycle,
  );

  const handleContinue = () => {
    onContinue?.(selectedPlan, billingCycle);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-muted rounded-lg p-1.5 shadow-sm ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-4">
          <h3 className="text-[17px] font-medium text-foreground tracking-tighter">
            Select a plan
          </h3>
          <div
            className="flex items-center bg-background p-1 rounded-lg relative z-0"
            role="group"
            aria-label="Billing cycle"
          >
            <motion.div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-accent rounded-lg shadow-sm -z-10"
              animate={{ x: billingCycle === "monthly" ? 0 : "100%" }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.7 }}
              style={{ left: 4 }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              aria-pressed={billingCycle === "monthly"}
              className={cn(
                "w-[72px] py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-colors z-10",
                billingCycle === "monthly"
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {monthlyLabel}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              aria-pressed={billingCycle === "yearly"}
              className={cn(
                "w-[72px] py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-colors z-10",
                billingCycle === "yearly"
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {yearlyLabel}
            </button>
          </div>
        </div>

        {yearlyDiscountNote && billingCycle === "yearly" && (
          <p className="px-3 -mt-1 mb-1 text-[10px] text-[#2E7D32] font-medium">
            {yearlyDiscountNote}
          </p>
        )}

        <div className="flex flex-col gap-1">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <motion.div
                layout
                key={plan.id}
                transition={{ type: "spring", bounce: 0.45, duration: 0.7 }}
                className={cn(
                  "relative overflow-hidden rounded-lg transition-colors duration-300 bg-background",
                  isSelected
                    ? "ring-1 ring-[#C73E1D] shadow-[0_4px_16px_hsl(var(--foreground)/0.08)]"
                    : "ring-1 ring-border shadow-sm hover:ring-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${plan.name} plan`}
                  className="w-full text-left px-4 py-3.5 sm:px-5 sm:py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#C73E1D]/40"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-1 gap-3">
                      <div className="mt-0.5 shrink-0">
                        <div
                          className={cn(
                            "w-[18px] h-[18px] rounded-lg flex items-center justify-center border transition-colors",
                            isSelected
                              ? "border-[#C73E1D] bg-[#C73E1D]"
                              : "border-border bg-background",
                          )}
                        >
                          {isSelected && (
                            <Check
                              size={11}
                              strokeWidth={3.5}
                              className="text-white"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[16px] font-medium text-foreground leading-none">
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className="bg-accent text-accent-foreground text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider leading-none">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-1.5 leading-snug sm:leading-none">
                          {plan.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center justify-end text-[15px] sm:text-[16px] font-medium text-foreground leading-none overflow-hidden h-[18px]">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={billingCycle}
                            initial={{
                              y: billingCycle === "yearly" ? 20 : -20,
                              opacity: 0,
                              filter: "blur(4px)",
                            }}
                            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                            exit={{
                              y: billingCycle === "monthly" ? -20 : 20,
                              opacity: 0,
                              filter: "blur(4px)",
                            }}
                            transition={{
                              type: "spring",
                              bounce: 0,
                              duration: 0.4,
                            }}
                            className="inline-block whitespace-nowrap"
                          >
                            {billingCycle === "monthly"
                              ? plan.priceMonthly
                              : plan.priceYearly}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1.5 leading-none">
                        per user/month
                      </span>
                    </div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isSelected && (
                    <motion.div
                      key="features"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        opacity: { duration: 0.2 },
                        height: { duration: 0.3, ease: "easeOut" },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3.5 mt-3.5 sm:pt-4 sm:mt-4 mb-1 border-t border-border mx-4 sm:mx-5">
                        {plan.featuresLabel && (
                          <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-3">
                            {plan.featuresLabel}
                          </p>
                        )}
                        <div className="flex flex-col gap-2.5">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2.5">
                              <Check
                                size={14}
                                strokeWidth={3}
                                className="text-[#C73E1D] shrink-0"
                              />
                              <span className="text-[12px] text-muted-foreground leading-tight">
                                {feature.text}
                              </span>
                              {feature.hasInfo && (
                                <Info
                                  size={13}
                                  className="text-muted-foreground ml-0.5"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 items-center sm:flex-row sm:justify-between mt-5 px-3 pb-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.05em] leading-relaxed text-center sm:text-left">
            {footerText}
          </span>
          {ctaHref ? (
            <a
              href={ctaHref}
              onClick={handleContinue}
              className="w-full sm:w-auto bg-[#C73E1D] text-white px-8 py-2.5 rounded-lg text-[13px] font-medium active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#C73E1D]/40 text-center"
            >
              {buttonText}
            </a>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="w-full sm:w-auto bg-[#C73E1D] text-white px-8 py-2.5 rounded-lg text-[13px] font-medium active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#C73E1D]/40"
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
