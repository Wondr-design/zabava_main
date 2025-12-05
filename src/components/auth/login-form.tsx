"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  action: (prevState: LoginFormState, formData: FormData) => Promise<LoginFormState>;
}

export interface LoginFormState {
  error?: string;
  success?: boolean;
}

const initialState: LoginFormState = {};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="border border-border bg-card shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-slate-900">Admin login</CardTitle>
        <CardDescription className="text-slate-500">
          Enter your credentials to access the Zabava admin dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login-password">Password</Label>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={4}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center justify-center rounded-md px-2 text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
