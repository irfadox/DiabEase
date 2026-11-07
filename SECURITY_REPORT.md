# DiabEase — Security Audit & Threat Assessment Report (Phase 1)

**Date:** 2026-11-07  
**Auditor Role:** Senior Application Security & Systems Engineer  
**Baseline Commit:** `3c5d529504ea291cc3af98917ced00c34be33e29` (`main`)  
**Scope:** Client application, environment secrets handling, build pipeline, PostgreSQL Row Level Security (RLS), and API communication.

---

## 1. Executive Summary

DiabEase handles sensitive personal health information (Protected Health Information / PHI), including blood glucose readings, dietary records, clinical consultations, emergency SOS alerts, and patient-doctor communications.

The application architecture demonstrates good security practices in several core areas:
- Server-side authorization is enforced using PostgreSQL Row Level Security (RLS) policies.
- Helper functions (`private.is_doctor_of`, `private.are_linked_users`) isolate patient health records to assigned doctors only.
- HTML injection in clinical PDF export is mitigated through contextual HTML entity escaping (`escapeHtml`).
- AI model integrations and third-party LLM endpoints were completely excised from production paths in commit `e778b36`.

However, the audit identified critical and high-severity risks concerning **cloud build artifact exposure**, **client-side credential storage**, and **authentication flow edge cases**.

---

## 2. Threat & Vulnerability Matrix

| ID | Title | Severity | Category | Status (Phase 2 Post-Fix) |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Force-Inclusion of `.env` in EAS Cloud Builds via `.easignore` | **Critical** | Secrets Management | **RESOLVED** (Removed `!.env`) |
| **SEC-02** | Unencrypted Session Token Storage in `AsyncStorage` | **High** | Data at Rest | Documented (Architectural roadmap) |
| **SEC-03** | Exposed Historical Credentials in Git Provenance | **High** | Secrets Leakage | Documented (Rotation required) |
| **SEC-04** | Missing Server Publication DDL for Realtime Authorization | **Medium** | Authorization & RLS | **RESOLVED** (Added DDL to SQL) |
| **SEC-05** | Development Mock Authentication Gating Review | **Medium** | Authentication Bypass | Confirmed (Guarded by `__DEV__`) |
| **SEC-06** | Unrestricted Doctor Directory Visibility & Assignment | **Medium** | Access Control | Documented (Privacy architecture) |
| **SEC-07** | Absence of Message & Input Field Length Validation | **Low** | Input Validation | Documented |

---

## 3. Detailed Security Findings

### SEC-01: Force-Inclusion of `.env` in EAS Cloud Builds via `.easignore`
- **Severity:** Critical
- **Affected File:** [`.easignore`](file:///home/azo/Documents/Team_projects/DiabEase/.easignore) (line 46)
- **CWE:** CWE-312: Cleartext Storage of Sensitive Information / CWE-538: File Inclusion of Sensitive Data
- **Root Cause:**
  In commit `792b682`, `.easignore` was introduced with the following negation rule at the bottom:
  ```text
  # Upload the project .env so release builds have the same public
  # Supabase URL and anon key as Expo Go. Keep this last so it wins.
  !.env
  ```
  By default, EAS CLI uses `.easignore` to decide which files to bundle and upload to Expo's remote build infrastructure. Because `!.env` explicitly overrides `.gitignore`, executing `eas build` packages and transmits the developer's local `.env` file to Expo cloud servers. If the developer's `.env` contains database keys, service tokens, or private environment variables, they are transmitted offsite and embedded in build archive logs.
- **Reproduction Steps:**
  1. Inspect `.easignore` line 46: rule `!.env` is active.
  2. Run `eas build` with an active `.env`: the `.env` file is packed in the build tarball.
- **Evidence:**
  [`.easignore#L44-L46`](file:///home/azo/Documents/Team_projects/DiabEase/.easignore#L44-L46):
  ```text
  # Upload the project .env so release builds have the same public
  # Supabase URL and anon key as Expo Go. Keep this last so it wins.
  !.env
  ```
- **Recommended Fix:**
  1. Remove `!.env` from `.easignore`.
  2. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS Environment Variables via EAS Dashboard or `eas env:create`.

---

### SEC-02: Unencrypted Session Token Storage in `AsyncStorage`
- **Severity:** High
- **Affected Files:**
  - [`utils/supabase.js`](file:///home/azo/Documents/Team_projects/DiabEase/utils/supabase.js) (lines 10–14, 33–39)
  - [`package.json`](file:///home/azo/Documents/Team_projects/DiabEase/package.json)
  - [`app.json`](file:///home/azo/Documents/Team_projects/DiabEase/app.json)
- **CWE:** CWE-922: Insecure Storage of Sensitive Information
- **Root Cause:**
  The application includes `expo-secure-store` in `package.json` and declares it as a plugin in `app.json`. However, `utils/supabase.js` instantiates `realSupabase` with a custom `StorageAdapter` that delegates entirely to `@react-native-async-storage/async-storage`:
  ```javascript
  const StorageAdapter = {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  };
  ```
  On Android, `AsyncStorage` writes values into unencrypted SQLite files (`/data/data/kg.com.diabease.app/databases/RKStorage`). On iOS, it stores values in unencrypted XML/plist files. If a device is rooted, jailbroken, backed up unencrypted, or inspected via physical extraction, Supabase JWT access and refresh tokens can be extracted to hijack sessions.
- **Reproduction Steps:**
  Inspect `utils/supabase.js` lines 10-14. Tokens are stored under `@supabase.auth.token` in plaintext AsyncStorage.
- **Recommended Fix:**
  Use `expo-secure-store` (backed by Android Keystore / iOS Keychain) to persist auth tokens, reserving `AsyncStorage` only for non-sensitive UI settings (font size, language preference).

---

### SEC-03: Exposed Historical Credentials in Git Provenance
- **Severity:** High
- **Affected Files:**
  - Git commit history (`b5b4a23`, `e778b36`, and prior)
  - [`.env.example`](file:///home/azo/Documents/Team_projects/DiabEase/.env.example)
  - [`RELEASE_AUDIT.md`](file:///home/azo/Documents/Team_projects/DiabEase/RELEASE_AUDIT.md) (lines 215–227)
- **CWE:** CWE-798: Use of Hard-coded Credentials
- **Root Cause:**
  Prior commits in repository history committed live API keys:
  - OpenRouter API key (`sk-or-v1-...`)
  - Supabase project reference and anon key for project `vsxrrzkfrvrtwvbazkrw`
  While `.env.example` now contains placeholders and `.env` is ignored by Git, historical commits retain these secrets. Anyone with read access to the GitHub repository can retrieve the historical credentials via `git log -p`.
- **Reproduction Steps:**
  Run `git log -S "sk-or-v1" -p` or inspect commit history.
- **Evidence:**
  Documented in `RELEASE_AUDIT.md` lines 215–227.
- **Recommended Fix:**
  1. Revoke the exposed OpenRouter API key immediately via the provider console.
  2. Rotate the Supabase anon JWT and verify database service-role secrets for any referenced projects.
  3. If this repository ever becomes public, use `git filter-repo` or BFG Repo-Cleaner to scrub secret strings from git history.

---

### SEC-04: Missing Server Publication DDL for Realtime Authorization
- **Severity:** Medium
- **Affected Files:**
  - [`setup_database.sql`](file:///home/azo/Documents/Team_projects/DiabEase/setup_database.sql)
  - [`screens/PatientDetailScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/PatientDetailScreen.js) (lines 45–70)
  - [`screens/ChatScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/ChatScreen.js) (lines 43–55)
- **CWE:** CWE-284: Improper Access Control
- **Root Cause:**
  In Supabase, Postgres Changes subscriptions broadcast database events over WebSockets. In PostgreSQL, RLS for Realtime requires that the tables belong to the `supabase_realtime` publication, and that PostgreSQL Row-Level Security evaluates the connected user's JWT.
  `setup_database.sql` does not include:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ```
  If Realtime is enabled globally on the database without column/row security filtering enabled for the publication, or if a table is omitted, either events fail to stream or events might be broadcast without row filtering if RLS isn't properly evaluated on the publication.
- **Evidence:**
  `setup_database.sql` lacks publication configuration DDL.
- **Recommended Fix:**
  Add explicit DDL to `setup_database.sql`:
  ```sql
  ALTER TABLE logs REPLICA IDENTITY FULL;
  ALTER TABLE messages REPLICA IDENTITY FULL;
  ALTER PUBLICATION supabase_realtime ADD TABLE logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ```

---

### SEC-05: Development Mock Authentication Gating Review
- **Severity:** Medium (Informational / Architectural Risk)
- **Affected Files:**
  - [`utils/supabase.js`](file:///home/azo/Documents/Team_projects/DiabEase/utils/supabase.js) (lines 31, 429–463, 476–522)
- **CWE:** CWE-489: Active Debug Code in Production
- **Root Cause:**
  `utils/supabase.js` embeds mock authentication logic with hardcoded test passwords:
  ```javascript
  if (mockBackendEnabled &&
      (normalized === 'dev_test@example.com' || normalized === 'dev_test_doctor@example.com') &&
      password === 'aidar') { ... }
  ```
  Line 31 establishes:
  ```javascript
  const mockBackendEnabled = typeof __DEV__ !== 'undefined' && __DEV__;
  ```
  In React Native release builds (e.g. `eas build --profile production`), the Metro bundler minifies with `__DEV__ = false`, causing dead-code elimination to strip or neutralize `mockBackendEnabled`.
  However, if a preview or staging build is compiled without `--dev false`, this bypass remains active.
- **Evidence:**
  [`utils/supabase.js#L31`](file:///home/azo/Documents/Team_projects/DiabEase/utils/supabase.js#L31) and [`#L429-L434`](file:///home/azo/Documents/Team_projects/DiabEase/utils/supabase.js#L429-L434).
- **Recommended Fix:**
  Ensure that all release and preview build profiles in `eas.json` enforce production environment bundling (`"channel": "production"` or `--no-dev`). Move mock development credentials to external mock fixture files that are excluded from production bundling.

---

### SEC-06: Unrestricted Doctor Directory Visibility & Assignment
- **Severity:** Medium
- **Affected Files:**
  - [`setup_database.sql`](file:///home/azo/Documents/Team_projects/DiabEase/setup_database.sql) (lines 155–163)
  - [`components/DoctorSelection.js`](file:///home/azo/Documents/Team_projects/DiabEase/components/DoctorSelection.js)
- **CWE:** CWE-200: Exposure of Sensitive Information
- **Root Cause:**
  In `setup_database.sql`:
  ```sql
  CREATE POLICY profiles_select_related
    ON profiles FOR SELECT TO authenticated
    USING (
      id = auth.uid()
      OR (role = 'doctor' AND private.current_profile_role() = 'patient')
      OR (role = 'patient' AND private.is_doctor_of(id))
    );
  ```
  This allows any authenticated patient to query all doctor profiles, including their `full_name`, `email`, `phone_number`, `affiliation`, and `description`.
  Additionally, any patient can assign themselves to any doctor by executing an update on their own profile (`assigned_doctor_id`). While this is required for the prototype workflow, in a real clinical deployment, doctors should accept or invite patients to prevent denial-of-service spam in doctor dashboards.
- **Evidence:**
  `setup_database.sql` lines 155–163.
- **Recommended Fix:**
  Create a restricted view (`public.doctor_directory`) that excludes personal phone numbers and internal emails, exposing only public clinic information (`full_name`, `affiliation`, `description`).

---

### SEC-07: Absence of Message & Input Field Length Validation
- **Severity:** Low
- **Affected Files:**
  - [`screens/ChatScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/ChatScreen.js) (lines 109–125)
  - [`screens/DiaryScreen.js`](file:///home/azo/Documents/Team_projects/DiabEase/screens/DiaryScreen.js) (lines 58–87)
  - [`setup_database.sql`](file:///home/azo/Documents/Team_projects/DiabEase/setup_database.sql)
- **CWE:** CWE-400: Uncontrolled Resource Consumption
- **Root Cause:**
  Text fields for chat messages (`messages.text`), diary notes (`logs.notes`), and reminder titles (`reminders.title`) are defined as unconstrained PostgreSQL `TEXT` columns and lack client-side character length limits (`maxLength`). A malicious client could send multi-megabyte payloads, causing denial-of-service or memory bloat in mobile list renders.
- **Recommended Fix:**
  Add `maxLength={1000}` on chat input and `maxLength={500}` on diary notes, accompanied by a database check constraint (`CHECK (char_length(text) <= 5000)`).
