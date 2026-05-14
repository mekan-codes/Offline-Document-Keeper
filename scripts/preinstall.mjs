import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const lockfilePath = path.join(workspaceRoot, lockfile);
  if (existsSync(lockfilePath)) {
    rmSync(lockfilePath, { force: true });
  }
}

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead.");
  process.exit(1);
}
