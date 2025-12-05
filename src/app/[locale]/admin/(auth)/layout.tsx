import { ReactNode } from "react";
import "@/styles/theme-vercel.css";
import { BodyThemeClass } from "@/components/body-theme-class";

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BodyThemeClass className="theme-vercel" />
      <div className="theme-vercel flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-md px-4">{children}</div>
      </div>
    </>
  );
}

