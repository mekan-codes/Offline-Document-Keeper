import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(projectRoot, '../..');
const isWindows = process.platform === 'win32';
const passthroughArgs = process.argv.slice(2);
const inStage = process.env.DOCPOCKET_ANDROID_IN_STAGE === '1';
const stageRoot = path.resolve(
  process.env.DOCPOCKET_ANDROID_STAGE_ROOT || path.join(path.parse(workspaceRoot).root, 'dpk-dev'),
);
const virtualStore = path.resolve(
  process.env.DOCPOCKET_PNPM_VIRTUAL_STORE || path.join(path.parse(workspaceRoot).root, 'dpk-v'),
);

function quoteWindowsArg(value) {
  if (!/[\s"&|<>^]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function getAndroidSdkPath() {
  return (
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
  );
}

function withAndroidTools(env = {}) {
  const sdkPath = getAndroidSdkPath();
  const platformTools = path.join(sdkPath, 'platform-tools');
  const separator = isWindows ? ';' : ':';

  if (!existsSync(platformTools)) {
    return env;
  }

  return {
    ...env,
    PATH: `${platformTools}${separator}${process.env.PATH || ''}`,
  };
}

function run(command, args, options = {}) {
  const { env: optionEnv, ...spawnOptions } = options;
  const needsWindowsShell = isWindows && /\.(bat|cmd)$/i.test(command);
  const finalCommand = needsWindowsShell ? process.env.ComSpec || 'cmd.exe' : command;
  const finalArgs = needsWindowsShell
    ? ['/d', '/c', [command, ...args].map(quoteWindowsArg).join(' ')]
    : args;

  const result = spawnSync(finalCommand, finalArgs, {
    stdio: 'inherit',
    ...spawnOptions,
    env: {
      ...process.env,
      ...withAndroidTools(),
      ...optionEnv,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function shouldUseWindowsStage() {
  if (!isWindows || inStage || passthroughArgs.includes('--no-stage')) return false;

  return projectRoot.length > 40 || projectRoot.includes(' ');
}

function assertSafeStagePath(target) {
  const parsed = path.parse(target);
  const base = path.basename(target).toLowerCase();
  const parent = path.dirname(target);

  if (target === parsed.root || parent !== parsed.root || !base.startsWith('dpk-')) {
    throw new Error(
      `Refusing to use unsafe Android stage path: ${target}. Use a drive-root folder named dpk-*`,
    );
  }
}

function mirrorWorkspaceToStage() {
  assertSafeStagePath(stageRoot);
  mkdirSync(stageRoot, { recursive: true });

  const excludeDirs = [
    'node_modules',
    '.git',
    '.idea',
    '.expo',
    '.gradle',
    '.kotlin',
    'build',
    'build-artifacts',
    'dist',
    'web-build',
    '.turbo',
    '.pnpm',
  ];
  const excludeFiles = [
    '*.apk',
    '*.tsbuildinfo',
    '*.jks',
    '*.p8',
    '*.p12',
    '*.key',
    '*.mobileprovision',
    'debug-build-stacktrace.log',
  ];
  const args = [
    workspaceRoot,
    stageRoot,
    '/MIR',
    '/R:2',
    '/W:1',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/XD',
    ...excludeDirs,
    '/XF',
    ...excludeFiles,
  ];

  console.log(`Mirroring workspace to short Android dev path: ${stageRoot}`);
  const result = spawnSync('robocopy', args, { stdio: 'inherit' });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) >= 8) {
    process.exit(result.status ?? 1);
  }
}

function ensureDebugKeystore() {
  const relativeKeystore = path.join(
    'artifacts',
    'docpocket',
    'android',
    'app',
    'debug.keystore',
  );
  const source = path.join(workspaceRoot, relativeKeystore);
  const target = path.join(stageRoot, relativeKeystore);

  if (existsSync(target)) return;

  mkdirSync(path.dirname(target), { recursive: true });

  if (existsSync(source)) {
    copyFileSync(source, target);
    return;
  }

  console.log('Generating Android debug keystore for staged dev build...');
  run('keytool', [
    '-genkeypair',
    '-storetype',
    'JKS',
    '-keystore',
    target,
    '-storepass',
    'android',
    '-alias',
    'androiddebugkey',
    '-keypass',
    'android',
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '10000',
    '-dname',
    'CN=Android Debug,O=Android,C=US',
  ]);
}

function runAndroid(cwd, extraEnv = {}) {
  const args = [
    'exec',
    'expo',
    'run:android',
    ...passthroughArgs.filter((arg) => arg !== '--no-stage' && arg !== '--'),
  ];
  const env = {};

  if (extraEnv.PNPM_VIRTUAL_STORE_DIR) {
    env.PNPM_VIRTUAL_STORE_DIR = extraEnv.PNPM_VIRTUAL_STORE_DIR;
  }

  if (extraEnv.DOCPOCKET_ANDROID_IN_STAGE) {
    env.DOCPOCKET_ANDROID_IN_STAGE = extraEnv.DOCPOCKET_ANDROID_IN_STAGE;
  }

  run('pnpm.cmd', args, {
    cwd,
    env,
  });
}

function runFromWindowsStage() {
  mirrorWorkspaceToStage();
  ensureDebugKeystore();

  console.log(`Installing staged dependencies with short pnpm store: ${virtualStore}`);
  run(
    'pnpm.cmd',
    [
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
      '--ignore-scripts',
      '--virtual-store-dir',
      virtualStore,
    ],
    { cwd: stageRoot },
  );

  console.log('Running Expo Android from staged workspace...');
  runAndroid(path.join(stageRoot, 'artifacts', 'docpocket'), {
    DOCPOCKET_ANDROID_IN_STAGE: '1',
    PNPM_VIRTUAL_STORE_DIR: virtualStore,
  });
}

try {
  if (shouldUseWindowsStage()) {
    runFromWindowsStage();
  } else {
    runAndroid(projectRoot);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
