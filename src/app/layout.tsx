import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DeDecker · Semantic dashboard",
  robots: { index: false, follow: false },
  icons: { icon: "/dedecker-logo.png" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
