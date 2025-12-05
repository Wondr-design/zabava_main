"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type AuthLayoutProps = {
  children: React.ReactNode;
  title: string;
  description: string;
  brandTitle?: string;
  brandDescription?: string;
  variant?: "admin" | "partner" | "staff";
};

const variantConfig = {
  admin: {
    gradient: "from-zinc-900 via-zinc-800 to-black",
    accent: "bg-white",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
        />
      </svg>
    ),
    label: "Control Centre",
  },
  partner: {
    gradient: "from-zinc-900 via-neutral-800 to-stone-900",
    accent: "bg-white",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
        />
      </svg>
    ),
    label: "Partner Portal",
  },
  staff: {
    gradient: "from-neutral-900 via-zinc-800 to-neutral-900",
    accent: "bg-white",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    ),
    label: "Staff Console",
  },
};

export function AuthLayout({
  children,
  title,
  description,
  brandTitle,
  brandDescription,
  variant = "admin",
}: AuthLayoutProps) {
  const config = variantConfig[variant];

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left side - Branding (hidden on mobile) */}
      <div
        className={cn(
          "relative hidden w-1/2 lg:flex",
          "bg-gradient-to-br",
          config.gradient
        )}
      >
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12">
          {/* Logo and label */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-sm">
              {config.icon}
            </div>
            <div>
              <span className="text-lg font-semibold text-white">Zabava</span>
              <span className="ml-2 text-sm text-white/60">{config.label}</span>
            </div>
          </motion.div>

          {/* Center content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-md"
          >
            <h2 className="text-4xl font-bold tracking-tight text-white">
              {brandTitle || "Welcome back"}
            </h2>
            <p className="mt-4 text-lg text-white/70">
              {brandDescription ||
                "Sign in to access your dashboard and manage your business operations."}
            </p>

            {/* Feature highlights */}
            <div className="mt-12 space-y-4">
              {[
                "Real-time analytics and insights",
                "Secure and encrypted connections",
                "24/7 support availability",
              ].map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm text-white/60"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  {feature}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom attribution */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-sm text-white/40"
          >
            © {new Date().getFullYear()} Zabava. All rights reserved.
          </motion.p>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-1/4 top-1/4 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Right side - Form */}
      <div className="flex w-full flex-col lg:w-1/2">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border p-4 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10 text-foreground">
            {config.icon}
          </div>
          <div>
            <span className="font-semibold text-foreground">Zabava</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {config.label}
            </span>
          </div>
        </div>

        {/* Form container */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Form header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>

            {/* Form content */}
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

