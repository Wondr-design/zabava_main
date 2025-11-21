import type { Metadata } from "next";

import { CopyCodeClient } from "@/components/copy-code/copy-code-client";

export const metadata: Metadata = {
  title: "Copy verification code | Zabava",
};

interface CopyCodePageProps {
  searchParams?: Promise<{
    code?: string;
  }>;
}

export default async function CopyCodePage({
  searchParams,
}: CopyCodePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawCode =
    typeof resolvedParams?.code === "string" ? resolvedParams.code : "";
  const code = rawCode.trim();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f3ed] px-4 py-12">
      <CopyCodeClient code={code} />
    </main>
  );
}
