const REQUIRED_VARS = [
  'ADMIN_SECRET',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

function readEnv(name: string, optional = false) {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value ?? '';
}

export function getEnv(name: RequiredVar): string;
export function getEnv(name: string, optional: boolean): string;
export function getEnv(name: string, optional = false) {
  return readEnv(name, optional);
}

export function verifyRequiredEnv() {
  for (const name of REQUIRED_VARS) {
    readEnv(name);
  }
}
