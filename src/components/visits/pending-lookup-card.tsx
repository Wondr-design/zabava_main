'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export function PendingLookupCard() {
  return (
    <Card className="w-full border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle>Pending Verification</CardTitle>
        <CardDescription>
          Legacy `/api/pending` lookups have been retired in favour of direct webhook delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Email notifications now flow straight to the n8n webhook. If a message fails to send, check the
          structured logs for <code>qr_email_notify_* </code> entries and replay the payload from there.
        </p>
        <div className="space-y-1">
          <Label>Operational tips</Label>
          <ul className="list-disc pl-5 space-y-1">
            <li>Search recent logs for <code>qr_email_notify_failed</code> or <code>qr_email_notify_error</code>.</li>
            <li>Use the payload JSON to retry delivery via the n8n workflow.</li>
            <li>
              For QR verification links, retrieve the visit record directly from Supabase instead of relying on the
              transient cache.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
