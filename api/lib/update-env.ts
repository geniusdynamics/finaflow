import fs from "node:fs";
import path from "node:path";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Updates or appends an environment variable in the project's `.env` file.
 * Also syncs the value into `process.env` for the current process.
 *
 * IMPORTANT: This utility is intended for local/self-hosted deployments where
 * the `.env` file is writable. In container/serverless environments, env vars
 * should be updated through the hosting platform, not through the file system.
 */
export function updateEnvVar(key: string, value: string): void {
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";

  try {
    content = fs.readFileSync(envPath, "utf-8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw new Error(`Failed to read .env file: ${err.message}`);
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

  fs.writeFileSync(envPath, content, "utf-8");
  process.env[key] = value;
}
