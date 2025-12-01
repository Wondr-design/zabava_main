import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { defaultLocale, isLocale } from "@/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const influencer = localFont({
  src: "../../public/fonts/Influencer-BF691345d5b8ad8.woff",
  variable: "--font-influencer",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zabava",
  description: "Internal tools for managing visits and partners",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const headerLocale = headerStore.get("x-locale");
  const locale = isLocale(headerLocale) ? headerLocale : defaultLocale;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${influencer.variable} antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
