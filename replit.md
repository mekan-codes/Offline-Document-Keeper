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
      index.tsx          # Vault tab
      kits.tsx           # Kits tab
      info.tsx           # Info tab
      settings.tsx       # Settings tab
    file/[id].tsx        # File detail + edit + compress
    kit/[id].tsx         # Kit detail + checklist + share all
  components/
    LockScreen.tsx       # PIN/biometric lock overlay
    PINPad.tsx           # PIN entry number pad
    FileCard.tsx         # File card component
    InfoCardItem.tsx     # Info card with copy/reveal
    KitCard.tsx          # Kit card with progress bar
    AddFileModal.tsx     # Import file sheet (doc/image/camera)
    AddInfoModal.tsx     # Add/edit info card modal
    AddKitModal.tsx      # Create kit modal with templates
    FilterChips.tsx      # Horizontal scrollable filter chips
    SearchBar.tsx        # Search input
    EmptyState.tsx       # Empty state display
  contexts/
    SettingsContext.tsx  # App settings + effective theme
    AppLockContext.tsx   # PIN/biometric lock state
    VaultContext.tsx     # Files CRUD + search/filter
    InfoContext.tsx      # Info cards CRUD + search/filter
    KitsContext.tsx      # Kits CRUD + checklist toggle
  storage/
    db.ts               # AsyncStorage CRUD for all entities + backup
  constants/
    colors.ts           # Dark navy + cyan theme (light + dark)
    categories.ts       # Category configs, colors, icons
  types/
    index.ts            # All TypeScript types
```

## Architecture decisions

- **No backend** — fully offline, AsyncStorage only, no SQLite
- **PIN hashing** — custom simple hash stored in expo-secure-store (no crypto dependency)
- **File storage** — files physically copied to `FileSystem.documentDirectory/docpocket/`, metadata in AsyncStorage
- **Lock overlay** — AppLockContext renders LockScreen as an absolute overlay on top of the tab navigator
- **Privacy mode** — sensitive info cards masked with ••••, sensitive files hidden from view
- **Auto-lock** — uses AppState listener; triggers lock after configurable minutes in background

## Product

DocPocket gives users a private vault for documents and quick-copy info. Core features:
- **Vault**: Import PDFs, photos, and documents. Tag with categories (Identity, Visa, Travel, School, Medical). Set expiry dates with color-coded warnings. Star favorites, share files.
- **Info**: Store frequently-used text values (passport numbers, phone numbers, addresses). One-tap copy with auto-clipboard-clear for sensitive data. Masking/reveal toggle in privacy mode.
- **Kits**: Group files + info + checklist into situations (e.g., "Thailand Visa Kit"). Progress tracker. Share all files at once.
- **Settings**: PIN lock + biometrics, privacy mode, auto-lock timer, theme, expiry warnings, JSON backup/restore, clear all data.

## User preferences

- Android-first, portrait orientation, package: com.mekan.docpocket
- Dark navy (#0B111E) + cyan (#00C2CC) color scheme
- No cloud, no login, no analytics — fully private

## Gotchas

- Must restart the Expo workflow after adding/upgrading packages for Metro to pick up changes
- Sharing and biometrics won't work in web/Expo Go — they need a native build
- `expo-image-manipulator` `SaveFormat.JPEG` is the correct enum ref (not SaveFormat from different import)
