import { revalidatePath } from 'next/cache';
import { fetchPartnersOverview } from '@/lib/data/analytics';
import { PartnersTable } from '@/components/partners/partners-table';
import { listPartnerInvites, createPartnerInvite, deletePartnerInvite } from '@/lib/data/invites';
import { PartnerInviteForm, PartnerInviteFormState } from '@/components/partners/partner-invite-form';
import { PartnerInviteTable } from '@/components/partners/partner-invite-table';

export default async function AdminPartnersPage() {
  const [partners, invites] = await Promise.all([
    fetchPartnersOverview(),
    listPartnerInvites({ limit: 25 }),
  ]);

  async function createInviteAction(_prevState: PartnerInviteFormState, formData: FormData) {
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

      revalidatePath('/admin/partners');
      revalidatePath('/admin/invites');
      return { success: true };
    } catch (error) {
      console.error('create invite action error', error);
      return { error: 'Failed to create invite' };
    }
  }

  async function deleteInviteAction(formData: FormData) {
    'use server';
    const token = String(formData.get('token') ?? '');
    if (!token) return;
    try {
      await deletePartnerInvite(token);
      revalidatePath('/admin/partners');
      revalidatePath('/admin/invites');
    } catch (error) {
      console.error('delete invite error', error);
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-100">Partners</h1>
        <p className="text-sm text-slate-400">
          Manage partners, review invites, and keep tabs on membership.
        </p>
      </header>

      <PartnersTable partners={partners} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PartnerInviteForm action={createInviteAction} />
        <PartnerInviteTable invites={invites.items ?? []} deleteAction={deleteInviteAction} />
      </section>
    </div>
  );
}
