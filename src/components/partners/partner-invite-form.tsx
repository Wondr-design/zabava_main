'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PartnerInviteFormProps {
  action: (prevState: PartnerInviteFormState, formData: FormData) => Promise<PartnerInviteFormState>;
}

export interface PartnerInviteFormState {
  success?: boolean;
  error?: string;
}

const initialState: PartnerInviteFormState = {};

export function PartnerInviteForm({ action }: PartnerInviteFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">Create invite</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Generate a new partner or admin invite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" name="email" type="email" placeholder="user@example.com" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-partner">Partner ID</Label>
            <Input id="invite-partner" name="partnerId" placeholder="demo-partner" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select name="role" defaultValue="partner">
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" name="name" placeholder="Full name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-expiry">Expiry (minutes)</Label>
            <Input id="invite-expiry" name="expiresInMinutes" type="number" min={60} step={60} defaultValue={60 * 24} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Create invite
            </Button>
          </div>
        </form>
        {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="mt-4 text-sm text-emerald-600">Invite created successfully.</p>}
      </CardContent>
    </Card>
  );
}
