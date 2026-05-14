const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

const watchFolders = new Set([...(config.watchFolders ?? []), workspaceRoot]);
const virtualStore =
  process.env.PNPM_VIRTUAL_STORE_DIR || path.resolve(workspaceRoot, ".pnpm");

if (virtualStore && fs.existsSync(virtualStore)) {
  watchFolders.add(virtualStore);
}

config.watchFolders = Array.from(watchFolders);
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
