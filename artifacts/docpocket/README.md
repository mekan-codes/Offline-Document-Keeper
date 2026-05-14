# DocPocket

DocPocket is an Expo React Native Android app. Most app work should happen in
TypeScript/React Native files. The `android` folder is generated native Android
project code used by Gradle.

## Main Folders

- `app` - screens and routes.
- `components` - reusable UI pieces such as modals, cards, and controls.
- `contexts` - shared app state and providers.
- `storage` - local persistence, backups, import/export, and cleanup logic.
- `utils` - small shared helpers.
- `assets/images` - app icon, splash image, and image assets.
- `app.json` - Expo config, Android package name, icon, splash, version code,
  and keyboard behavior.
- `android` - native Android project used for APK builds. Avoid editing this
  unless the change is specifically native Android/Gradle related.

## Daily Development

From the workspace root:

```powershell
pnpm install
pnpm --filter @workspace/docpocket run typecheck
pnpm --filter @workspace/docpocket run android
```

The Android command runs the app on a connected Android device or emulator.
On Windows, it uses a short staged workspace at `C:\dpk-dev` when the normal
project path is too long for native CMake/Ninja debug builds.

If you specifically want to bypass staging and run from the current folder:

```powershell
pnpm --filter @workspace/docpocket run android:local
```

For live JavaScript editing from the original source folder, Expo Go is usually
faster:

```powershell
pnpm --filter @workspace/docpocket run dev
```

When the phone and laptop are not on the same network, use tunnel mode:

```powershell
pnpm --filter @workspace/docpocket exec expo start --tunnel --clear
```

## APK Builds

Build a test APK from the workspace root:

```powershell
pnpm --filter @workspace/docpocket run apk
```

Clean native build outputs and rebuild:

```powershell
pnpm --filter @workspace/docpocket run apk:clean
```

The output APK is written to:

```text
artifacts/docpocket/build-artifacts/DocPocket-release.apk
```

On Windows, long project paths can break React Native native builds because
Gradle, CMake, Ninja, Metro, and pnpm create deeply nested paths. The APK script
automatically mirrors the workspace to `C:\dpk-apk` and uses `C:\dpk-v` as a
short pnpm virtual store when needed. This keeps the normal command stable even
when the original project lives under a long Desktop folder.

You can override those paths:

```powershell
$env:DOCPOCKET_APK_STAGE_ROOT = 'C:\dpk-apk'
$env:DOCPOCKET_PNPM_VIRTUAL_STORE = 'C:\dpk-v'
pnpm --filter @workspace/docpocket run apk
```

## Emulator Install

Install the built APK onto the active emulator:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "artifacts\docpocket\build-artifacts\DocPocket-release.apk"
```

If Android reports a signature conflict:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" uninstall com.mekan.docpocket
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install "artifacts\docpocket\build-artifacts\DocPocket-release.apk"
```

## Logo Changes

Replace these files, then rebuild the APK:

- `assets/images/icon.png`
- `assets/images/splash.png`

The config that references them is in `app.json`.

## Release Signing

The local APK command is meant for emulator/device testing and direct install.
Before publishing publicly or uploading to Google Play, add proper release
signing with a private keystore and keep that keystore outside git.
