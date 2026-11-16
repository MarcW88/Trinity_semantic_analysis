import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guard";
import { getDict } from "@/lib/i18n/server";
import { makeFormat } from "@/lib/i18n";
import { getMarkets, getProject } from "@/lib/project";
import { loadGeoMarket } from "@/lib/geo/repo";
import { hostMatches } from "@/lib/geo/contract";
import { QuestionActions, InvalidateButton } from "@/components/geo/question-actions";

export default async function QuestionPage({ params }: PageProps<"/geo/q/[market]/[questionId]">) {
  const user = await requirePageUser();
  const { market, questionId: rawId } = await params;
  const questionId = decodeURIComponent(rawId);
  if (!(await getMarkets(user.projectId)).some((m) => m.code === market)) notFound();
  const { d, lang } = await getDict();
  const g = d.geo;
  const f = makeFormat(lang);
  const project = await getProject(user.projectId);
  const { questions, runs } = await loadGeoMarket(user.projectId, market);
  const q = questions.find((x) => x.questionId === questionId);
  if (!q) notFound();
  const qRuns = runs.filter((r) => r.questionId === questionId).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const isAdmin = user.role === "admin";
  return (
    <div className="space-y-6">
      <Link href={`/geo?market=${market}`} className="text-sm text-brown underline">← {d.common.back}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{q.versions[q.versions.length - 1]?.question}</h1>
          <p className="text-sm text-gray-600">{questionId} · {market} · {q.status === "active" ? g.active : g.archived}{q.categoryId ? ` · ${q.categoryId}` : ""}</p>
        </div>
        {isAdmin && <QuestionActions market={market} questionId={questionId} status={q.status} labels={g} />}
      </div>
      <section className="card">
        <h2 className="mb-2 font-semibold">{g.versions}</h2>
        <ol className="space-y-1 text-sm">{q.versions.map((v) => <li key={v.version}><span className="font-medium">v{v.version}</span> — {v.question}</li>)}</ol>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">{g.timeline}</h2>
        <p className="mb-2 text-xs text-gray-500">{g.tz}</p>
        <table className="tbl">
          <thead><tr>{Object.values(g.rcol).map((h) => <th key={h} scope="col">{h}</th>)}{isAdmin && <th scope="col" />}</tr></thead>
          <tbody>
            {qRuns.map((r) => (
              <tr key={r.runId} className={r.invalidatedAt ? "opacity-50" : ""}>
                <td className="whitespace-nowrap">{f.dateTime(r.observedAt)}<div className="text-xs text-gray-500">{r.runId} · v{r.questionVersion}</div></td>
                <td>{r.platform}</td><td>{r.model}</td><td>{g.ws[r.webSearch]}</td>
                <td>{r.invalidatedAt ? `${g.invalidated} (${r.invalidReason ?? ""})` : r.status === "success" ? g.success : `${g.error}${r.errorCode ? ` (${r.errorCode})` : ""}`}</td>
                <td>{r.brandMentioned === null ? "—" : r.brandMentioned ? d.common.yes : d.common.no}</td>
                <td>
                  <ul className="space-y-0.5">
                    {r.citations.map((c) => (
                      <li key={c.citedUrl}>
                        <a href={c.citedUrl} target="_blank" rel="noopener noreferrer nofollow" className={`underline ${hostMatches(c.host, project.clientDomains) ? "font-semibold text-brown" : "text-gray-700"}`}>
                          {c.citationOrder ? `${c.citationOrder}. ` : ""}{c.host}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {r.answerText && <details className="mt-1 text-xs"><summary className="cursor-pointer">{g.answer}</summary><p className="whitespace-pre-wrap">{r.answerText}</p></details>}
                </td>
                {isAdmin && <td>{!r.invalidatedAt && <InvalidateButton runId={r.runId} labels={g} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
