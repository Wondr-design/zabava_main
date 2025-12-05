import { ReactNode } from "react";
import "@/styles/theme-vercel.css";
import { BodyThemeClass } from "@/components/body-theme-class";

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BodyThemeClass className="theme-vercel" />
      <div className="theme-vercel min-h-screen bg-background text-foreground">
        {children}
      </div>
    </>
  );
}
