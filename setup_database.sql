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
CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sugar_level DECIMAL,
  notes TEXT,
  status TEXT, -- 'Высокий', 'Норма', 'Низкий'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  time TEXT, -- Stores ISO string or specific format
  type TEXT, -- JSON metadata: { mode: 'once'|'weekly', days: number[] } (JS weekday: 0=Sun)
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Chat Messages
-- UPDATE: Added is_sos and is_system for special alerts
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT,
  is_sos BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
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
-- UPDATE: Handle phone_number and safe role validation from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  -- Validate role from metadata: only 'doctor' or 'patient' permitted; default safely to 'patient'
  assigned_role := CASE
    WHEN new.raw_user_meta_data->>'role' = 'doctor' THEN 'doctor'
    ELSE 'patient'
  END;

  INSERT INTO public.profiles (id, email, full_name, role, phone_number, affiliation, description)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), 'Пользователь'), 
    assigned_role,
    new.raw_user_meta_data->>'phone_number',
    CASE WHEN assigned_role = 'doctor' THEN new.raw_user_meta_data->>'affiliation' ELSE NULL END,
    new.raw_user_meta_data->>'description'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    affiliation = COALESCE(EXCLUDED.affiliation, profiles.affiliation),
    description = COALESCE(EXCLUDED.description, profiles.description);

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

-- Safe doctor directory view to prevent harvesting of personal doctor emails and phone numbers
CREATE OR REPLACE VIEW public.doctor_directory
WITH (security_invoker = true) AS
  SELECT id, full_name, affiliation, description
  FROM public.profiles
  WHERE role = 'doctor';

GRANT SELECT ON public.doctor_directory TO authenticated;

-- Timestamp & created_at synchronization trigger
CREATE OR REPLACE FUNCTION public.sync_timestamp_columns()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_at IS NULL AND NEW.timestamp IS NOT NULL THEN
    NEW.created_at := NEW.timestamp;
  ELSIF NEW.timestamp IS NULL AND NEW.created_at IS NOT NULL THEN
    NEW.timestamp := NEW.created_at;
  ELSIF NEW.created_at IS NULL AND NEW.timestamp IS NULL THEN
    NEW.created_at := timezone('utc'::text, now());
    NEW.timestamp := NEW.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_logs_timestamp ON public.logs;
CREATE TRIGGER trg_sync_logs_timestamp
  BEFORE INSERT OR UPDATE ON public.logs
  FOR EACH ROW EXECUTE PROCEDURE public.sync_timestamp_columns();

DROP TRIGGER IF EXISTS trg_sync_messages_timestamp ON public.messages;
CREATE TRIGGER trg_sync_messages_timestamp
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.sync_timestamp_columns();

CREATE INDEX IF NOT EXISTS profiles_assigned_doctor_idx
  ON profiles (assigned_doctor_id);

CREATE INDEX IF NOT EXISTS logs_user_timestamp_idx
  ON logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS logs_user_created_at_idx
  ON logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_participants_timestamp_idx
  ON messages (sender_id, receiver_id, timestamp ASC);

CREATE INDEX IF NOT EXISTS messages_participants_created_at_idx
  ON messages (sender_id, receiver_id, created_at ASC);

-- 6. Realtime publications for logs and messages (idempotent configuration)
ALTER TABLE logs REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;
