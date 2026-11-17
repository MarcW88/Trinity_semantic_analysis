"use client";

const ALIGN = { left: "left-0", center: "left-1/2 -translate-x-1/2", right: "right-0" };

/** Small "i" bubble that shows an explanation on hover or keyboard focus. */
export function InfoTip({ text, align = "center" }: { text: string; align?: keyof typeof ALIGN }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={text}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold normal-case leading-none text-ink/50 transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand/40">i</button>
      <span role="tooltip" aria-hidden
        className={`pointer-events-none invisible absolute top-full z-30 mt-2 w-72 rounded-xl border border-line bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal whitespace-normal text-ink/80 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${ALIGN[align]}`}>{text}</span>
    </span>
  );
}
