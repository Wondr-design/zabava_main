import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { loadBonusDashboard } from "@/lib/data/bonus-dashboard";

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type' });
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!email) {
      return withCors(NextResponse.json({ error: 'Email is required' }, { status: 400 }));
    }
    const dashboard = await loadBonusDashboard(email);

    return withCors(
      NextResponse.json(dashboard)
    );
  } catch (err) {
    console.error('bonus/user-points error', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
