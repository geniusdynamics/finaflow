import fs from "node:fs";
import path from "node:path";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type EnvVarWriteResult = {
  ok: boolean;
  warning: string | null;
};

/**
 * Updates or appends an environment variable in the project's `.env` file.
 * Also syncs the value into `process.env` for the current process.
 *
 * IMPORTANT: This utility is intended for local/self-hosted deployments where
 * the `.env` file is writable. In container/serverless environments, env vars
 * should be updated through the hosting platform, not through the file system.
 * Callers that must survive read-only filesystems (e.g. Docker) should use
 * `updateEnvVarSafe` and persist configuration to the database instead.
 */
export function updateEnvVar(key: string, value: string): void {
  const result = updateEnvVarSafe(key, value);
  if (!result.ok) {
    throw new Error(result.warning ?? `Failed to update ${key} in .env`);
  }
}

/**
 * Best-effort variant of `updateEnvVar` that never throws.
 *
 * In containerized deployments (e.g. Docker running as a non-root user) the
 * `.env` file may not be writable (EACCES/EPERM) or may not exist (ENOENT).
 * Instead of crashing the admin SMTP configuration flow, we report a warning
 * so callers can fall back to database-backed configuration storage.
 */
export function updateEnvVarSafe(key: string, value: string): EnvVarWriteResult {
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";

  try {
    content = fs.readFileSync(envPath, "utf-8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      return { ok: false, warning: `Could not read .env file: ${err.message}` };
    }
  }

  const regex = new RegExp(`^${escapeRegex(key)}=.*`, "m");
  const line = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `${line}\n`;
  }

  try {
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    return {
      ok: false,
      warning: `Could not write .env file (${err.code ?? err.message}) — configuration persisted to the database instead`,
    };
  }

  process.env[key] = value;
  return { ok: true, warning: null };
}
