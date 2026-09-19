-- ENUMS
CREATE TYPE public.app_role AS ENUM ('teacher', 'student', 'center_manager');
CREATE TYPE public.lesson_status AS ENUM ('scheduled', 'done', 'cancelled');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'paused', 'left');

-- UPDATED_AT helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- CENTERS
CREATE TABLE public.centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centers TO authenticated;
GRANT ALL ON public.centers TO service_role;
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;

-- TEACHERS
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  stage TEXT,
  bio TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- CLASSES
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  grade_level TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  schedule_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- STUDENTS
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  guardian_phone TEXT,
  grade_level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX students_user_id_idx ON public.students(user_id);
CREATE INDEX students_teacher_id_idx ON public.students(teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- LESSONS
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_min INTEGER NOT NULL DEFAULT 60,
  status public.lesson_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- ENROLLMENTS
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_center_manager_of(_center_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _center_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.centers c WHERE c.id = _center_id AND c.manager_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_teacher(_teacher_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = _teacher_id AND t.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.manages_teacher(_teacher_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.centers c ON c.id = t.center_id
    WHERE t.id = _teacher_id AND c.manager_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_student(_class_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.class_id = _class_id AND s.user_id = auth.uid()
  );
$$;

-- POLICIES: profiles
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- POLICIES: user_roles
CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- POLICIES: centers
CREATE POLICY "center manager select" ON public.centers FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR id = (SELECT center_id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "center manager insert" ON public.centers FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid() AND public.has_role(auth.uid(), 'center_manager'));
CREATE POLICY "center manager update" ON public.centers FOR UPDATE TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());
CREATE POLICY "center manager delete" ON public.centers FOR DELETE TO authenticated USING (manager_id = auth.uid());

-- POLICIES: teachers
CREATE POLICY "teacher select" ON public.teachers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_center_manager_of(center_id));
CREATE POLICY "teacher insert own" ON public.teachers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "teacher update own" ON public.teachers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "teacher delete own" ON public.teachers FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POLICIES: classes
CREATE POLICY "classes select" ON public.classes FOR SELECT TO authenticated
  USING (public.owns_teacher(teacher_id) OR public.manages_teacher(teacher_id) OR public.is_enrolled_student(id));
CREATE POLICY "classes insert" ON public.classes FOR INSERT TO authenticated WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "classes update" ON public.classes FOR UPDATE TO authenticated
  USING (public.owns_teacher(teacher_id)) WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "classes delete" ON public.classes FOR DELETE TO authenticated USING (public.owns_teacher(teacher_id));

-- POLICIES: students
CREATE POLICY "students select" ON public.students FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_teacher(teacher_id) OR public.manages_teacher(teacher_id));
CREATE POLICY "students insert" ON public.students FOR INSERT TO authenticated WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "students update" ON public.students FOR UPDATE TO authenticated
  USING (public.owns_teacher(teacher_id)) WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "students delete" ON public.students FOR DELETE TO authenticated USING (public.owns_teacher(teacher_id));

-- POLICIES: lessons
CREATE POLICY "lessons select" ON public.lessons FOR SELECT TO authenticated
  USING (public.owns_teacher(teacher_id) OR public.manages_teacher(teacher_id) OR public.is_enrolled_student(class_id));
CREATE POLICY "lessons insert" ON public.lessons FOR INSERT TO authenticated WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "lessons update" ON public.lessons FOR UPDATE TO authenticated
  USING (public.owns_teacher(teacher_id)) WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "lessons delete" ON public.lessons FOR DELETE TO authenticated USING (public.owns_teacher(teacher_id));

-- POLICIES: enrollments
CREATE POLICY "enrollments select" ON public.enrollments FOR SELECT TO authenticated
  USING (
    public.owns_teacher(teacher_id)
    OR public.manages_teacher(teacher_id)
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "enrollments insert" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "enrollments update" ON public.enrollments FOR UPDATE TO authenticated
  USING (public.owns_teacher(teacher_id)) WITH CHECK (public.owns_teacher(teacher_id));
CREATE POLICY "enrollments delete" ON public.enrollments FOR DELETE TO authenticated USING (public.owns_teacher(teacher_id));

-- UPDATED_AT TRIGGERS
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_centers_updated BEFORE UPDATE ON public.centers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_teachers_updated BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_lessons_updated BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_enrollments_updated BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NEW USER HANDLER: profile + role from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.raw_user_meta_data ->> 'phone')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')::public.app_role;
  EXCEPTION WHEN others THEN
    _role := 'student';
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- link any student records pre-created by a teacher with the same phone
  UPDATE public.students s
  SET user_id = NEW.id
  WHERE s.user_id IS NULL
    AND _role = 'student'
    AND s.phone IS NOT NULL
    AND s.phone = NEW.raw_user_meta_data ->> 'phone';

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REALTIME
ALTER TABLE public.classes REPLICA IDENTITY FULL;
ALTER TABLE public.lessons REPLICA IDENTITY FULL;
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.enrollments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;