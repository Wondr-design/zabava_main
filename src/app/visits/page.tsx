import { redirect } from 'next/navigation';

export default function LegacyVisitsRedirect() {
  redirect('/admin/visits');
}
