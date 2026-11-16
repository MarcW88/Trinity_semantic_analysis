import Image from "next/image";
import { redirect } from "next/navigation";
import { isAuthenticated, passwordConfigured } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";
import { LangSwitcher } from "@/components/lang-switcher";
import { Reveal } from "@/components/motion";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/seo");
  const { d, lang } = await getDict();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Reveal className="w-full max-w-sm">
        <div className="card space-y-5 p-7">
          <div className="flex items-center justify-between gap-2">
            <Image src="/dedecker-logo.png" alt="DeDecker" width={140} height={40} className="h-10 w-auto" style={{ width: "auto" }} priority />
            <LangSwitcher lang={lang} label={d.common.language} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{d.login.title}</h1>
            <p className="text-sm text-ink/60">{d.common.appTitle} · {d.login.subtitle}</p>
          </div>
          {passwordConfigured()
            ? <LoginForm labels={d.login} />
            : <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{d.login.notConfigured}</p>}
        </div>
      </Reveal>
    </main>
  );
}
