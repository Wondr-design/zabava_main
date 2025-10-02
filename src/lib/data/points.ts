import { getSupabaseAdmin } from '../supabase-admin';

export type PointsHistoryType = 'earned' | 'redemption' | 'adjustment';

export interface PointsHistoryRecord {
  id: string;
  email: string;
  type: PointsHistoryType;
  points: number;
  partner_id: string | null;
  partner_name: string | null;
  visit_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface CreatePointsHistoryInput {
  email: string;
  type: PointsHistoryType;
  points: number;
  partnerId?: string | null;
  partnerName?: string | null;
  visitId?: string | null;
  meta?: Record<string, unknown>;
}

export async function addPointsHistoryEntry(input: CreatePointsHistoryInput) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = input.email.trim().toLowerCase();

  type PointsInsert = {
    email: string;
    type: PointsHistoryType;
    points: number;
    partner_id: string | null;
    partner_name: string | null;
    visit_id: string | null;
    meta: Record<string, unknown>;
  };

  const payload: PointsInsert = {
    email: normalizedEmail,
    type: input.type,
    points: input.points,
    partner_id: input.partnerId ?? null,
    partner_name: input.partnerName ?? null,
    visit_id: input.visitId ?? null,
    meta: input.meta ?? {},
  };

  const { data, error } = await supabase
    .from('points_history')
    .insert(payload as unknown as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to add points history entry: ${error?.message ?? 'unknown error'}`);
  }

  return data as PointsHistoryRecord;
}

export async function getPointsHistoryForEmail(email: string, limit = 100) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from('points_history')
    .select('*')
    .eq('email', normalizedEmail)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load points history: ${error.message}`);
  }

  return (data ?? []) as PointsHistoryRecord[];
}

export async function getTotalPointsForEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from('points_history')
    .select('type, points')
    .eq('email', normalizedEmail);

  if (error) {
    throw new Error(`Failed to calculate total points: ${error.message}`);
  }

  const entries = (data ?? []) as Array<Pick<PointsHistoryRecord, 'type' | 'points'>>;

  return entries.reduce((sum, entry) => {
    switch (entry.type) {
      case 'earned':
        return sum + entry.points;
      case 'redemption':
        return sum - entry.points;
      case 'adjustment':
        return sum + entry.points;
      default:
        return sum;
    }
  }, 0);
}
