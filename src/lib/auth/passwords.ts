import bcrypt from 'bcryptjs';

const DEFAULT_SALT_ROUNDS = 12;

export async function hashPassword(password: string, saltRounds = DEFAULT_SALT_ROUNDS) {
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashed?: string | null) {
  if (!password || !hashed) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hashed);
  } catch (error) {
    console.error('Password verification failed', error);
    return false;
  }
}
