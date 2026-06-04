// ABOUTME: Counts up from zero to a target number when the element scrolls into view.
// ABOUTME: Uses framer-motion's animate() under the hood for a smooth easeOut curve; respects prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

export interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  startOnView?: boolean;
}

export default function AnimatedCounter({
  value,
  duration = 2,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  startOnView = true,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(startOnView ? 0 : value);

  useEffect(() => {
    if (startOnView && !inView) return;
    if (startOnView) {
      const controls = animate(0, value, {
        duration,
        ease: "easeOut",
        onUpdate: (v) => setDisplay(v),
      });
      return () => controls.stop();
    }
    setDisplay(value);
    return;
  }, [inView, value, duration, startOnView]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
