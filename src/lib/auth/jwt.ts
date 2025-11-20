import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";
import { getEnv } from "../env";

let cachedSecret: string | null = null;

function getSecret() {
  if (!cachedSecret) {
    cachedSecret = getEnv("JWT_SECRET");
  }
  return cachedSecret;
}

function getDefaultExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "12h";
}

// Allow callers to pass string | number for expiresIn for convenience
type SignOptionsCompat = Omit<SignOptions, "expiresIn"> & {
  expiresIn?: string | number;
};

export function signJwt(payload: object, options?: SignOptionsCompat) {
  const secret = getSecret();
  const { expiresIn, ...rest } = options || {};
  const merged: SignOptions = {
    expiresIn: (expiresIn ?? getDefaultExpiresIn()) as unknown as
      | import("ms").StringValue
      | number,
    ...rest,
  };
  return jwt.sign(payload, secret, merged);
}

export function verifyJwt<T extends object = Record<string, unknown>>(
  token: string,
  options?: VerifyOptions
) {
  const secret = getSecret();
  return jwt.verify(token, secret, options) as T;
}
