#!/usr/bin/env node
/* Simple environment validation script
 * Fails (exit 1) if required variables are missing. Prints optional ones for visibility.
 */

const required = [
  'ADMIN_SECRET',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const optional = [
  'ALLOWED_ORIGIN',
  'DASHBOARD_BASE_URL',
  'PENDING_ACCESS_TOKEN',
  'PENDING_ALLOWED_ORIGIN',
  'BASE_URL',
  'NEXT_PUBLIC_BASE_URL',
  'JWT_EXPIRES_IN',
  'LOG_LEVEL',
  'REDEMPTION_PROCESSED_WEBHOOK_URL',
  'ZAPIER_CATCH_HOOK',
  'ZAPIER_HOOK',
  'REGEN_LINK',
];

let missing = [];
for (const name of required) {
  if (!process.env[name] || String(process.env[name]).trim() === '') missing.push(name);
}

if (missing.length) {
  console.error(JSON.stringify({ level: 'error', message: 'Missing required env', missing }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ level: 'info', message: 'All required env present' }));

const presentOptional = optional.filter((n) => process.env[n] && String(process.env[n]).trim() !== '');
console.log(JSON.stringify({ level: 'info', message: 'Optional env present', count: presentOptional.length, vars: presentOptional }));
