import { revalidatePath } from 'next/cache';
import { listPartnerInvites, createPartnerInvite, deletePartnerInvite } from '@/lib/data/invites';
import { PartnerInviteForm, PartnerInviteFormState } from '@/components/partners/partner-invite-form';
import { PartnerInviteTable } from '@/components/partners/partner-invite-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminInvitesPage() {
  const invites = await listPartnerInvites({ limit: 50 });

  async function createInviteAction(_prev: PartnerInviteFormState, formData: FormData) {
    'use server';
    try {
      const email = String(formData.get('email') ?? '').trim();
      const partnerId = String(formData.get('partnerId') ?? '').trim();
      const role = String(formData.get('role') ?? 'partner');
      const name = String(formData.get('name') ?? '').trim() || undefined;
      const expiresInMinutes = Number(formData.get('expiresInMinutes') ?? 60 * 24);

      await createPartnerInvite({
        email,
        partnerId,
        role: role === 'admin' ? 'admin' : 'partner',
        name,
        expiresInMinutes,
      });

      revalidatePath('/admin/invites');
      revalidatePath('/admin/partners');
      return { success: true };
    } catch (error) {
      console.error('admin invites create error', error);
      return { error: 'Failed to create invite' };
    }
  }

  async function deleteInviteAction(formData: FormData) {
    'use server';
    const token = String(formData.get('token') ?? '');
    if (!token) return;
    try {
      await deletePartnerInvite(token);
      revalidatePath('/admin/invites');
      revalidatePath('/admin/partners');
    } catch (error) {
      console.error('admin invites delete error', error);
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-100">Invites</h1>
        <p className="text-sm text-slate-400">
          Generate partner or admin access links and monitor usage status.
        </p>
      </header>

      <PartnerInviteForm action={createInviteAction} />

      <PartnerInviteTable invites={invites.items ?? []} deleteAction={deleteInviteAction} />
    </div>
  );
}
