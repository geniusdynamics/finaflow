// ABOUTME: A/B-tested rotating hero headline for the Finaflow marketing page.
// ABOUTME: Crossfades through four angles (aspirational, pain point, clarity, relief) every few seconds with a synced subtitle so the same visitor sees multiple value propositions in one session.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface HeadlineVariation {
  id: string;
  headline: string;
  subtitle: string;
}

export const headlineVariations: HeadlineVariation[] = [
  {
    id: "pain-point",
    headline: "Losing track of bills and expenses",
    subtitle:
      "Finaflow keeps every shilling accounted for — from M-Pesa SMS to bank transfers, in one place. Stop reconciling spreadsheets at midnight and start running the business you actually built.",
  },
  {
    id: "aspirational",
    headline: "Business Finances finally made simple",
    subtitle:
      "Track sales, manage expenses, run payroll, and reconcile M-PESA — all in one platform. Built specifically for African SMEs who want real-time financial clarity without the complexity.",
  },
  {
    id: "clarity",
    headline: "See every coin in real time",
    subtitle:
      "Your entire financial landscape at a glance, across every branch and every account. No more end-of-month surprises — just the numbers that matter, exactly when you need them.",
  },
  {
    id: "construction",
    headline: "Construction Expenses, finally at your fingertips",
    subtitle:
      "Track every shilling across materials, labor, and subcontractors — with project-level visibility. No more guessing where the budget went, no more end-of-month pile of receipts to reconcile.",
  },
  {
    id: "budget",
    headline: "Budgeted Expenses, finally Aligned.",
    subtitle:
      "Plan it, track it, stay on it. Finaflow keeps every department aligned to the same budget in real time — with variance alerts before you blow past the line, not after.",
  },
];

export interface RotatingHeadlineProps {
  rotationMs?: number;
  className?: string;
  subtitleClassName?: string;
}

export default function RotatingHeadline({
  rotationMs = 16500,
  className,
  subtitleClassName,
}: RotatingHeadlineProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % headlineVariations.length);
    }, rotationMs);
    return () => clearInterval(interval);
  }, [rotationMs]);

  const current = headlineVariations[index];

  return (
    <div className="space-y-6">
      <h1
        className={className ?? "font-serif text-[1.75rem] leading-[1.15] font-bold tracking-tight text-[#1a1815] md:text-[2.75rem]"}
      >
        <span className="relative block min-h-[6.5rem] md:min-h-[3.75rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${current.id}-headline`}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center"
            >
              <span
                className="block bg-gradient-to-r from-[#A02E1A] via-[#D4A854] to-[#E8A04A] bg-clip-text text-transparent"
                style={{ filter: "drop-shadow(0 1px 1px rgba(160, 46, 26, 0.12))" }}
              >
                {current.headline}
              </span>
            </motion.span>
          </AnimatePresence>
        </span>
      </h1>
      <div
        className={subtitleClassName ?? "relative max-w-xl min-h-[5.5rem] text-lg leading-relaxed text-[#4A4742]"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${current.id}-subtitle`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {current.subtitle}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
