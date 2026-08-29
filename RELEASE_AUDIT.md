# Release Audit

## What was inspected

- Repository source, configuration, dependencies, and tracked-file state.
- Supabase client setup, session persistence, auth initialization, logout handling, and
  development mock-backend routing.
- `setup_database.sql`, including profiles, logs, reminders, messages, helper functions,
  and RLS policies.
- `DiaryScreen`, `GlucoseHistoryTable`, `PatientListScreen`, `PatientDetailScreen`,
  `ChatScreen`, `SettingsScreen`, and their data queries.
- Localization contexts, hooks, and all relevant `lang/` dictionaries for Russian,
  English, and Kyrgyz.
- PDF generation and sharing paths.
- Supabase Postgres Changes subscriptions for messages and logs.
- `package.json`, `package-lock.json`, `app.json`, `eas.json`, `.env`, `.env.example`,
  `.gitignore`, and README documentation.
- Repository test-file patterns and npm scripts.

## What was changed

### Auth/session

- Kept Supabase `persistSession: true`, `autoRefreshToken: true`, and AsyncStorage
  session storage.
- Gated the local mock backend behind `__DEV__`.
- Prevented persisted mock sessions and mock signup fallbacks from being used in release
  builds.
- Restored real Supabase realtime-channel routing outside mock sessions.
- Prevented an initial auth-state callback from ending the startup loading state before
  `getSession()` completes.
- Propagated real `getSession()` errors so invalid-session cleanup can run.
- Added a localized logout button in patient Settings using
  `supabase.auth.signOut()`.

### RLS

- Audited the deployed-policy assumptions and added `RLS_REVIEW.md`.
- No SQL was executed or applied to Supabase.
- The existing logs, profiles, reminders, and messages policies remain unchanged.

### AI removal

- Deleted `screens/AIScreen.js`.
- Deleted `lang/LangAIScreen.js`.
- Removed AI, OpenRouter, and DeepSeek references from committed source/configuration
  and README documentation.

### Secrets

- Replaced credentials in `.env.example` with placeholders.
- Removed embedded credentials from `eas.json`.
- Added `.env` to `.gitignore`.
- Removed `.env` from Git tracking while preserving the local file unchanged.

### History/table

- Extracted the diary table/history UI into reusable
  `components/GlucoseHistoryTable.js`.
- Reused that component in both `DiaryScreen` and `PatientDetailScreen`.
- Preserved the existing diary card history view and report-sharing flow.

### Period filter

- Added shared `utils/logFilters.js`.
- Added Today, Last 7 days, Last 30 days, Last 3 months, and Custom date filters.
- Reused `filterLogsByPeriod()` for both patient and doctor views.

### PDF export

- Added `expo-print` compatible with Expo SDK 51.
- Reused existing `expo-sharing`.
- Export fetches fresh authenticated data before generating a PDF.
- PDF output includes patient name, selected period, date/time, value, status, and notes.

### Doctor dashboard

- Kept the existing `PatientListScreen` query and navigation.
- Added the shared table, period filter, and patient-only PDF export to
  `PatientDetailScreen`.
- Doctor exports use a fresh query scoped to the selected patient’s `user_id`.

### Realtime

- Kept the existing `ChatScreen` message subscription unchanged.
- Added a logs INSERT subscription in `PatientDetailScreen`, filtered to the selected
  patient.
- Incoming records are deduplicated and sorted before updating the screen.

### Localization

- Added localized history, filter, custom-date, PDF, logout, and missing-notes strings
  for Russian, English, and Kyrgyz.
- Localized visible fallback text and Settings numeric placeholders.
- Internal errors and diagnostics remain hardcoded but are not shown directly; displayed
  alerts use localized strings.

## What was fixed

- Fixed the startup auth race that could briefly show the Auth screen before a persisted
  session had been resolved.
- Fixed swallowed `getSession()` errors that could leave invalid-session cleanup
  incomplete.
- Fixed a mock-session restoration race during development startup.
- Prevented the mock backend, including network-fallback mock signup, from operating in
  release builds.
- Ensured real Supabase realtime channels are used for non-mock sessions.
- Fixed hardcoded visible missing-notes fallbacks and Settings placeholders.
- Centralized history/filter/PDF logic so doctor and patient views do not maintain
  separate implementations.

## What remains / known issues

- `setup_database.sql` does not configure the `supabase_realtime` publication. The
  project-level Dashboard setting must be verified manually for `logs`.
- RLS protects normal database queries, but Realtime publication and deployed policy
  state cannot be confirmed from this repository.
- The doctor dashboard has no Settings tab, so the added logout button is currently
  available from the patient Settings screen only.
- `.env` remains locally present by explicit request and contains old exposed
  credentials; it is ignored and no longer tracked.
- EAS has no embedded environment values. Preview builds require Supabase environment
  variables configured in EAS project settings/secrets.
- `expo-secure-store` remains declared/configured but is not used for sessions; sessions
  currently use AsyncStorage.
- No automated test suite or test script exists.
- Web export was not part of this release validation; React Native Web dependencies are
  not declared.

## What was actually tested

- Android JavaScript bundle export succeeded with:
  `npx expo export --platform android`.
- The final Android bundle included the shared table, doctor detail, PDF, localization,
  auth, and realtime code without Metro transform errors.
- `git diff --check` passed.
- `app.json`, `eas.json`, and `package.json` were parsed successfully as JSON.
- Grep-based checks found no remaining application imports or committed configuration
  references to the deleted AI/OpenRouter/DeepSeek implementation.
- Grep-based localization checks found no remaining hardcoded user-facing strings in the
  changed history, diary, patient-detail, or logout UI paths.
- Static inspection confirmed:
  - `PatientListScreen` filters by the current doctor ID.
  - `PatientDetailScreen` queries logs by the selected patient’s `user_id`.
  - Patient and doctor PDF exports fetch through authenticated Supabase queries.
  - The existing chat realtime channel remains in `ChatScreen.js`.
- `npm test -- --runInBand` was attempted; npm reported `Missing script: "test"`, so
  there is no automated test command to run.
- No SQL was run against Supabase.
- No EAS build or Google Play publishing was attempted.

These checks are code-level and bundling checks only. They do not verify UI behavior or
runtime behavior on an Android device.

## What could NOT be tested

- No physical Android device testing was performed.
- No Android emulator testing was performed.
- No real user interaction was verified.
- No real login, logout, patient assignment, or cross-account RLS scenario was run.
- No Supabase Dashboard settings were verified.
- No confirmation was obtained that `logs` is in the `supabase_realtime` publication.
- No live Realtime authorization test was run with assigned and unassigned doctors.
- PDF rendering with Cyrillic and Kyrgyz text was not verified on a device.
- PDF sharing behavior was not verified on a device.
- No Google Play publication was attempted.

## MANUAL ACTIONS REQUIRED FROM THE DEVELOPER

- [ ] Revoke/rotate the exposed OpenRouter API key.
- [ ] Investigate and possibly rotate the second Supabase project found in the old
      `.env.example` (`vsxrrzkfrvrtwvbazkrw`).
- [ ] Verify in the Supabase Dashboard that the `logs` table is included in the
      `supabase_realtime` publication.
- [ ] Verify in the Supabase Dashboard that deployed RLS matches `setup_database.sql`.
- [ ] Manually test that an unassigned doctor does **not** receive realtime events for a
      patient they are not assigned to.
- [ ] Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS
      preview environment variables/secrets; do not put them back into `eas.json`.
- [ ] Manually build the APK with
      `eas build --platform android --profile preview`.
- [ ] Test the APK on a real device or emulator.
- [ ] Manually verify PDF export renders correctly with Cyrillic and Kyrgyz text.

## Exact steps to build the testing APK

From the repository root:

```bash
npm install
eas login
eas build --platform android --profile preview
```

Before the build, configure these variables in the EAS project’s preview environment:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The repository’s `eas.json` preview profile is ready structurally:

```json
{
  "android": {
    "buildType": "apk"
  }
}
```

It contains no embedded secrets. No OpenRouter variable is required because the AI
feature was removed.

Do not run a Google Play submission command for this testing build.

## Security concerns

- The old OpenRouter key was present in `.env`, `.env.example`, `eas.json`, and the
  deleted `AIScreen.js`. It must be rotated even though committed copies were removed.
- The old `.env.example` contained a second real-looking Supabase project reference and
  anon JWT for `vsxrrzkfrvrtwvbazkrw`; investigate and rotate it if still active.
- The local `.env` still contains the old Supabase and OpenRouter values because it was
  explicitly preserved. It is ignored and removed from Git tracking, but local exposure
  remains until the credentials are rotated.
- Supabase anon keys are client-visible by design, but their security depends on correct
  RLS deployment.
- Supabase sessions currently use AsyncStorage rather than encrypted SecureStore.
- No service-role key or private signing key was found.
- Realtime publication membership and RLS behavior must be verified in the Supabase
  Dashboard before production-like testing.
