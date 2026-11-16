import "server-only";
import { cookies } from "next/headers";
import { DICTS, LANG_COOKIE, resolveLang } from ".";

export async function getLang() {
  return resolveLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getDict() {
  const lang = await getLang();
  return { lang, d: DICTS[lang] };
}
