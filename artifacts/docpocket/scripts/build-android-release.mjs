import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(projectRoot, '../..');
const outputDir = path.join(projectRoot, 'build-artifacts');
const apkTarget = path.join(outputDir, 'DocPocket-release.apk');
const legacyApkTarget = path.join(projectRoot, 'DocPocket-release.apk');
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const isWindows = process.platform === 'win32';
const clean = process.argv.includes('--clean');
const noStage = process.argv.includes('--no-stage');
const inStage = process.env.DOCPOCKET_APK_IN_STAGE === '1';
const stageRoot = path.resolve(
  process.env.DOCPOCKET_APK_STAGE_ROOT || path.join(path.parse(workspaceRoot).root, 'dpk-apk'),
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
      NODE_ENV: process.env.NODE_ENV ?? 'production',
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

function getApkSource(rootDir) {
  return path.join(
    rootDir,
    'artifacts',
    'docpocket',
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk',
  );
}

function copyApk(source, target) {
  if (!existsSync(source)) {
    console.error(`Release APK not found: ${source}`);
    process.exit(1);
  }

  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`Release APK copied to ${target}`);
}

function copyFinalApks(source) {
  copyApk(source, apkTarget);
  copyApk(source, legacyApkTarget);
}

function shouldUseWindowsStage() {
  if (!isWindows || inStage || noStage) return false;

  // React Native native builds can fail on Windows when pnpm/CMake/Ninja paths
  // get too long. A short physical workspace is more reliable than a junction
  // because Node and Gradle often resolve symlinks back to the original path.
  return projectRoot.length > 40 || projectRoot.includes(' ');
}

function assertSafeStagePath(target) {
  const parsed = path.parse(target);
  const base = path.basename(target).toLowerCase();
  const parent = path.dirname(target);

  if (target === parsed.root || parent !== parsed.root || !base.startsWith('dpk-')) {
    throw new Error(
      `Refusing to use unsafe APK stage path: ${target}. Use a drive-root folder named dpk-*`,
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

  console.log(`Mirroring workspace to short Android build path: ${stageRoot}`);
  const result = spawnSync('robocopy', args, { stdio: 'inherit' });

  if (result.error) {
    throw result.error;
  }

  // Robocopy returns 0-7 for success and copy differences. 8+ is failure.
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

  console.log('Generating Android debug keystore for staged test APK build...');
  const result = spawnSync(
    'keytool',
    [
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
    ],
    { stdio: 'inherit' },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildFromWindowsStage() {
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

  const stagedScript = path.join(
    stageRoot,
    'artifacts',
    'docpocket',
    'scripts',
    'build-android-release.mjs',
  );
  const nodeArgs = [stagedScript, '--no-stage'];
  if (clean) nodeArgs.push('--clean');

  console.log('Building APK from staged workspace...');
  run('node', nodeArgs, {
    cwd: path.join(stageRoot, 'artifacts', 'docpocket'),
    env: {
      DOCPOCKET_APK_IN_STAGE: '1',
      PNPM_VIRTUAL_STORE_DIR: virtualStore,
    },
  });

  copyFinalApks(
    path.join(stageRoot, 'artifacts', 'docpocket', 'build-artifacts', 'DocPocket-release.apk'),
  );
}

function buildInPlace() {
  const androidDir = path.join(projectRoot, 'android');
  const gradleArgs = clean ? ['clean', 'assembleRelease'] : ['assembleRelease'];
  const apkSource = getApkSource(workspaceRoot);
  const env = {};

  if (process.env.PNPM_VIRTUAL_STORE_DIR) {
    env.PNPM_VIRTUAL_STORE_DIR = process.env.PNPM_VIRTUAL_STORE_DIR;
  }

  run(gradleCommand, gradleArgs, {
    cwd: androidDir,
    env,
  });

  copyFinalApks(apkSource);
}

try {
  if (shouldUseWindowsStage()) {
    buildFromWindowsStage();
  } else {
    buildInPlace();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
