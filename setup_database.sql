-- 1. Profiles table (Doctors & Patients)
-- UPDATE: Added phone_number and assigned_doctor_id
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT CHECK (role IN ('patient', 'doctor')),
  phone_number TEXT,
  assigned_doctor_id UUID REFERENCES profiles(id),
  affiliation TEXT, -- For doctors
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Logs table (Sugar levels, diet, etc.)
CREATE TABLE logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sugar_level DECIMAL,
  notes TEXT,
  status TEXT, -- 'Высокий', 'Норма', 'Низкий'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Reminders table
CREATE TABLE reminders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  time TEXT, -- Stores ISO string or specific format
  type TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Chat Messages
-- UPDATE: Added is_sos and is_system for special alerts
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT,
  is_sos BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- MIGRATION SCRIPT (For existing users, run this if profiles already exists)
/*
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES profiles(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_sos BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
*/

-- TRIGGER FOR NEW USER PROFILE
-- UPDATE: Handle phone_number from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone_number, affiliation, description)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'description'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically create a profile for every new user created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Relationship-aware access control
-- Keep helper functions outside the exposed public schema.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.is_doctor(doctor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = doctor_id AND role = 'doctor'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_doctor_of(patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = patient_id
      AND role = 'patient'
      AND assigned_doctor_id = auth.uid()
      AND private.current_profile_role() = 'doctor'
  );
$$;

CREATE OR REPLACE FUNCTION private.are_linked_users(first_user_id UUID, second_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role = 'patient'
      AND (
        (id = first_user_id AND assigned_doctor_id = second_user_id)
        OR (id = second_user_id AND assigned_doctor_id = first_user_id)
      )
  );
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_doctor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_doctor_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.are_linked_users(UUID, UUID) TO authenticated;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_related ON profiles;
CREATE POLICY profiles_select_related
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (role = 'doctor' AND private.current_profile_role() = 'patient')
    OR (role = 'patient' AND private.is_doctor_of(id))
  );

DROP POLICY IF EXISTS profiles_insert_self ON profiles;
CREATE POLICY profiles_insert_self
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role IN ('patient', 'doctor'));

DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = private.current_profile_role()
    AND (
      assigned_doctor_id IS NULL
      OR (role = 'patient' AND private.is_doctor(assigned_doctor_id))
    )
  );

DROP POLICY IF EXISTS logs_select_related ON logs;
CREATE POLICY logs_select_related
  ON logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_doctor_of(user_id));

DROP POLICY IF EXISTS logs_insert_self ON logs;
CREATE POLICY logs_insert_self
  ON logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS logs_delete_self ON logs;
CREATE POLICY logs_delete_self
  ON logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS reminders_self ON reminders;
CREATE POLICY reminders_self
  ON reminders FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS messages_select_linked ON messages;
CREATE POLICY messages_select_linked
  ON messages FOR SELECT TO authenticated
  USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND private.are_linked_users(sender_id, receiver_id)
  );

DROP POLICY IF EXISTS messages_insert_linked ON messages;
CREATE POLICY messages_insert_linked
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND private.are_linked_users(sender_id, receiver_id)
  );

CREATE INDEX IF NOT EXISTS profiles_assigned_doctor_idx
  ON profiles (assigned_doctor_id);

CREATE INDEX IF NOT EXISTS logs_user_timestamp_idx
  ON logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS messages_participants_timestamp_idx
  ON messages (sender_id, receiver_id, timestamp ASC);
