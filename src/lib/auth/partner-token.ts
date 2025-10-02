import { verifyJwt } from './jwt';

export interface PartnerTokenPayload {
  email?: string;
  role?: string;
  partnerId?: string;
  name?: string;
}

export function verifyPartnerToken(authorizationHeader: string | null | undefined) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authorizationHeader.slice(7).trim();
  if (!token) return null;

  try {
    const payload = verifyJwt<PartnerTokenPayload>(token);
    if (payload.role !== 'partner' || !payload.partnerId) {
      return null;
    }
    return payload;
  } catch (error) {
    console.warn('partner token verification failed', error);
    return null;
  }
}
