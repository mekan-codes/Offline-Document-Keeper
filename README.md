# Offline Document Keeper

This workspace contains DocPocket, an Expo React Native Android app.

Main app folder:

```text
artifacts/docpocket
```

Useful commands from this workspace root:

```powershell
pnpm install
pnpm --filter @workspace/docpocket run typecheck
pnpm --filter @workspace/docpocket run android
pnpm --filter @workspace/docpocket run apk
```

On Windows, the Android dev and APK commands automatically use short temporary
build folders to avoid native build path-length failures.

APK output:

```text
artifacts/docpocket/build-artifacts/DocPocket-release.apk
```

For app structure, emulator install commands, APK build notes, logo changes, and
release signing notes, see:

```text
artifacts/docpocket/README.md
```
