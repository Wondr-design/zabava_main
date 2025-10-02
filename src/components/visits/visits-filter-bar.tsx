'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VisitsFilterBarProps {
  initialEmail?: string;
  initialPartnerId?: string;
  initialStatus?: string;
}

export function VisitsFilterBar({ initialEmail = '', initialPartnerId = '', initialStatus = '' }: VisitsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState(initialEmail);
  const [partnerId, setPartnerId] = useState(initialPartnerId);
  const [status, setStatus] = useState(initialStatus || '');

  function updateQuery(next: { email?: string; partnerId?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.email !== undefined) {
      if (next.email) {
        params.set('email', next.email);
      } else {
        params.delete('email');
      }
    }
    if (next.partnerId !== undefined) {
      if (next.partnerId) {
        params.set('partnerId', next.partnerId);
      } else {
        params.delete('partnerId');
      }
    }
    if (next.status !== undefined) {
      if (next.status) {
        params.set('status', next.status);
      } else {
        params.delete('status');
      }
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => router.replace(href));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery({ email, partnerId, status: status || '' });
  }

  function handleReset() {
    setEmail('');
    setPartnerId('');
    setStatus('');
    updateQuery({ email: '', partnerId: '', status: '' });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="filter-email">Email</Label>
        <Input
          id="filter-email"
          placeholder="guest@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-partner">Partner ID</Label>
        <Input
          id="filter-partner"
          placeholder="demo-partner"
          value={partnerId}
          onChange={(event) => setPartnerId(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Status</Label>
        <Select value={status || 'any'} onValueChange={(val) => setStatus(val === 'any' ? '' : val)}>
          <SelectTrigger>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="visited">Visited</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Filtering…' : 'Filter'}
        </Button>
        <Button type="button" variant="secondary" onClick={handleReset} disabled={isPending}>
          Reset
        </Button>
      </div>
    </form>
  );
}
