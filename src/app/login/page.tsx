import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDict } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";
import { LangSwitcher } from "@/components/lang-switcher";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/seo");
  const { d, lang } = await getDict();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Image src="/dedecker-logo.png" alt="DeDecker" width={140} height={40} className="h-10 w-auto" priority />
          <LangSwitcher lang={lang} label={d.common.language} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{d.login.title}</h1>
          <p className="text-sm text-gray-600">{d.login.subtitle}</p>
        </div>
        <LoginForm labels={d.login} />
      </div>
    </main>
  );
}
