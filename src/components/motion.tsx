"use client";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/** Counts from 0 to `value` once visible; `format` renders intermediate values. */
export function CountUp({ value, format }: { value: number | null; format: (n: number | null) => string }) {
  return <CountUpInner key={String(value)} value={value} format={format} />;
}

function CountUpInner({ value, format }: { value: number | null; format: (n: number | null) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || value === null || reduce || !inView) return;
    const controls = animate(0, value, {
      duration: 1.1, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { el.textContent = format(Number.isInteger(value) ? Math.round(v) : v); },
    });
    return () => controls.stop();
  }, [value, inView, reduce, format]);
  return <span ref={ref}>{format(value)}</span>;
}

/** Pill-style segmented control with an animated highlight. */
export function Segmented<T extends string>({ value, options, onChange, layoutId, label, disabled }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; layoutId: string; label: string; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-flex flex-wrap gap-1 rounded-full border border-line bg-white/70 p-1 backdrop-blur">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(o.value)}
            className={`relative rounded-full px-3 py-1 text-sm font-medium transition-colors ${active ? "text-white" : "text-ink/70 hover:text-ink"}`}>
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-brown shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
