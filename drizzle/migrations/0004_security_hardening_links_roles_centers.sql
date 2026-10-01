-- 8) one role per account
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user ON public.user_roles(user_id);
-- 3) one center per manager
CREATE UNIQUE INDEX IF NOT EXISTS centers_one_per_manager ON public.centers(manager_id);
-- 4) one student record per account per teacher
CREATE UNIQUE INDEX IF NOT EXISTS students_one_per_teacher_user ON public.students(teacher_id, user_id) WHERE user_id IS NOT NULL;

-- 1/7) secure invite-code linking
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS link_code text;
CREATE UNIQUE INDEX IF NOT EXISTS students_link_code_key ON public.students(link_code) WHERE link_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gen_link_code() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
$$;

UPDATE public.students SET link_code = public.gen_link_code() WHERE user_id IS NULL AND link_code IS NULL;

CREATE OR REPLACE FUNCTION public.guard_student_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.claiming_student', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := NULL;
    NEW.link_code := public.gen_link_code();
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      IF NEW.user_id IS NOT NULL THEN
        RAISE EXCEPTION 'student account can only be linked via invite code';
      END IF;
      NEW.link_code := public.gen_link_code(); -- unlinked: issue fresh code
    ELSIF NEW.link_code IS DISTINCT FROM OLD.link_code THEN
      IF NEW.user_id IS NOT NULL THEN
        NEW.link_code := NULL;
      ELSE
        NEW.link_code := public.gen_link_code(); -- teacher regenerate: always random
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS t_students_guard_link ON public.students;
CREATE TRIGGER t_students_guard_link BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.guard_student_link();

CREATE OR REPLACE FUNCTION public.claim_student_link(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid; _tid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'student') THEN
    RAISE EXCEPTION 'only student accounts can link';
  END IF;
  SELECT id, teacher_id INTO _sid, _tid FROM students
   WHERE link_code = upper(trim(_code)) AND user_id IS NULL FOR UPDATE;
  IF _sid IS NULL THEN RAISE EXCEPTION 'invalid code'; END IF;
  IF EXISTS (SELECT 1 FROM students WHERE teacher_id = _tid AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already linked to this teacher';
  END IF;
  PERFORM set_config('app.claiming_student', 'on', true);
  UPDATE students SET user_id = auth.uid(), link_code = NULL WHERE id = _sid;
  PERFORM set_config('app.claiming_student', 'off', true);
  RETURN _sid;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_student_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_student_link(text) TO authenticated;

-- 2) center_manager only via backend invite
CREATE TABLE IF NOT EXISTS public.center_manager_invites (
  code text PRIMARY KEY,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.center_manager_invites TO service_role;
ALTER TABLE public.center_manager_invites ENABLE ROW LEVEL SECURITY;
-- no policies: not reachable from the client

CREATE OR REPLACE FUNCTION public.claim_center_manager(_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'account already has a role';
  END IF;
  UPDATE center_manager_invites SET used_by = auth.uid(), used_at = now()
   WHERE code = trim(_code) AND used_by IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid code'; END IF;
  INSERT INTO user_roles(user_id, role) VALUES (auth.uid(), 'center_manager');
END;
$$;
REVOKE ALL ON FUNCTION public.claim_center_manager(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_center_manager(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req text;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.raw_user_meta_data ->> 'phone')
  ON CONFLICT (id) DO NOTHING;
  _req := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student');
  -- center_manager is never granted from client metadata; it needs an invite code
  IF _req = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher') ON CONFLICT DO NOTHING;
  ELSIF _req <> 'center_manager' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 5/6) center join requests with manager approval
CREATE TABLE IF NOT EXISTS public.center_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS center_join_one_pending ON public.center_join_requests(teacher_id) WHERE status = 'pending';
GRANT SELECT ON public.center_join_requests TO authenticated;
GRANT ALL ON public.center_join_requests TO service_role;
ALTER TABLE public.center_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "join requests select" ON public.center_join_requests FOR SELECT TO authenticated
  USING (public.owns_teacher(teacher_id) OR public.is_center_manager_of(center_id));

CREATE OR REPLACE FUNCTION public.guard_teacher_center() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.center_change', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.center_id := NULL;
  ELSIF NEW.center_id IS DISTINCT FROM OLD.center_id THEN
    IF NEW.center_id IS NOT NULL THEN
      RAISE EXCEPTION 'joining a center requires manager approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS t_teachers_guard_center ON public.teachers;
CREATE TRIGGER t_teachers_guard_center BEFORE INSERT OR UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_center();

-- keep students/classes in sync whenever a teacher's center changes
CREATE OR REPLACE FUNCTION public.propagate_teacher_center() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.center_id IS DISTINCT FROM OLD.center_id THEN
    UPDATE students SET center_id = NEW.center_id WHERE teacher_id = NEW.id;
    UPDATE classes SET center_id = NEW.center_id WHERE teacher_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS t_teachers_propagate_center ON public.teachers;
CREATE TRIGGER t_teachers_propagate_center AFTER UPDATE OF center_id ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.propagate_teacher_center();

CREATE OR REPLACE FUNCTION public.request_join_center(_center_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tid uuid; _rid uuid;
BEGIN
  _tid := public.current_teacher_id();
  IF _tid IS NULL THEN RAISE EXCEPTION 'teacher profile required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM centers WHERE id = _center_id) THEN RAISE EXCEPTION 'center not found'; END IF;
  UPDATE center_join_requests SET status = 'cancelled', responded_at = now() WHERE teacher_id = _tid AND status = 'pending';
  INSERT INTO center_join_requests(teacher_id, center_id) VALUES (_tid, _center_id) RETURNING id INTO _rid;
  RETURN _rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_join_request() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE center_join_requests SET status = 'cancelled', responded_at = now()
  WHERE teacher_id = public.current_teacher_id() AND status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.leave_center() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tid uuid := public.current_teacher_id();
BEGIN
  IF _tid IS NULL THEN RAISE EXCEPTION 'teacher profile required'; END IF;
  UPDATE teachers SET center_id = NULL WHERE id = _tid;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_join_request(_request_id uuid, _approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r center_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM center_join_requests WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF r.id IS NULL OR NOT public.is_center_manager_of(r.center_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE center_join_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, responded_at = now() WHERE id = r.id;
  IF _approve THEN
    PERFORM set_config('app.center_change', 'on', true);
    UPDATE teachers SET center_id = r.center_id WHERE id = r.teacher_id;
    PERFORM set_config('app.center_change', 'off', true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.request_join_center(uuid), public.cancel_join_request(), public.leave_center(), public.respond_join_request(uuid, boolean), public.remove_teacher_from_center(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_join_center(uuid), public.cancel_join_request(), public.leave_center(), public.respond_join_request(uuid, boolean), public.remove_teacher_from_center(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_student_link(), public.guard_teacher_center(), public.propagate_teacher_center(), public.handle_new_user(), public.gen_link_code() FROM PUBLIC, anon, authenticated;

-- managers can read pending requesting teachers' names
CREATE OR REPLACE FUNCTION public.list_center_join_requests() RETURNS TABLE(id uuid, teacher_name text, subject text, created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, t.full_name, t.subject, r.created_at FROM center_join_requests r
  JOIN teachers t ON t.id = r.teacher_id
  JOIN centers c ON c.id = r.center_id
  WHERE r.status = 'pending' AND c.manager_id = auth.uid()
  ORDER BY r.created_at;
$$;
REVOKE ALL ON FUNCTION public.list_center_join_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_center_join_requests() TO authenticated;