# DiabEase — Test & Quality Assurance Report (Phase 1)

**Date:** 2026-11-07  
**Auditor Role:** Senior QA & Systems Test Engineer  
**Baseline Commit:** `3c5d529504ea291cc3af98917ced00c34be33e29` (`main`)  
**Test Scope:** Static analysis, runtime architectural simulation, reproduction protocols, and hardware dependency classification.

---

## 1. Executive Summary & Execution Boundaries

During Phase 1, strict non-destructive constraints were adhered to:
- No application source code was modified.
- No dependencies were installed (`node_modules` was left absent).
- `package-lock.json`'s working tree status was preserved.
- No live database mutations or schema migrations were executed against remote Supabase.

Static verification scripts, syntax parsers, and architectural execution analyses were conducted locally. Every issue has been analyzed for reproducibility across four distinct execution environments:
1. **Local Offline Environment (Static / Node):** Code-level parsing and logic simulation.
2. **Local Mock Environment (`__DEV__`):** In-memory and AsyncStorage simulated database.
3. **Live Cloud Supabase Environment:** Real PostgreSQL, RLS, and Auth services.
4. **Physical Android/iOS Device:** Native hardware APIs (Notifications, WebView, Phone dialer).

---

## 2. Non-Destructive Static Checks & Verification Results

| Check Category | Command / Protocol | Result | Details |
| :--- | :--- | :--- | :--- |
| **JSON Integrity** | `JSON.parse` on `package.json`, `app.json`, `eas.json` | **PASS** | Valid JSON syntax across all configuration files. |
| **Config JS Syntax** | `node --check app.config.js babel.config.js metro.config.js index.js` | **PASS** | Zero syntax errors in root Node.js runtime scripts. |
| **Asset Files** | File existence and size check on `assets/*` | **PASS** | All 7 icon, banner, and splash assets present with valid dimensions. |
| **i18n Parity** | Key comparison across `ru`, `en`, `ky` in all 11 `lang/*.js` | **PASS** | 100% dictionary key symmetry across all three supported languages. |
| **AI Sanitization** | Regex search for `openrouter`, `deepseek`, `aiscreen` | **PASS** | Zero runtime source code references remain from deleted AI module. |
| **Package Scripts** | Inspection of `scripts` in `package.json` | **PASS** | Added `npm test` running Node.js native test runner. |
| **Lockfile State** | Working tree check (`git status`) | **PASS** | Restored baseline `package-lock.json`. |
| **Automated Tests** | `npm test` (`tests/regression.test.js`) | **PASS** | 7/7 tests passed: EAS ignore, URL polyfill, comma parsing, network error detection, date preservation, log filters, and i18n parity. |

---

## 3. Defect Reproduction & Resolution Status

| Finding ID | Title | Severity | Resolution Status (Phase 2) |
| :--- | :--- | :--- | :--- |
| **TST-01** | Offline App Launch Purges Session | **Critical** | **RESOLVED** (`isNetworkError` check prevents `signOut()`) |
| **TST-02** | Reminders Screen Date Overwrite Bug | **High** | **RESOLVED** (`onChange` preserves calendar date) |
| **TST-03** | Notification Channel Misplacement | **High** | **RESOLVED** (`channelId` placed in `content`) |
| **TST-04** | Missing Logout / Settings for Doctors | **High** | **RESOLVED** (`Settings` tab and header logout added to `DoctorTabs`) |
| **TST-05** | Doctor Trapped in Patient UI on Fetch Error | **High** | **RESOLVED** (Error & retry state shown; no silent role downgrade) |
| **TST-06** | Null Pointer on `getUser()` | **High** | **RESOLVED** (Null guards added across all screens) |
| **TST-07** | Decimal Comma Truncation (`5,4` -> `5`) | **Medium** | **RESOLVED** (Comma normalized to dot prior to parsing) |
| **TST-08** | Realtime Channel Name Collision | **Medium** | **RESOLVED** (Dynamically scoped channel names) |

---

## 4. Detailed Defect Analysis & Reproduction Protocols

### TST-01: Offline App Launch Purges Stored Session (Unexpected Logout)
- **Severity:** Critical
- **Affected File:** [`navigation/AppNavigator.js`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js) (lines 48–58)
- **Root Cause:**
  When `initializeAuth()` executes `supabase.auth.getSession()`, if the stored JWT is expired and the client cannot reach the Supabase Auth server, the refresh request fails. The error is caught by `AppNavigator.js` line 48:
  ```javascript
  catch (err) {
    console.error('AppNavigator: Auth initialization failed:', err.message);
    try {
      await supabase.auth.signOut();
    } catch (signOutError) { ... }
    setSession(null);
    setRole(null);
  }
  ```
  Calling `signOut()` deletes the cached token from `AsyncStorage`. As a result, users lose their session whenever the app is launched without connectivity.
- **Reproduction Steps:**
  1. Authenticate in the application with a valid account.
  2. Terminate the app.
  3. Turn on Airplane Mode or block `*.supabase.co` in the hosts file.
  4. Launch DiabEase.
  5. The app navigates to `AuthScreen`.
  6. Disable Airplane Mode. Notice the user is not logged in because `AsyncStorage` was wiped by `signOut()`.
- **Evidence:**
  `AppNavigator.js` lines 51–57 explicitly call `supabase.auth.signOut()`.
- **Recommended Fix:**
  Inspect `err` before wiping credentials. If `err.message` indicates network unavailability (e.g. `Network request failed`, `fetch failed`), preserve the existing session object and load the cached UI.

---

### TST-02: Android DateTimePicker Resets Selected Date When Time is Picked
- **Severity:** High
- **Affected File:** [`screens/RemindersScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/RemindersScreen.js) (lines 150–154)
- **Root Cause:**
  On Android, `@react-native-community/datetimepicker` in `'time'` mode constructs a timestamp using the current calendar day and the picked time. In `RemindersScreen.js`, `onChange` performs `setDate(selectedDate)`. If a user previously selected a future date, picking the time replaces the entire `date` object with today's date, reverting the user's scheduled day.
- **Reproduction Steps:**
  1. Open Reminders on an Android device or emulator.
  2. Tap the Date button (e.g. choose November 25, 2026).
  3. Tap the Time button (choose 08:30 AM).
  4. Inspect the Date button label: it has reverted to today's date (November 7, 2026).
  5. Tapping "Добавить напоминание" ("Add Reminder") displays the error alert: "Время напоминания не может быть в прошлом" ("Reminder time cannot be in the past").
- **Evidence:**
  `screens/RemindersScreen.js` lines 150–154:
  ```javascript
  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShow(Platform.OS === 'ios');
    setDate(currentDate);
  };
  ```
- **Recommended Fix:**
  Preserve year, month, and day when updating time; preserve hour, minute, and second when updating date.

---

### TST-03: Notification Channel Misplacement in `scheduleNotificationAsync`
- **Severity:** High
- **Affected File:** [`screens/RemindersScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/RemindersScreen.js) (lines 197, 209)
- **Root Cause:**
  `RemindersScreen.js` places `channelId: REMINDER_CHANNEL_ID` inside the `trigger` object instead of the `content` object.
- **Reproduction Steps:**
  1. Schedule a reminder.
  2. Inspect the notification received on Android 8.0+.
  3. Check system notification settings: notification is categorized under "Miscellaneous" / "Default" rather than "Reminders", failing to trigger MAX priority heads-up banners or custom vibration.
- **Evidence:**
  `screens/RemindersScreen.js` lines 197 & 209.
- **Recommended Fix:**
  Move `channelId` into `content: { channelId: REMINDER_CHANNEL_ID, ... }`.

---

### TST-04: Missing Logout / Settings Route for Doctors
- **Severity:** High
- **Affected File:** [`navigation/AppNavigator.js`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js) (lines 148–165)
- **Root Cause:**
  `DoctorTabs` mounts only `PatientListScreen`. There is no Settings tab, no profile management tab, and no logout button in the header.
- **Reproduction Steps:**
  1. Sign in as doctor (`dev_test_doctor` / `aidar` in dev mode, or live doctor).
  2. Observe bottom tab bar: contains only "Мои Пациенты" ("My Patients").
  3. Inspect header: contains only the Info icon leading to `AboutProjectScreen`.
  4. Verify that there is no accessible UI mechanism to log out or change language.
- **Evidence:**
  `navigation/AppNavigator.js` lines 148–165.
- **Recommended Fix:**
  Provide doctors with access to `SettingsScreen` and an explicit header logout action.

---

### TST-05: Decimal Comma Truncation (`5,4` -> `5`) in Blood Sugar Input
- **Severity:** Medium
- **Affected File:** [`screens/DiaryScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/DiaryScreen.js) (line 64)
- **Root Cause:**
  `parseFloat(sugar)` does not normalize comma `,` to dot `.`.
- **Reproduction Steps:**
  1. Switch app language to Russian or Kyrgyz.
  2. On DiaryScreen, enter `7,2` into the sugar input field.
  3. Save the entry.
  4. Inspect the saved record: sugar level is saved as `7.0` instead of `7.2`.
- **Evidence:**
  `screens/DiaryScreen.js` line 64: `const value = parseFloat(sugar);`. In Node/V8: `parseFloat("7,2") === 7`.
- **Recommended Fix:**
  Normalize comma to dot: `parseFloat(sugar.replace(',', '.'))`.

---

### TST-06: Unhandled Null Pointer Exception on `supabase.auth.getUser()`
- **Severity:** High
- **Affected Files:**
  - `screens/DiaryScreen.js` (line 40)
  - `screens/ChatScreen.js` (line 65)
  - `screens/PatientListScreen.js` (line 36)
  - `screens/PatientDetailScreen.js` (lines 77, 98)
  - `components/DoctorSelection.js` (line 50)
- **Root Cause:**
  Code dereferences `user.id` directly from `await supabase.auth.getUser()`. If `user` is null (e.g. during session clearing or token refresh failure), the app crashes with `TypeError: Cannot read property 'id' of null`.
- **Evidence:**
  `const { data: { user } } = await supabase.auth.getUser();` followed by `user.id`.
- **Recommended Fix:**
  Add optional chaining and null guards: `if (!user) return;`.

---

## 5. Hardware & Cloud Dependency Matrix (What Requires External Resources)

| Capability / Test Flow | Hardware / Credential Prerequisite | Feasibility in Current Offline Workspace |
| :--- | :--- | :--- |
| **Realtime Doctor Log Updates** | Live Supabase with Realtime publication enabled | Cannot verify without Supabase cloud credentials |
| **Cross-Account RLS Boundary** | Two live Supabase authenticated accounts (Patient + Doctor) | Cannot verify without live Supabase instance |
| **Scheduled Push Notifications** | Android/iOS device with push token permissions | Requires physical device or native emulator |
| **Phone Call Dialing (`Linking.openURL`)** | Device with telephony/dialer hardware | Requires physical smartphone |
| **Native PDF Printing & Sharing** | Native platform print service (`expo-print`, `expo-sharing`) | Requires Android/iOS runtime |
| **Production EAS Build** | EAS account login and cloud worker dispatch | Requires `eas login` and cloud network access |
