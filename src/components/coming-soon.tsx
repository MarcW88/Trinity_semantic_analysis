import type { Dict } from "@/lib/i18n";

export function ComingSoon({ title, d }: { title: string; d: Dict }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="card flex flex-col items-center gap-2 py-16 text-center" role="status">
        <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-brown">{d.common.comingSoon}</span>
        <p className="max-w-md text-sm text-gray-600">{d.common.comingSoonText}</p>
      </div>
    </div>
  );
}
