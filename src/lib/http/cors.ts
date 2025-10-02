import { NextResponse } from 'next/server';

export interface CorsOptions {
  origin?: string;
  methods?: string;
  headers?: string;
  maxAge?: string;
  credentials?: boolean;
}

function resolveDefaultOrigin() {
  const envOrigin =
    process.env.ALLOWED_ORIGIN ||
    process.env.DASHBOARD_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return envOrigin || '*';
}

const DEFAULT_ORIGIN = resolveDefaultOrigin();

const DEFAULT_OPTIONS: Required<Omit<CorsOptions, 'credentials'>> & { credentials: boolean } = {
  origin: DEFAULT_ORIGIN,
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  headers: 'Content-Type, Authorization, x-admin-secret',
  maxAge: '86400',
  credentials: DEFAULT_ORIGIN !== '*',
};

function mergeOptions(options?: CorsOptions): Required<Omit<CorsOptions, 'credentials'>> & { credentials: boolean } {
  return {
    origin: options?.origin ?? DEFAULT_OPTIONS.origin,
    methods: options?.methods ?? DEFAULT_OPTIONS.methods,
    headers: options?.headers ?? DEFAULT_OPTIONS.headers,
    maxAge: options?.maxAge ?? DEFAULT_OPTIONS.maxAge,
    credentials:
      typeof options?.credentials === 'boolean'
        ? options.credentials
        : options?.origin
        ? options.origin !== '*'
        : DEFAULT_OPTIONS.credentials,
  };
}

export function withCors(response: NextResponse, options?: CorsOptions) {
  const resolved = mergeOptions(options);
  response.headers.set('Access-Control-Allow-Origin', resolved.origin);
  response.headers.set('Access-Control-Allow-Methods', resolved.methods);
  response.headers.set('Access-Control-Allow-Headers', resolved.headers);
  response.headers.set('Access-Control-Max-Age', resolved.maxAge);
  if (resolved.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    const existingVary = response.headers.get('Vary');
    if (!existingVary) {
      response.headers.set('Vary', 'Origin');
    } else if (!existingVary.split(/,\s*/i).some((value) => value.toLowerCase() === 'origin')) {
      response.headers.set('Vary', `${existingVary}, Origin`);
    }
  } else {
    response.headers.delete('Access-Control-Allow-Credentials');
  }
  return response;
}

export function preflightResponse(options?: CorsOptions) {
  return withCors(new NextResponse(null, { status: 200 }), options);
}
