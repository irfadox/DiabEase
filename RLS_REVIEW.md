# RLS Review

Status: review only. No SQL from this document has been executed against Supabase.

Source reviewed: `setup_database.sql` (especially lines 81-217), plus the client queries in:

- `screens/DiaryScreen.js`
- `screens/ChatScreen.js`
- `screens/PatientListScreen.js`
- `screens/PatientDetailScreen.js`
- `components/DoctorSelection.js`
- `utils/storage.js`

## Executive summary

The existing policies correctly enforce the important patient/doctor relationship for
diary data and messages. They also prevent doctors from reading unrelated patients.

I recommend leaving the missing `logs` UPDATE policy and missing `messages` UPDATE/DELETE
policies absent:

- The diary UI supports insert and delete, but not editing an existing entry. Without an
  UPDATE policy, past readings cannot be silently changed, which preserves their value as
  a health record.
- The chat UI does not edit or delete sent messages. Keeping message history immutable
  protects conversation and SOS/report integrity.
- PostgreSQL RLS denies an operation when no policy permits it. Adding policies only to
  eliminate an apparent gap would grant capabilities the product does not currently use.

No database changes are proposed at this time.

## Current helper functions

`setup_database.sql` defines these `SECURITY DEFINER` helpers in the private schema:

- `private.current_profile_role()` returns the role of `auth.uid()`.
- `private.is_doctor(doctor_id)` verifies that an ID belongs to a doctor.
- `private.is_doctor_of(patient_id)` verifies that the current authenticated user is the
  assigned doctor of that patient.
- `private.are_linked_users(first_user_id, second_user_id)` verifies that the two IDs are
  a patient and that patient's assigned doctor.

The functions are granted to the `authenticated` role only.

## Current policy audit

### Profiles

Current policy: `profiles_select_related`

```sql
CREATE POLICY profiles_select_related
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (role = 'doctor' AND private.current_profile_role() = 'patient')
    OR (role = 'patient' AND private.is_doctor_of(id))
  );
```

Results:

- A patient can read their own profile.
- A patient can also read all doctor profiles. This is required by the current
  `DoctorSelection` flow, which queries all profiles where `role = 'doctor'`.
- A patient cannot read unrelated patient profiles.
- A doctor can read their own profile and patients assigned to that doctor.
- A doctor cannot read unrelated patient profiles.

Therefore, the strict interpretation of “patient can only access their own profile” is
not currently true because the doctor directory is intentionally visible. A policy-only
change that hid every other profile would break doctor selection. If stricter privacy is
required later, the doctor directory should expose only approved public fields through a
separate view or RPC; no such architecture change is proposed here.

Current insert/update policies also ensure:

- A user can insert only a profile with `id = auth.uid()` and a valid role.
- A user can update only their own profile.
- A user cannot change their role.
- Only a patient can set `assigned_doctor_id`, and the selected ID must belong to a doctor.

### Logs

Current policies:

```sql
CREATE POLICY logs_select_related
  ON logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_doctor_of(user_id));

CREATE POLICY logs_insert_self
  ON logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY logs_delete_self
  ON logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

Results:

- A patient can select only their own logs.
- A patient can insert only logs belonging to themselves.
- A patient can delete only their own logs.
- An assigned doctor can select the patient's logs.
- An unrelated doctor cannot select those logs.
- No one can update logs through Supabase because there is no UPDATE policy.

Recommendation: keep the missing UPDATE policy. The current UI has no edit operation,
and immutable readings reduce the risk of changing historical medical data. If editing
becomes a product requirement, add a narrowly scoped policy that also prevents changing
`user_id`:

```sql
-- Future option only; do not apply unless diary editing is approved.
CREATE POLICY logs_update_self
  ON logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Reminders

Current policy:

```sql
CREATE POLICY reminders_self
  ON reminders FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Results:

- A patient can create, read, update, and delete only their own reminders.
- A doctor cannot access patient reminders through this policy.
- An unrelated user cannot access them.

### Messages

Current policies:

```sql
CREATE POLICY messages_select_linked
  ON messages FOR SELECT TO authenticated
  USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND private.are_linked_users(sender_id, receiver_id)
  );

CREATE POLICY messages_insert_linked
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND private.are_linked_users(sender_id, receiver_id)
  );
```

Results:

- A patient can read messages only when they are a participant and the other participant
  is the patient's assigned doctor.
- A patient can insert messages only as themselves and only to their assigned doctor.
- A doctor can read messages only when they are a participant and the other participant
  is an assigned patient.
- A doctor can insert messages only as themselves and only to an assigned patient.
- An unrelated patient or doctor cannot read or insert messages for this relationship.
- No user can update or delete messages through Supabase because those policies do not
  exist.

Recommendation: keep messages immutable. There is no edit/delete UI, and deletion or
editing could undermine chat history, clinical reports, and SOS accountability.

Proposed SQL: none for messages.

If message deletion is approved in the future, it should be narrowly scoped and should
consider retention/audit requirements before being implemented. It should not be added
merely because the operation is absent.

## End-to-end behavior matrix

| Behavior | Result | Reason |
|---|---|---|
| Patient reads own profile | Allowed | `id = auth.uid()` |
| Patient reads unrelated patient profile | Denied | Not covered by `profiles_select_related` |
| Patient reads doctor directory | Allowed intentionally | Required by `DoctorSelection` |
| Patient reads own diary | Allowed | `user_id = auth.uid()` |
| Patient reads another patient's diary | Denied | `private.is_doctor_of(user_id)` is false |
| Patient inserts own diary entry | Allowed | `logs_insert_self` |
| Patient inserts for another user | Denied | `user_id = auth.uid()` required |
| Patient updates diary entry | Denied | No logs UPDATE policy |
| Patient deletes own diary entry | Allowed | `logs_delete_self` |
| Patient reads/changes own reminders | Allowed | `reminders_self` |
| Patient reads another user's reminders | Denied | Owner check |
| Patient messages assigned doctor | Allowed | `private.are_linked_users` |
| Patient messages unassigned doctor | Denied | Relationship helper fails |
| Doctor reads assigned patient profile | Allowed | `private.is_doctor_of(id)` |
| Doctor reads unrelated patient profile | Denied | Relationship helper fails |
| Doctor reads assigned patient logs | Allowed | `logs_select_related` |
| Doctor reads unrelated patient logs | Denied | Relationship helper fails |
| Doctor messages assigned patient | Allowed | Linked-user check |
| Doctor messages unrelated patient | Denied | Linked-user check fails |
| Any user edits/deletes a message | Denied | No UPDATE/DELETE policy |

## Auth and mock-session interaction

The client-side mock backend is separate from Supabase RLS. It stores mock data in
AsyncStorage and therefore does not exercise database policies. It is now guarded by
`__DEV__`; release builds ignore persisted mock sessions and route queries/channels to
the real Supabase client. This review's policy conclusions apply to the real Supabase
backend, not to local mock data.
