'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const requestSchema = z.object({
  token: z.string().min(1),
  rid: z.string().optional(),
  email: z.string().email().optional(),
});

export function PendingLookupCard() {
  const [token, setToken] = useState('');
  const [rid, setRid] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    try {
      const payload = requestSchema.parse({ token, rid: rid || undefined, email: email || undefined });
      if (!payload.rid && !payload.email) {
        toast.error('Provide a RID or email');
        return;
      }

      const params = new URLSearchParams();
      if (payload.rid) params.set('rid', payload.rid);
      if (payload.email) params.set('email', payload.email);

      setLoading(true);
      setResult(null);

      const res = await fetch(`/api/pending?${params.toString()}`, {
        headers: {
          'x-pending-token': payload.token,
        },
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Request failed');
      }

      const json = (await res.json()) as Record<string, unknown>;
      setResult(json);
      toast.success('Pending record loaded');
    } catch (err) {
      console.error('pending lookup failed', err);
      toast.error(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle>Pending Verification</CardTitle>
        <CardDescription>Inspect cached verification links using the pending token.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="pending-token">Pending Token / Admin Secret</Label>
          <Input
            id="pending-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="PENDING_ACCESS_TOKEN"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pending-rid">RID (optional)</Label>
          <Input
            id="pending-rid"
            value={rid}
            onChange={(event) => setRid(event.target.value)}
            placeholder="sample-rid-123"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pending-email">Email (optional)</Label>
          <Input
            id="pending-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="guest@example.com"
          />
        </div>

        <Button type="button" onClick={handleLookup} disabled={loading || !token}>
          {loading ? 'Loading…' : 'Lookup Pending Record'}
        </Button>

        {result && (
          <div className="space-y-2">
            <Label>Result</Label>
            <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
