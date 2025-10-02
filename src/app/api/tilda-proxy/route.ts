import { NextRequest, NextResponse } from 'next/server';

const ZAPIER_HOOK = process.env.ZAPIER_CATCH_HOOK || '';
const BASE_URL_ENV = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';

function parseBodyString(str: string) {
  if (!str) return {} as Record<string, unknown>;
  try {
    return JSON.parse(str);
  } catch {}
  try {
    const out: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(str)) out[k] = v;
    return out;
  } catch {}
  return { raw: String(str) } as Record<string, unknown>;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  return new NextResponse('ok', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

import { log, getCorrelationId } from '@/lib/logging';

export async function POST(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } as Record<string, string>;

  function hasError(x: unknown): x is { error?: unknown } {
    return typeof x === 'object' && x !== null && 'error' in x;
  }

  function extractRegisterField(result: unknown, key: string) {
    if (result && typeof result === 'object' && key in (result as Record<string, unknown>)) {
      const value = (result as Record<string, unknown>)[key];
      return value ?? null;
    }
    return null;
  }

  try {
    let payload: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = (await req.json()) ?? {};
    } else {
      const raw = await req.text();
      payload = parseBodyString(raw);
    }

    const emailCandidate = (() => {
      const candidates = ['email', 'Email', 'e-mail', 'email_address', 'emailAddress'];
      for (const key of candidates) {
        const v = payload[key as keyof typeof payload];
        if (typeof v === 'string' && v.includes('@')) return v.trim().toLowerCase();
      }
      for (const v of Object.values(payload)) {
        if (typeof v === 'string' && v.includes('@')) return v.trim().toLowerCase();
      }
      return '';
    })();

    const baseUrl = BASE_URL_ENV || (typeof window === 'undefined' ? '' : window.location.origin);
    const registerUrl = `${(baseUrl || '').replace(/\/$/, '')}/api/register`;

    let registerResult: unknown = null;
    try {
      const r = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailCandidate || undefined, data: payload }),
      });
      try {
        registerResult = await r.json();
      } catch {
        registerResult = { status: r.status, text: await r.text().catch(() => '') };
      }
    } catch (e) {
      log.warn('register_forward_error', { route: 'tilda-proxy', correlationId: getCorrelationId(req), error: (e as Error)?.message });
      registerResult = { error: String(e) };
    }

    const forwardPayload = {
      ...payload,
      verifyUrl: extractRegisterField(registerResult, 'verifyUrl'),
      qrCodeUrl: extractRegisterField(registerResult, 'qrCodeUrl'),
      qrCodeExpiresAt: extractRegisterField(registerResult, 'qrCodeExpiresAt'),
      _register: registerResult,
    };

    let forwarded = false;
    if (ZAPIER_HOOK) {
      log.info('forward_to_zapier', { route: 'tilda-proxy', correlationId: getCorrelationId(req) });
      try {
        const r2 = await fetch(ZAPIER_HOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(forwardPayload),
        });
        forwarded = r2.ok;
      } catch {
        forwarded = false;
      }
    }

    return new NextResponse(
      JSON.stringify({
        ok: true,
        registered: !!registerResult && !hasError(registerResult),
        registerResult,
        verifyUrl: extractRegisterField(registerResult, 'verifyUrl'),
        qrCodeUrl: extractRegisterField(registerResult, 'qrCodeUrl'),
        qrCodeExpiresAt: extractRegisterField(registerResult, 'qrCodeExpiresAt'),
        forwardedToZapier: forwarded,
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    log.error('tilda_proxy_error', err, { route: 'tilda-proxy', correlationId: getCorrelationId(req) });
    return new NextResponse(JSON.stringify({ ok: false, error: 'Internal server error' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
}
