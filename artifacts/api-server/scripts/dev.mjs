import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`Command failed with exit code ${code ?? 1}`));
      }
    });
  });
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

try {
  await run(pnpmCommand, ['run', 'build']);
  await run('node', ['--enable-source-maps', './dist/index.mjs'], {
    NODE_ENV: 'development',
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
