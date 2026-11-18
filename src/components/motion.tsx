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
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-brand shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Toggleable chips to choose which items are shown, with shortcuts for the default selection and for everything. */
export function ChipFilter({ options, selected, onChange, defaults, labels }: {
  options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void; defaults: string[];
  labels: { top: string; all: string };
}) {
  const set = new Set(selected);
  const btn = (active: boolean) => `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink/70 hover:border-brand/50 hover:text-ink"}`;
  const same = (a: string[]) => a.length === selected.length && a.every((v) => set.has(v));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={btn(same(defaults))} onClick={() => onChange(defaults)}>{labels.top}</button>
      <button type="button" className={btn(same(options.map((o) => o.value)))} onClick={() => onChange(options.map((o) => o.value))}>{labels.all}</button>
      <span className="mx-1 h-4 w-px bg-line" />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={set.has(o.value)} className={btn(set.has(o.value))}
          onClick={() => onChange(set.has(o.value) ? selected.filter((v) => v !== o.value) : [...selected, o.value])}>{o.label}</button>
      ))}
    </div>
  );
}

export function Pager({ page, pages, onChange, labels }: { page: number; pages: number; onChange: (p: number) => void; labels: { prev: string; next: string } }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ {labels.prev}</button>
      <span className="tabular-nums text-ink/60">{page} / {pages}</span>
      <button type="button" className="btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>{labels.next} ›</button>
    </div>
  );
}
