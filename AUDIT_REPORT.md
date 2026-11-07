# DiabEase — Comprehensive Technical Audit Report (Phase 1)

**Date:** 2026-11-07  
**Auditor Role:** Senior Software & Systems Engineer  
**Baseline Commit:** `3c5d529504ea291cc3af98917ced00c34be33e29` (`main`)  
**Application Stack:** React Native 0.74.5, Expo SDK ~51.0.18, Supabase JS v2.39.3, React Navigation 6  

---

## 1. Executive Summary & Architecture Overview

DiabEase is a mobile diabetes management and tele-monitoring platform designed for patients and their supervising endocrinologists/doctors. The system architecture is organized into:
- **Client Application:** React Native / Expo application supporting Android and iOS.
- **Backend & Persistence:** Supabase (PostgreSQL 15+, Supabase Auth, Row Level Security, Realtime channels, PostgREST).
- **Local Storage:** `@react-native-async-storage/async-storage` for client preferences (language, blood sugar limits, font size) and Supabase session tokens.
- **Offline & Dev Architecture:** A hybrid mock backend (`utils/supabase.js`) activated exclusively during development (`__DEV__`).

This audit evaluated all 35 source JavaScript files, configuration files (`app.json`, `app.config.js`, `eas.json`, `.easignore`), and database definitions (`setup_database.sql`).

---

## 2. Technical Findings Matrix

| ID | Title | Severity | Category | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | Unexpected Session Deletion on Network Glitch / Offline Launch | **Critical** | Authentication | Verified |
| **AUD-02** | Doctor Registration & Profile Fallback Race Condition | **High** | Auth & Database | Verified |
| **AUD-03** | Trapped Doctor Role: Missing Settings, Language, & Logout | **High** | Navigation & UX | Verified |
| **AUD-04** | Transient Profile Fetch Error Forces Doctors into Broken Patient UI | **High** | Navigation & State | Verified |
| **AUD-05** | Android DateTimePicker Resets Selected Date When Time is Picked | **High** | Reminders | Verified |
| **AUD-06** | Expo Notification `channelId` Misconfigured in Trigger Parameter | **High** | Notifications | Verified |
| **AUD-07** | Unhandled Null Pointer Exception on `supabase.auth.getUser()` | **High** | Stability & Error Handling | Verified |
| **AUD-08** | Decimal Comma Truncation (`5,4` -> `5`) in Russian/Kyrgyz Locales | **Medium** | Data Integrity | Verified |
| **AUD-09** | Missing WHATWG URL Polyfill (`react-native-url-polyfill`) Import | **Medium** | Networking | Verified |
| **AUD-10** | Chat Realtime Channel Identifier Collision | **Medium** | Realtime | Verified |
| **AUD-11** | Unstaged Deletion of `package-lock.json` & Missing Dependencies | **High** | Build & Devops | Verified |
| **AUD-12** | Database Trigger Crash on Missing / Invalid Role Metadata | **Medium** | Database Schema | Verified |

---

## 3. Detailed Audit Findings

### AUD-01: Unexpected Session Deletion on Network Glitch / Offline Launch
- **Severity:** Critical
- **Affected Files:**
  - [`navigation/AppNavigator.js`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js) (lines 38–63)
  - [`utils/supabase.js`](file:///home/azo/Documents/Team_projects/DiabEase/utils/supabase.js) (lines 409–414)
- **Root Cause:**
  In `AppNavigator.js`, `initializeAuth` invokes `supabase.auth.getSession()`. When an expired token needs refreshing, `@supabase/supabase-js` initiates a network request to Supabase Auth. If the device is offline or the request encounters a timeout/network error, `getSession()` throws or returns `{ data: { session: null }, error: e }`.
  `AppNavigator.js` catches this error in line 48 and immediately executes:
  ```javascript
  try {
    await supabase.auth.signOut();
  } catch (signOutError) { ... }
  setSession(null);
  setRole(null);
  ```
  `signOut()` purges the refresh token from `AsyncStorage`. Consequently, an active authenticated user who opens the app with a weak cellular signal or in airplane mode is permanently logged out.
- **Reproduction Steps:**
  1. Log into DiabEase on a device or emulator.
  2. Put the device in Airplane Mode (disable Wi-Fi and Cellular).
  3. Kill the app process and relaunch DiabEase.
  4. Observe the console: `AppNavigator: Auth initialization failed`.
  5. The app navigates to `AuthScreen`. When internet is restored, the user remains logged out and must type credentials again.
- **Evidence:**
  [`navigation/AppNavigator.js#L41-L58`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js#L41-L58):
  ```javascript
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  ...
  } catch (err) {
    console.error('AppNavigator: Auth initialization failed:', err.message);
    try {
      await supabase.auth.signOut();
    } catch (signOutError) { ... }
    setSession(null);
    setRole(null);
  }
  ```
- **Recommended Fix:**
  Distinguish between authentication errors (e.g. invalid refresh token / token revoked) and network failures. Only call `signOut()` when the server explicitly returns `invalid_grant` or token revocation. For network failures, retain the existing stored session and allow cached navigation to proceed or display an offline warning banner.

---

### AUD-02: Doctor Registration & Profile Fallback Race Condition
- **Severity:** High
- **Affected Files:**
  - [`screens/AuthScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/AuthScreen.js) (lines 62–90)
  - [`navigation/AppNavigator.js`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js) (lines 105–124)
  - [`setup_database.sql`](file:///home/azo/Documents/Team_projects/DiabEase/setup_database.sql) (lines 58–79)
- **Root Cause:**
  During registration:
  1. `AuthScreen.js` calls `supabase.auth.signUp(...)`.
  2. In PostgreSQL, `on_auth_user_created` trigger fires `handle_new_user()` asynchronously or concurrently.
  3. `AuthScreen.js` then executes `await supabase.from('profiles').upsert(...)`.
  4. Simultaneously, if `onAuthStateChange` fires `SIGNED_IN`, `AppNavigator.js` calls `fetchProfile()`.
  5. If `fetchProfile()` executes before the trigger finishes inserting into `profiles`, `!data && !error` is true, causing `AppNavigator.js` to attempt a third insert into `profiles`.
  6. If email confirmation is enabled in Supabase, `signUp()` returns `session: null`. The unauthenticated client's subsequent `upsert` fails with an RLS policy violation.
  7. If duplicate registration occurs (email already exists), Supabase returns an obfuscated user object with empty `identities: []` and no error. `AuthScreen.js` falsely alerts `t.successAccountCreated`, leaving the user unable to sign in with the submitted credentials.
- **Reproduction Steps:**
  1. Register a doctor profile in `AuthScreen.js`.
  2. Observe network trace: simultaneous trigger execution and client-side upsert.
  3. Register with an already existing email: app reports "Account created" despite no account being registered.
- **Evidence:**
  [`screens/AuthScreen.js#L62-L89`](file:///home/azo/Documents/Team_projects/DiabEase/screens/AuthScreen.js#L62-L89):
  ```javascript
  const { data: authData, error } = await supabase.auth.signUp({...});
  if (error) throw error;
  if (authData?.user) {
     await supabase.from('profiles').upsert([{ id: authData.user.id, ... }]);
  }
  Alert.alert(common.success, t.successAccountCreated);
  ```
- **Recommended Fix:**
  - Remove redundant client-side `upsert` on signup; entrust profile generation to `handle_new_user()` in Postgres.
  - In `AuthScreen.js`, inspect `authData.user.identities`: if array is empty, notify the user that an account with this email already exists.
  - If `authData.session` is null, notify the user to confirm their email before logging in.

---

### AUD-03: Trapped Doctor Role: Missing Settings, Language, & Logout
- **Severity:** High
- **Affected Files:**
  - [`navigation/AppNavigator.js`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js) (lines 148–165)
  - [`screens/PatientListScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/PatientListScreen.js) (lines 20–32)
- **Root Cause:**
  `DoctorTabs` only mounts one tab: `Patients` (`PatientListScreen`).
  There is no Settings tab, no logout option, and no header logout button for doctors. While `PatientTabs` includes `SettingsScreen` (with font sizing, language switcher, and logout button), doctors have no route to access these essential features. Once a doctor signs in, they can never sign out.
- **Reproduction Steps:**
  1. Sign in as a doctor (e.g. `dev_test_doctor` in dev mode or real doctor in production).
  2. The screen shows `PatientListScreen` with tab icon "Мои Пациенты".
  3. No logout button, no profile menu, and no settings option exist anywhere on the screen or navigation bar.
- **Evidence:**
  [`navigation/AppNavigator.js#L148-L165`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js#L148-L165):
  ```javascript
  const DoctorTabs = () => (
    <Tab.Navigator ...>
      <Tab.Screen
        name="Patients"
        component={PatientListScreen}
        options={{ title: t.myPatients, ... }}
      />
    </Tab.Navigator>
  );
  ```
- **Recommended Fix:**
  Add a `Settings` tab to `DoctorTabs`, or add an explicit logout action to the header of `PatientListScreen` along with access to `SettingsScreen`.

---

### AUD-04: Transient Profile Fetch Error Forces Doctors into Broken Patient UI
- **Severity:** High
- **Affected Files:**
  - [`navigation/AppNavigator.js`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js) (lines 101–125, 195)
- **Root Cause:**
  When `fetchProfile` encounters a network glitch or Supabase error:
  `data` is null and `error` is non-null.
  Neither `if (!data && !error)` nor `else if (data)` triggers.
  `setRole` is never called, leaving `role` as initial `null`.
  In line 195:
  `component={role === 'doctor' ? DoctorTabs : PatientTabs}`
  Because `role === 'doctor'` is false, the app mounts `PatientTabs`. The doctor is presented with the patient Diary and Reminders screens, which crash or show empty states because doctors have no patient records or assigned doctor.
- **Reproduction Steps:**
  1. Mock or induce a network timeout during the `.from('profiles').select('role')` query for a doctor account.
  2. Observe that the app renders `DiaryScreen` and `PatientTabs`.
- **Evidence:**
  [`navigation/AppNavigator.js#L121-L124`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js#L121-L124) & [`#L195`](file:///home/azo/Documents/Team_projects/DiabEase/navigation/AppNavigator.js#L195).
- **Recommended Fix:**
  If profile retrieval fails, present an error state with a "Retry" button rather than defaulting to `PatientTabs`. Persist the confirmed role in `AsyncStorage` (`@user_role`) as a cached fallback.

---

### AUD-05: Android DateTimePicker Resets Selected Date When Time is Picked
- **Severity:** High
- **Affected Files:**
  - [`screens/RemindersScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/RemindersScreen.js) (lines 150–154, 420–433, 450–458)
- **Root Cause:**
  On Android, `@react-native-community/datetimepicker` in `'time'` mode returns a `Date` object initialized with today's calendar date and the chosen time.
  In `RemindersScreen.js`:
  ```javascript
  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShow(Platform.OS === 'ios');
    setDate(currentDate);
  };
  ```
  If a patient first selects a future date (e.g. next Friday) and then opens the Time picker to select 10:00 AM, Android's time picker returns `Today, 10:00 AM`. `onChange` replaces `date` entirely, resetting the reminder to today. If 10:00 AM has already passed today, line 225 (`date <= new Date()`) triggers `errorPastTime`, preventing the reminder from being saved.
- **Reproduction Steps:**
  1. Open Reminders on Android.
  2. Select Date: pick tomorrow's date.
  3. Select Time: pick an hour earlier than the current hour today (e.g. 08:00 AM).
  4. Notice the date input button reverts back to today's date, and saving triggers "Time cannot be in the past".
- **Evidence:**
  [`screens/RemindersScreen.js#L150-L154`](file:///home/azo/Documents/Team_projects/DiabEase/screens/RemindersScreen.js#L150-L154).
- **Recommended Fix:**
  When `mode === 'time'`, merge the selected time with existing `date`:
  ```javascript
  const nextDate = new Date(date);
  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  setDate(nextDate);
  ```
  And when `mode === 'date'`, preserve hours and minutes:
  ```javascript
  const nextDate = new Date(selectedDate);
  nextDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
  setDate(nextDate);
  ```

---

### AUD-06: Expo Notification `channelId` Misconfigured in Trigger Parameter
- **Severity:** High
- **Affected Files:**
  - [`screens/RemindersScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/RemindersScreen.js) (lines 177–212)
- **Root Cause:**
  Expo Notifications specifies that on Android, `channelId` belongs inside the notification `content` object (`content.channelId`). `RemindersScreen.js` places `channelId` inside `trigger`:
  ```javascript
  await Notifications.scheduleNotificationAsync({
    identifier: `reminder-${reminderId}`,
    content, // channelId missing here
    trigger: {
      date: fireDate.getTime(),
      channelId: REMINDER_CHANNEL_ID, // invalid placement
    },
  });
  ```
  Consequently, notifications are delivered via Android's default miscellaneous channel rather than the configured `'reminders'` channel (which defines `AndroidImportance.MAX`, high priority sound, vibration pattern, and lockscreen visibility).
- **Reproduction Steps:**
  Inspect Android notification channel settings for scheduled reminders on Android 8.0+; notifications do not bind to the high-importance channel.
- **Evidence:**
  [`screens/RemindersScreen.js#L197-L210`](file:///home/azo/Documents/Team_projects/DiabEase/screens/RemindersScreen.js#L197-L210).
- **Recommended Fix:**
  Place `channelId: REMINDER_CHANNEL_ID` inside `content`:
  ```javascript
  const content = {
    title: t.notificationTitle,
    body,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
    channelId: REMINDER_CHANNEL_ID,
  };
  ```

---

### AUD-07: Unhandled Null Pointer Exception on `supabase.auth.getUser()`
- **Severity:** High
- **Affected Files:**
  - [`screens/DiaryScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/DiaryScreen.js) (line 40)
  - [`screens/ChatScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/ChatScreen.js) (line 65)
  - [`screens/PatientListScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/PatientListScreen.js) (line 36)
  - [`screens/PatientDetailScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/PatientDetailScreen.js) (lines 77, 98)
  - [`components/DoctorSelection.js`](file:///home/azo/Documents/Team_projects/DiabEase/components/DoctorSelection.js) (line 50)
- **Root Cause:**
  Functions destructure `{ data: { user } }` from `supabase.auth.getUser()` and immediately dereference `user.id` without null-checking:
  ```javascript
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  ```
  If `user` is null (e.g. during token expiration, logout transition, or network failure), this throws an unhandled `TypeError: Cannot read property 'id' of null`, crashing the component mount.
- **Reproduction Steps:**
  Simulate session termination while `DiaryScreen` or `ChatScreen` is focused.
- **Evidence:**
  [`screens/DiaryScreen.js#L40-L42`](file:///home/azo/Documents/Team_projects/DiabEase/screens/DiaryScreen.js#L40-L42), [`screens/ChatScreen.js#L65-L67`](file:///home/azo/Documents/Team_projects/DiabEase/screens/ChatScreen.js#L65-L67).
- **Recommended Fix:**
  Add guards:
  ```javascript
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return;
  ```

---

### AUD-08: Decimal Comma Truncation (`5,4` -> `5`) in Russian/Kyrgyz Locales
- **Severity:** Medium
- **Affected Files:**
  - [`screens/DiaryScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/DiaryScreen.js) (lines 64, 72)
  - [`utils/storage.js`](file:///home/azo/Documents/Team_projects/DiabEase/utils/storage.js) (line 16)
- **Root Cause:**
  In Russian and Kyrgyz mobile keyboard locales, the numeric keyboard provides a comma `,`. In JavaScript, `parseFloat("5,8")` parses up to the comma and returns `5.0`. The fractional value is lost, corrupting clinical logs and trends.
- **Reproduction Steps:**
  1. Open Diary in Russian or Kyrgyz.
  2. Input `6,8` in the glucose level field.
  3. Save entry. Note recorded value is `6.0` instead of `6.8`.
- **Evidence:**
  [`screens/DiaryScreen.js#L64`](file:///home/azo/Documents/Team_projects/DiabEase/screens/DiaryScreen.js#L64): `const value = parseFloat(sugar);`.
- **Recommended Fix:**
  Normalize decimal separators prior to parsing:
  ```javascript
  const normalized = sugar.replace(',', '.');
  const value = parseFloat(normalized);
  ```

---

### AUD-09: Missing WHATWG URL Polyfill (`react-native-url-polyfill`) Import
- **Severity:** Medium
- **Affected Files:**
  - [`index.js`](file:///home/azo/Documents/Team_projects/DiabEase/index.js)
  - [`package.json`](file:///home/azo/Documents/Team_projects/DiabEase/package.json)
- **Root Cause:**
  `react-native-url-polyfill` is declared in `package.json` (`^3.0.0`), but is never imported in the application entry points (`index.js` or `App.js`). React Native’s default `URL` and `URLSearchParams` implementations deviate from WHATWG standards, leading to silent URL parameter parsing issues during Supabase auth and realtime connection handshakes.
- **Evidence:**
  `index.js` imports only `react-native-get-random-values`. Grep across the codebase confirms no import of `react-native-url-polyfill`.
- **Recommended Fix:**
  Add `import 'react-native-url-polyfill/auto';` as the second line in [`index.js`](file:///home/azo/Documents/Team_projects/DiabEase/index.js).

---

### AUD-10: Chat Realtime Channel Identifier Collision
- **Severity:** Medium
- **Affected Files:**
  - [`screens/ChatScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/ChatScreen.js) (lines 43–60)
- **Root Cause:**
  `ChatScreen.js` subscribes to a hardcoded channel named `'chat_messages'`. If a doctor navigates into a patient chat, backs out to the patient list, and re-enters the same or another patient's chat, Supabase attempts to register multiple listeners on the identical channel name, causing event duplication and memory leaks.
- **Evidence:**
  [`screens/ChatScreen.js#L44`](file:///home/azo/Documents/Team_projects/DiabEase/screens/ChatScreen.js#L44):
  `const channel = supabase.channel('chat_messages')...`
- **Recommended Fix:**
  Scope the channel dynamically by user IDs:
  ```javascript
  const channelName = `chat_${userProfile.id}_${targetId}`;
  const channel = supabase.channel(channelName)...
  ```

---

### AUD-11: Unstaged Deletion of `package-lock.json` & Missing Dependencies
- **Severity:** High
- **Affected Files:**
  - [`package-lock.json`](file:///home/azo/Documents/Team_projects/DiabEase/package-lock.json)
  - [`package.json`](file:///home/azo/Documents/Team_projects/DiabEase/package.json)
- **Root Cause:**
  In the local working copy, `package-lock.json` was deleted (15,192 deleted lines in working tree). Additionally, `node_modules` does not exist in the workspace. While this preserved local disk space, reproducible builds cannot be guaranteed without a lockfile.
- **Evidence:**
  `git status` outputs `deleted: package-lock.json`. `ls -d node_modules` returns not found.
- **Recommended Fix:**
  Generate a clean `package-lock.json` lockfile using `npm install --package-lock-only` and install clean dependencies once modification phase begins.

---

### AUD-12: Database Trigger Crash on Missing / Invalid Role Metadata
- **Severity:** Medium
- **Affected Files:**
  - [`setup_database.sql`](file:///home/azo/Documents/Team_projects/DiabEase/setup_database.sql) (lines 58–79)
- **Root Cause:**
  In `handle_new_user()`, `new.raw_user_meta_data->>'role'` is inserted directly into `profiles.role`. If `role` is omitted in the signup payload, PostgreSQL fails with `CHECK constraint violation (role IN ('patient', 'doctor'))`, causing the entire `supabase.auth.signUp()` transaction to abort.
- **Evidence:**
  [`setup_database.sql#L61-L70`](file:///home/azo/Documents/Team_projects/DiabEase/setup_database.sql#L61-L70).
- **Recommended Fix:**
  Add a default fallback in the trigger:
  ```sql
  COALESCE(NULLIF(new.raw_user_meta_data->>'role', ''), 'patient')
  ```
