'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  return (
    <Card className="border border-slate-200 bg-white shadow-lg">
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
            <Input id="login-email" name="email" type="email" placeholder="admin@example.com" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" name="password" type="password" required minLength={4} />
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
