"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PartnerInviteDTO } from '@/lib/data/invites';
import { formatDateTime } from '@/lib/format/date';

interface PartnerInviteTableProps {
  invites: PartnerInviteDTO[];
  deleteAction: (formData: FormData) => Promise<void>;
}

export function PartnerInviteTable({ invites, deleteAction }: PartnerInviteTableProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  async function copyInviteLink(invite: PartnerInviteDTO) {
    if (!invite.inviteUrl) {
      setCopyError('Invite link unavailable');
      setCopiedToken(null);
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(invite.inviteUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = invite.inviteUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyError('');
      setCopiedToken(invite.token);
      setTimeout(() => {
        setCopiedToken((prev) => (prev === invite.token ? null : prev));
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to copy link';
      setCopyError(message);
      setCopiedToken(null);
    }
  }

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">Invites</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Most recent partner/admin invites.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {copyError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {copyError}
          </div>
        )}
        <Table>
          <TableHeader className="bg-slate-50 text-slate-500">
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Link</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-slate-700">
            {invites.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500">
                  No invites found.
                </TableCell>
              </TableRow>
            )}
            {invites.map((invite) => (
              <TableRow key={invite.token}>
                <TableCell className="font-medium text-slate-900">{invite.email ?? '—'}</TableCell>
                <TableCell className="text-xs uppercase tracking-wide text-slate-500">{invite.partnerId ?? '—'}</TableCell>
                <TableCell className="capitalize">{invite.role}</TableCell>
                <TableCell>{formatDateTime(invite.expiresAt)}</TableCell>
                <TableCell>{invite.used ? 'Used' : 'Unused'}</TableCell>
                <TableCell>
                  {invite.inviteUrl ? (
                    <button
                      type="button"
                      onClick={() => copyInviteLink(invite)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      {copiedToken === invite.token ? 'Copied!' : 'Copy link'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Unavailable</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <form action={deleteAction}>
                    <input type="hidden" name="token" value={invite.token} />
                    <Button type="submit" variant="outline" size="sm" className="border-red-200 text-red-600 hover:border-red-300 hover:text-red-700">
                      Delete
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
