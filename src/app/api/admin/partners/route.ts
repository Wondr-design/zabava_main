import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ZodError, z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { verifyCsrf, generateCsrfToken } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import {
  listPartnerMetas,
  loadPartnerMeta,
  partnerMetaUpdateSchema,
  savePartnerMeta,
  partnerStatusSchema,
  partnerExists,
  partnerTypeSchema,
  partnerNoteSchema,
  setPartnerParentRelationships,
  getPartnerRelationshipsForChild,
  getPartnerRelationshipsForParent,
} from '@/lib/data/partners';
import { getAuthFromRequest } from '@/lib/auth/request';
import { revalidatePublicDirectory } from '@/lib/data/site-directory';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || '';

const parentPartnerAssignmentsSchema = z.object({
  transport: z.array(z.string()).optional(),
});

const listingTierKeySchema = z
  .union([
    z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9][a-z0-9-_]*$/i, {
        message:
          'Listing tier keys may only contain letters, numbers, hyphens, and underscores.',
      }),
    z.literal(null),
  ])
  .optional();

const addressSchema = z
  .object({
    city: z.string().optional(),
    addressLine: z.string().optional(),
    sameAsCompany: z.boolean().optional(),
  })
  .partial();

const partnerCreateSchema = z.object({
  partnerId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  status: partnerStatusSchema.optional(),
  type: partnerTypeSchema.default('standard'),
  contactEmail: z.string().email().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  companyName: z.string().optional(),
  businessName: z.string().optional(),
  shortDescription: z.string().optional(),
  website: z.string().optional(),
  googleMapUrl: z.string().optional(),
  companyIdNumber: z.string().optional(),
  vatRegistered: z.boolean().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  companyAddress: addressSchema.optional(),
  businessAddress: addressSchema.optional(),
  listingTierKey: listingTierKeySchema,
  commissionRate: z.number().min(1).max(100).default(10),
  commissionRateOriginal: z.number().min(0).max(100).optional(),
  commissionRateDiscounted: z.number().min(0).max(100).optional(),
  commissionBasis: z.enum(['original', 'discounted']).optional(),
  monthlyFee: z.number().min(0).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  notes: z.array(partnerNoteSchema).optional(),
  parentPartners: parentPartnerAssignmentsSchema.optional(),
});

const CORS_CONFIG = {
  methods: 'GET,POST,PUT,OPTIONS',
  headers: 'Content-Type, Authorization, x-admin-secret',
} as const;

function isAuthorized(req: NextRequest) {
  // Prefer cookie-based admin auth
  const auth = getAuthFromRequest(req);
  if (auth?.role === 'admin') return true;

  // Fallback to x-admin-secret header
  const adminSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  // Back-compat: Bearer token header
  if (!JWT_SECRET) {
    return false;
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'object' && payload && 'role' in payload) {
      return (payload as { role?: string }).role === 'admin';
    }
    return false;
  } catch (err) {
    log.warn('admin_partners_auth_failed', { route: 'admin/partners', error: (err as Error)?.message, correlationId: getCorrelationId(req) });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('admin_partners_unauthorized', { route: 'admin/partners', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }

  try {
    const url = req.nextUrl;
    const partnerId = url.searchParams.get('partnerId');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    if (partnerId) {
      const [item, relationships, children] = await Promise.all([
        loadPartnerMeta(partnerId),
        getPartnerRelationshipsForChild(partnerId).catch((error) => {
          log.error(
            "admin_partner_relationships_child_error",
            error instanceof Error ? error : new Error(String(error)),
            { partnerId, route: "admin/partners", correlationId: getCorrelationId(req) },
          );
          return [];
        }),
        getPartnerRelationshipsForParent(partnerId).catch((error) => {
          log.error(
            "admin_partner_relationships_parent_error",
            error instanceof Error ? error : new Error(String(error)),
            { partnerId, route: "admin/partners", correlationId: getCorrelationId(req) },
          );
          return [];
        }),
      ]);
      return withCors(
        NextResponse.json({ item, relationships, children }),
        CORS_CONFIG,
      );
    }

    const items = await listPartnerMetas({ status, search });
    const response = NextResponse.json({ items });
    response.headers.set('x-csrf-token', generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    log.error('admin_partners_get_error', err, { route: 'admin/partners', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }), CORS_CONFIG);
  }
  if (!isAuthorized(req)) {
    log.warn('admin_partners_unauthorized', { route: 'admin/partners', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }

  const partnerId = req.nextUrl.searchParams.get('partnerId');
  if (!partnerId) {
    return withCors(
      NextResponse.json({ error: 'partnerId is required' }, { status: 400 }),
      CORS_CONFIG,
    );
  }

  try {
    const body = await req.json();
    const payload = partnerMetaUpdateSchema.parse(body ?? {});
    const rawParentPartners =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>).parentPartners
        : undefined;
    const parentPartners = rawParentPartners
      ? parentPartnerAssignmentsSchema.parse(rawParentPartners)
      : undefined;
    const result = await savePartnerMeta(partnerId, payload);
    if (
      parentPartners &&
      Object.prototype.hasOwnProperty.call(parentPartners, 'transport')
    ) {
      await setPartnerParentRelationships(
        partnerId,
        'transport',
        parentPartners.transport ?? []
      );
    } else if (
      payload.type === 'standard' ||
      result.type !== 'transport'
    ) {
      await setPartnerParentRelationships(partnerId, 'transport', []);
    }
    revalidatePublicDirectory();
    return withCors(NextResponse.json(result), CORS_CONFIG);
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('admin_partners_validation_error', { route: 'admin/partners', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return withCors(
        NextResponse.json(
          { error: 'ValidationError', issues: err.flatten() },
          { status: 400 },
        ),
        CORS_CONFIG,
      );
    }

    log.error('admin_partners_put_error', err, { route: 'admin/partners', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }), CORS_CONFIG);
  }

  try {
    const body = await req.json();
    const payload = partnerCreateSchema.parse(body ?? {});
    const normalizedId = payload.partnerId.trim().toLowerCase();

    if (await partnerExists(normalizedId)) {
      return withCors(
        NextResponse.json({ error: 'Partner ID already exists' }, { status: 409 }),
        CORS_CONFIG,
      );
    }

    const listingTierKey =
      typeof payload.listingTierKey === 'string' && payload.listingTierKey.trim().length > 0
        ? payload.listingTierKey.trim()
        : null;
    const vatRegistered = Boolean(payload.vatRegistered);
    const vatRate =
      vatRegistered && typeof payload.vatRate === 'number' ? payload.vatRate : 0;
    const companyAddress =
      payload.companyAddress &&
      (payload.companyAddress.city || payload.companyAddress.addressLine)
        ? {
            city: payload.companyAddress.city ?? undefined,
            addressLine: payload.companyAddress.addressLine ?? undefined,
          }
        : undefined;
    const businessAddress =
      payload.businessAddress &&
      (payload.businessAddress.city || payload.businessAddress.addressLine)
        ? {
            city: payload.businessAddress.city ?? undefined,
            addressLine: payload.businessAddress.addressLine ?? undefined,
            sameAsCompany: payload.businessAddress.sameAsCompany ?? undefined,
          }
        : undefined;
    const commissionBasis = payload.commissionBasis ?? 'discounted';
    const commissionRateOriginal =
      typeof payload.commissionRateOriginal === 'number'
        ? payload.commissionRateOriginal
        : payload.commissionRate;
    const commissionRateDiscounted =
      typeof payload.commissionRateDiscounted === 'number'
        ? payload.commissionRateDiscounted
        : payload.commissionRate;
    const effectiveCommission =
      commissionBasis === 'original'
        ? commissionRateOriginal
        : commissionRateDiscounted;
    const contractUpdates = {
      commissionRate: effectiveCommission,
      commissionRateOriginal,
      commissionRateDiscounted,
      commissionBasis,
      monthlyFee: payload.monthlyFee,
      discountRate: payload.discountRate,
    };
    const infoUpdates = {
      contactEmail: payload.contactEmail,
      contactName: payload.contactName,
      contactPhone: payload.contactPhone,
      companyName: payload.companyName,
      businessName: payload.businessName,
      shortDescription: payload.shortDescription,
      website: payload.website,
      googleMapUrl: payload.googleMapUrl,
      companyIdNumber: payload.companyIdNumber,
      vatRegistered,
      vatRate,
      companyAddress,
      businessAddress,
    };

    const updates = {
      displayName: payload.displayName ?? payload.partnerId,
      status: payload.status,
      type: payload.type,
      listingTierKey,
      contract: contractUpdates,
      info: infoUpdates,
      notes: payload.notes,
    } satisfies Parameters<typeof savePartnerMeta>[1];

    await savePartnerMeta(normalizedId, updates);
    if (
      payload.type === 'transport' ||
      (payload.parentPartners && payload.parentPartners.transport)
    ) {
      await setPartnerParentRelationships(
        normalizedId,
        'transport',
        payload.parentPartners?.transport ?? []
      );
    }
    revalidatePublicDirectory();
    const item = await loadPartnerMeta(normalizedId);
    log.info('admin_partner_created', { partnerId: normalizedId, correlationId: getCorrelationId(req) });
    const response = NextResponse.json({ ok: true, item });
    response.headers.set('x-csrf-token', generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    if (err instanceof z.ZodError) {
      log.warn('admin_partners_create_validation_error', { route: 'admin/partners', issues: err.flatten?.(), correlationId: getCorrelationId(req) });
      return withCors(
        NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    log.error('admin_partners_post_error', err, { route: 'admin/partners', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
