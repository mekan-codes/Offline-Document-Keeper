# DocPocket

A private, offline-first document vault and form assistant for Android. Store files, info cards, and situational kits (grouping files + info + checklists) for quick copy/share during visa applications, school submissions, travel, etc. No cloud, no login, no analytics.

## Run & Operate

- `pnpm --filter @workspace/docpocket run dev` — start the Expo dev server (scan QR with Expo Go on Android)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Expo ~54 + expo-router for navigation
- AsyncStorage for all data persistence (files, info cards, kits, settings)
- expo-secure-store for PIN hash storage
- expo-local-authentication for biometric unlock
- expo-file-system for local file copying
- expo-document-picker + expo-image-picker for file import
- expo-sharing for file sharing
- expo-clipboard for copy-to-clipboard with auto-clear
- expo-image-manipulator for image compression

## Where things live

```
artifacts/docpocket/
  app/
    _layout.tsx          # Root layout, all providers + lock overlay
    (tabs)/
      _layout.tsx        # 4 tabs: Vault, Kits, Info, Settings
      index.tsx          # Vault tab (with private vault button + privacy banner)
      kits.tsx           # Kits tab
      info.tsx           # Info tab
      settings.tsx       # Settings tab
    file/[id].tsx        # File detail + edit + compress
    kit/[id].tsx         # Kit detail + checklist + share all + add files/info
  components/
    LockScreen.tsx       # PIN/biometric lock overlay
    PINPad.tsx           # PIN entry number pad
    FileCard.tsx         # File card with lock badge for sensitive files
    InfoCardItem.tsx     # Info card with always-masked sensitive reveal/hide
    KitCard.tsx          # Kit card with progress bar
    AddFileModal.tsx     # Import file sheet (doc/image/camera)
    AddInfoModal.tsx     # Add/edit info card modal
    AddKitModal.tsx      # Create kit modal with rich templates
    FilterChips.tsx      # Horizontal scrollable filter chips
    SearchBar.tsx        # Search input
    EmptyState.tsx       # Empty state display
    PrivateVaultModal.tsx # PIN-gated full-screen private vault modal
    SelectFilesModal.tsx # Multi-select file picker for adding to kits
    SelectInfoModal.tsx  # Multi-select info card picker for adding to kits
    ErrorBoundary.tsx    # React error boundary
  contexts/
    SettingsContext.tsx  # App settings + effectiveTheme; exports SettingsContext
    AppLockContext.tsx   # PIN/biometric lock state
    VaultContext.tsx     # Files CRUD + search/filter
    InfoContext.tsx      # Info cards CRUD + search/filter
    KitsContext.tsx      # Kits CRUD + checklist toggle
  hooks/
    useColors.ts        # Reads effectiveTheme from SettingsContext, not useColorScheme
  storage/
    db.ts               # AsyncStorage CRUD for all entities; clearAllData deletes physical files
    pinUtils.ts         # hashPin() + verifyPin() utilities (used by PrivateVaultModal)
  constants/
    colors.ts           # Dark navy + cyan theme (light + dark)
    categories.ts       # Category configs, colors, icons
  types/
    index.ts            # All TypeScript types
```

## Architecture decisions

- **No backend** — fully offline, AsyncStorage only, no SQLite
- **Theme system** — `SettingsContext` exports `effectiveTheme` as the single source of truth; `useColors()` reads it via context (not `useColorScheme` directly); tab layout also reads it
- **PIN hashing** — `storage/pinUtils.ts` provides `hashPin()` and `verifyPin()`. Hash stored in expo-secure-store key `docpocket_pin_hash`
- **File storage** — files physically copied to `FileSystem.documentDirectory/docpocket/`, metadata in AsyncStorage
- **Lock overlay** — AppLockContext renders LockScreen as an absolute overlay on top of the tab navigator
- **Sensitive info cards** — ALWAYS masked by default (not privacy-mode-dependent); user taps eye icon to reveal; copy still works while masked
- **Sensitive files** — show a lock badge and shield icon; hidden from normal Vault list when privacy mode is on
- **Private Vault** — shield button in Vault header; opens PrivateVaultModal which requires PIN/biometric; shows ALL sensitive files + info cards in one view; has its own `isAuthenticated` state independent of global lock
- **Auto-lock** — uses AppState listener; triggers lock after configurable minutes in background
- **Backup honesty** — labeled "Export Metadata Backup"; info box clearly states physical files are NOT backed up; import shows preview before confirming; `clearAllData(deletePhysicalFiles=true)` deletes the docpocket/ directory
- **Kit add-files/info** — SelectFilesModal and SelectInfoModal allow multi-select with search; duplicates are prevented; removing from kit keeps original in Vault/Info
- **Kit templates** — 5 templates with real checklist items and requirements note scaffolds (Visa, School, Travel, Scholarship, Medical)
- **FileSystem types** — expo-file-system 19 (Expo 54) no longer exposes `documentDirectory`/`cacheDirectory` in the namespace types; use `(FileSystem as any).documentDirectory` where needed

## Product

DocPocket gives users a private vault for documents and quick-copy info. Core features:
- **Vault**: Import PDFs, photos, and documents. Tag with categories (Identity, Visa, Travel, School, Medical). Set expiry dates with color-coded warnings. Star favorites, share files. Shield button opens Private Vault.
- **Info**: Store frequently-used text values (passport numbers, phone numbers, addresses). One-tap copy with auto-clipboard-clear for sensitive data. Sensitive cards ALWAYS masked until revealed with eye icon.
- **Kits**: Group files + info + checklist into situations (e.g., "Thailand Visa Kit"). Progress tracker. Share all files at once. Add files/info from existing vault. Remove items without affecting originals.
- **Settings**: PIN lock + biometrics, privacy mode, auto-lock timer, light/dark/system theme, expiry warnings, JSON metadata backup/restore, wipe all data (including physical files).

## User preferences

- Android-first, portrait orientation, package: com.mekan.docpocket
- Dark navy (#0B111E) + cyan (#00C2CC) color scheme
- No cloud, no login, no analytics — fully private

## Gotchas

- Must restart the Expo workflow after adding/upgrading packages for Metro to pick up changes
- Sharing and biometrics won't work in web/Expo Go — they need a native build
- `expo-image-manipulator` `SaveFormat.JPEG` is the correct enum ref (not SaveFormat from different import)
- expo-file-system 19 (Expo 54): `FileSystem.documentDirectory` and `FileSystem.cacheDirectory` must be cast as `(FileSystem as any).documentDirectory` — the TypeScript types no longer expose them on the namespace
- `SettingsContext` is exported (not just `useSettings`) so that `useColors` can read `effectiveTheme` without a hook dependency cycle
