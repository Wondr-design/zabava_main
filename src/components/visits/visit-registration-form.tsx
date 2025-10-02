'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const registrationSchema = z.object({
  email: z.string().email(),
  partnerId: z.string().min(1),
  numPeople: z.number().int().positive().optional(),
  ticket: z.string().optional(),
  totalPrice: z.number().nonnegative().optional(),
  data: z.any().optional(),
});

export function VisitRegistrationForm() {
  const [email, setEmail] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [numPeople, setNumPeople] = useState('1');
  const [ticket, setTicket] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [rawData, setRawData] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResponse(null);

    try {
      let parsedData: unknown = undefined;
      if (rawData.trim()) {
        try {
          parsedData = JSON.parse(rawData);
        } catch {
          toast.error('Data payload must be valid JSON.');
          setIsSubmitting(false);
          return;
        }
      }

      const payload = registrationSchema.parse({
        email,
        partnerId,
        numPeople: numPeople ? Number(numPeople) : undefined,
        ticket: ticket || undefined,
        totalPrice: totalPrice ? Number(totalPrice) : undefined,
        data: parsedData,
      });

      const body: Record<string, unknown> = {
        email: payload.email,
        partnerId: payload.partnerId,
      };

      if (payload.data) {
        body.data = payload.data;
      } else {
        body.data = {
          numPeople: payload.numPeople ?? undefined,
          ticket: payload.ticket ?? undefined,
          totalPrice: payload.totalPrice ?? undefined,
        };
      }

      const res = await fetch('/api/qr/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Request failed');
      }

      const json = (await res.json()) as Record<string, unknown>;
      setResponse(json);
      toast.success('Visit registered successfully');
    } catch (err) {
      console.error('Visit registration failed', err);
      toast.error(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle>Register Visit</CardTitle>
        <CardDescription>Create a QR visit entry for a guest.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Guest Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="guest@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="partner">Partner ID</Label>
            <Input
              id="partner"
              placeholder="demo-partner"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="num-people">Number of Guests</Label>
              <Input
                id="num-people"
                type="number"
                min={1}
                value={numPeople}
                onChange={(event) => setNumPeople(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket">Ticket</Label>
              <Input
                id="ticket"
                placeholder="VIP, Standard, ..."
                value={ticket}
                onChange={(event) => setTicket(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="total-price">Total Price (₦)</Label>
              <Input
                id="total-price"
                type="number"
                min={0}
                value={totalPrice}
                onChange={(event) => setTotalPrice(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="data">Additional Payload (JSON)</Label>
            <Textarea
              id="data"
              placeholder='{"numPeople":2,"ticket":"VIP"}'
              value={rawData}
              onChange={(event) => setRawData(event.target.value)}
              rows={4}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Submitting...' : 'Register Visit'}
          </Button>
        </form>

        {response && (
          <div className="mt-6 space-y-2">
            <Label>Response</Label>
            <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
