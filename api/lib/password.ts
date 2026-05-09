import bcrypt from "bcryptjs";

function getSaltRounds(): number {
  const envRounds = process.env.BCRYPT_ROUNDS;
  if (envRounds) {
    const parsed = parseInt(envRounds, 10);
    if (!isNaN(parsed) && parsed >= 4 && parsed <= 16) return parsed;
  }
  return 12;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getSaltRounds());
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
