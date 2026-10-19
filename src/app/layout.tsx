import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leash – Spending rules for AI agents",
  description:
    "Give your AI agent a budget, not your wallet. Plain-language spending rules, one-tap human approval and PayPal checkout (sandbox).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppNav />
        {/* Room for the tab bar on phones and the side rail on wide screens. */}
        <div className="flex flex-1 flex-col pb-24 md:pb-0 md:pl-20">{children}</div>
      </body>
    </html>
  );
}
