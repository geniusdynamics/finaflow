// ABOUTME: Animated pricing card for the Finaflow desktop and tablet grids.
// ABOUTME: Hosts the blur-morph price transition, hover lift, stagger reveal, featured border glow, and CTA scale on tap.
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BillingCycle, PricingPlan } from "./ChangeablePricingSection";

export interface PricingCardProps {
  plan: PricingPlan;
  billingCycle: BillingCycle;
  index: number;
  ctaHref?: string;
  maxFeatures?: number;
}

export default function PricingCard({
  plan,
  billingCycle,
  index,
  ctaHref = "/login?type=standard",
  maxFeatures = 4,
}: PricingCardProps) {
  const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const visibleFeatures = plan.features.slice(0, maxFeatures);
  const isHighlight = !!plan.highlight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        type: "spring",
        bounce: 0.25,
      }}
      whileHover={{ y: -6 }}
      className="relative h-full"
    >
      {isHighlight && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[1px] rounded-xl"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(199, 62, 29, 0)",
              "0 0 0 4px rgba(199, 62, 29, 0.18)",
              "0 0 0 0 rgba(199, 62, 29, 0)",
            ],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <Card
        className={cn(
          "h-full border transition-shadow duration-300",
          isHighlight
            ? "border-[#C73E1D] bg-gradient-to-b from-[#FFF7F4] to-white shadow-md hover:shadow-xl"
            : "border-[#E8E0D8] bg-white hover:shadow-md",
        )}
      >
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-[#2D2A26]">{plan.name}</h3>
            {plan.badge && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.35 + index * 0.08,
                  type: "spring",
                  bounce: 0.55,
                }}
                className="bg-[#C73E1D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap"
              >
                {plan.badge}
              </motion.span>
            )}
          </div>

          <p className="text-xs text-[#8D8A87] leading-snug min-h-[2.5em]">
            {plan.description}
          </p>

          <div className="relative h-12">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={billingCycle}
                initial={{
                  y: billingCycle === "yearly" ? 10 : -10,
                  opacity: 0,
                  filter: "blur(4px)",
                }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{
                  y: billingCycle === "monthly" ? -10 : 10,
                  opacity: 0,
                  filter: "blur(4px)",
                }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="absolute inset-0 flex items-baseline gap-1"
              >
                <span className="font-serif text-4xl font-bold text-[#2D2A26] whitespace-nowrap">
                  {price}
                </span>
                <span className="text-xs text-[#8D8A87] font-medium whitespace-nowrap">/mo</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {plan.featuresLabel && (
            <p className="text-[10px] font-bold text-[#8D8A87] tracking-widest uppercase">
              {plan.featuresLabel}
            </p>
          )}

          <ul className="flex-1 space-y-2 border-t border-[#E8E0D8] pt-3">
            {visibleFeatures.map((feature, idx) => (
              <motion.li
                key={`${plan.id}-${idx}`}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: 0.25 + idx * 0.05 + index * 0.08,
                  duration: 0.35,
                }}
                className="flex items-start gap-2 text-xs text-[#2D2A26]"
              >
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#2E7D32] mt-0.5" />
                <span className="leading-snug">{feature.text}</span>
              </motion.li>
            ))}
          </ul>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
            className="mt-auto"
          >
            <Link to={ctaHref} className="block">
              <Button
                className={cn(
                  "w-full shadow-sm",
                  isHighlight
                    ? "bg-[#C73E1D] hover:bg-[#C73E1D]/90"
                    : "bg-[#2D2A26] hover:bg-[#1a1815]",
                )}
                size="sm"
              >
                {plan.cta}
              </Button>
            </Link>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
