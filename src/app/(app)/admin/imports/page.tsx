import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requirePageUser } from "@/lib/auth/guard";
import { getDict } from "@/lib/i18n/server";
import { makeFormat, issueMessage, t } from "@/lib/i18n";
import { param } from "@/lib/market";
import { getProject } from "@/lib/project";
import { getSeoVersion, listSeoVersions } from "@/lib/seo/repo";
import { getGeoBatch, listGeoBatches } from "@/lib/geo/repo";
import { db, schema } from "@/lib/db";
import type { Issue } from "@/lib/issues";
import { UploadForm } from "@/components/admin/upload-form";
import { PublishButton, RevalidateButton } from "@/components/admin/publish-button";

type SeoSummary = { markets: { market: string; snapshotDate: string; keywords: number; includedKeywords: number; excludedKeywords: number; volume: number; rankings: number; competitors: number }[]; previous: SeoSummary["markets"] | { markets: SeoSummary["markets"] } | null };
type GeoSummary = Record<string, string | number | string[]>;

export default async function ImportsPage({ searchParams }: PageProps<"/admin/imports">) {
  const user = await requirePageUser("admin");
  const sp = await searchParams;
  const kind = param(sp.kind, "seo") === "geo" ? "geo" : "seo";
  const selected = /^\d+$/.test(param(sp.id, "")) ? Number(sp.id) : null;
  const { d, lang } = await getDict();
  const a = d.admin;
  const f = makeFormat(lang);
  const project = await getProject(user.projectId);
  const seoList = kind === "seo" ? await listSeoVersions(user.projectId) : [];
  const geoList = kind === "geo" ? await listGeoBatches(user.projectId) : [];
  const detail = selected ? (kind === "seo" ? await getSeoVersion(user.projectId, selected) : await getGeoBatch(user.projectId, selected)) : null;
  const events = await db.select({ e: schema.importEvents, email: schema.users.email }).from(schema.importEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.importEvents.actorId))
    .where(eq(schema.importEvents.projectId, user.projectId)).orderBy(desc(schema.importEvents.id)).limit(30);
  const issues = ((detail?.issues as Issue[] | null) ?? []);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const tab = (k: string, label: string) => (
    <Link href={`/admin/imports?kind=${k}`} aria-current={kind === k ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm ${kind === k ? "bg-brown text-white" : "bg-white border border-line"}`}>{label}</Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{a.title}</h1>
        <div className="flex gap-1">{tab("seo", a.seoTab)}{tab("geo", a.geoTab)}</div>
      </div>

      <section className="card space-y-2">
        <h2 className="font-semibold">{a.upload}</h2>
        <p className="text-sm text-gray-600">{a.uploadHelp}</p>
        <UploadForm kind={kind} labels={a} blob={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />
        <a className="text-sm text-brown underline" href={`/templates/${kind}_template.xlsx`} download>{a.template}</a>
      </section>

      {detail && (
        <section className="card space-y-3" aria-labelledby="preview">
          <h2 id="preview" className="font-semibold">{a.preview} · {detail.filename}</h2>
          <p className="text-xs text-gray-500">SHA-256 {detail.sha256}</p>
          {kind === "seo" && detail.summary ? <SeoPreview s={detail.summary as SeoSummary} d={d} f={f} /> : null}
          {kind === "geo" && detail.summary ? <GeoPreview s={detail.summary as GeoSummary} d={d} /> : null}
          <div className="flex flex-wrap gap-2">
            {kind === "seo" && detail.status !== "failed" && project.activeSeoVersionId !== detail.id && (
              <PublishButton kind="seo" id={detail.id} expectedActive={project.activeSeoVersionId} rollback={detail.status === "published"} labels={a} />
            )}
            {kind === "geo" && detail.status === "validated" && (
              <>
                <PublishButton kind="geo" id={detail.id} expectedActive={null} rollback={false} labels={a} />
                <RevalidateButton id={detail.id} label={a.revalidate} />
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{a.errors} ({errors.length}) · {a.warnings} ({warnings.length})</h3>
            {issues.length === 0 ? <p className="text-sm text-gray-600">{a.noIssues}</p> : (
              <div className="max-h-96 overflow-auto">
                <table className="tbl">
                  <thead><tr>{Object.values(a.issueCols).map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                  <tbody>
                    {[...errors, ...warnings].slice(0, 500).map((i, n) => (
                      <tr key={n} className={i.level === "error" ? "bg-red-50" : "bg-amber-50"}>
                        <td>{i.level === "error" ? a.errors : a.warnings}</td><td>{i.sheet ?? ""}</td><td className="num">{i.row ?? ""}</td>
                        <td>{i.field ?? ""}</td><td className="max-w-xs truncate">{i.value ?? ""}</td><td>{issueMessage(d, i)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">{a.history}</h2>
        <table className="tbl">
          <thead><tr>
            {kind === "seo" && <th scope="col">{a.version}</th>}
            <th scope="col">{a.file}</th><th scope="col">{a.status}</th><th scope="col">{a.author}</th><th scope="col">{a.date}</th><th scope="col">{a.actions}</th>
          </tr></thead>
          <tbody>
            {(kind === "seo" ? seoList : geoList).map((v) => (
              <tr key={v.id} className={selected === v.id ? "bg-cream" : ""}>
                {kind === "seo" && <td className="num">v{(v as (typeof seoList)[number]).version}</td>}
                <td>{v.filename}</td>
                <td>
                  {a.statuses[v.status as keyof typeof a.statuses]}
                  {kind === "seo" && project.activeSeoVersionId === v.id && <span className="ml-2 rounded bg-green-100 px-1.5 text-xs text-green-800">{a.active}</span>}
                </td>
                <td>{v.authorEmail ?? ""}</td><td>{f.dateTime(v.createdAt)}</td>
                <td><Link className="text-brown underline" href={`/admin/imports?kind=${kind}&id=${v.id}`}>{a.preview}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">{a.events}</h2>
        <table className="tbl">
          <tbody>
            {events.map(({ e, email }) => (
              <tr key={e.id}><td>{f.dateTime(e.createdAt)}</td><td>{e.kind.toUpperCase()}</td><td>{e.action}</td><td>{e.refId ?? ""}</td><td>{email ?? ""}</td><td>{e.reason ?? ""}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );

  function SeoPreview({ s, d: dd, f: ff }: { s: SeoSummary; d: typeof d; f: typeof f }) {
    const prev = Array.isArray(s.previous) ? s.previous : (s.previous as { markets?: SeoSummary["markets"] } | null)?.markets ?? [];
    const sum = dd.admin.summary;
    return (
      <table className="tbl">
        <thead><tr>{[sum.market, sum.date, sum.keywords, sum.included, sum.excluded, sum.volume, sum.rankings, sum.competitors, sum.change].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {s.markets.map((m) => {
            const p = prev.find((x) => x.market === m.market);
            return (
              <tr key={m.market}>
                <td>{m.market}</td><td>{ff.date(m.snapshotDate)}</td><td className="num">{ff.int(m.keywords)}</td><td className="num">{ff.int(m.includedKeywords)}</td>
                <td className="num">{ff.int(m.excludedKeywords)}</td><td className="num">{ff.int(m.volume)}</td><td className="num">{ff.int(m.rankings)}</td><td className="num">{ff.int(m.competitors)}</td>
                <td className="num">{p ? `${m.includedKeywords - p.includedKeywords >= 0 ? "+" : ""}${m.includedKeywords - p.includedKeywords} / ${m.volume - p.volume >= 0 ? "+" : ""}${ff.int(m.volume - p.volume)}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}

function GeoPreview({ s, d }: { s: GeoSummary; d: Awaited<ReturnType<typeof getDict>>["d"] }) {
  const g = d.admin.geoSummary;
  const items: [string, string][] = [
    [d.admin.summary.market, String(s.market)], [g.period, `${s.collectedFrom} → ${s.collectedTo}`], [g.questions, String(s.questions)],
    [g.runs, String(s.runs)], [g.errors, String(s.errors)], [g.citations, String(s.citations)], [g.newQuestions, String(s.newQuestions)],
    [g.newRuns, String(s.newRuns)], [g.duplicateRuns, String(s.duplicateRuns)], [g.statusChanges, String(s.statusChanges)],
    [g.platforms, Array.isArray(s.platforms) ? s.platforms.join(", ") : ""],
  ];
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">{items.map(([k, v]) => <div key={k}><dt className="text-gray-500">{k}</dt><dd className="font-medium">{t(v)}</dd></div>)}</dl>;
}
