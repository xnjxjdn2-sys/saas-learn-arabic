CREATE TYPE public.attendance_status AS ENUM ('present', 'absent');
CREATE TYPE public.content_type AS ENUM ('video', 'image', 'file', 'link', 'text');
CREATE TYPE public.post_type AS ENUM ('announcement', 'video', 'image', 'file', 'link', 'text');

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance select" ON public.attendance FOR SELECT TO authenticated
  USING (owns_teacher(teacher_id) OR manages_teacher(teacher_id) OR EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid()));
CREATE POLICY "attendance insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "attendance update" ON public.attendance FOR UPDATE TO authenticated
  USING (owns_teacher(teacher_id)) WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "attendance delete" ON public.attendance FOR DELETE TO authenticated
  USING (owns_teacher(teacher_id));
CREATE TRIGGER t_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments select" ON public.payments FOR SELECT TO authenticated
  USING (owns_teacher(teacher_id) OR manages_teacher(teacher_id) OR EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = payments.student_id AND s.user_id = auth.uid()));
CREATE POLICY "payments insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "payments update" ON public.payments FOR UPDATE TO authenticated
  USING (owns_teacher(teacher_id)) WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "payments delete" ON public.payments FOR DELETE TO authenticated
  USING (owns_teacher(teacher_id));
CREATE TRIGGER t_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.lesson_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  type public.content_type NOT NULL,
  title text NOT NULL,
  url text,
  body text,
  file_path text,
  file_size bigint,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_content TO authenticated;
GRANT ALL ON public.lesson_content TO service_role;
ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_content select" ON public.lesson_content FOR SELECT TO authenticated
  USING (owns_teacher(teacher_id) OR manages_teacher(teacher_id) OR EXISTS (
    SELECT 1 FROM public.lessons l WHERE l.id = lesson_content.lesson_id AND is_enrolled_student(l.class_id)));
CREATE POLICY "lesson_content insert" ON public.lesson_content FOR INSERT TO authenticated
  WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "lesson_content update" ON public.lesson_content FOR UPDATE TO authenticated
  USING (owns_teacher(teacher_id)) WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "lesson_content delete" ON public.lesson_content FOR DELETE TO authenticated
  USING (owns_teacher(teacher_id));
CREATE TRIGGER t_lesson_content_updated BEFORE UPDATE ON public.lesson_content FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.class_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  type public.post_type NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  body text,
  url text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_posts TO authenticated;
GRANT ALL ON public.class_posts TO service_role;
ALTER TABLE public.class_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_posts select" ON public.class_posts FOR SELECT TO authenticated
  USING (owns_teacher(teacher_id) OR manages_teacher(teacher_id) OR is_enrolled_student(class_id));
CREATE POLICY "class_posts insert" ON public.class_posts FOR INSERT TO authenticated
  WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "class_posts update" ON public.class_posts FOR UPDATE TO authenticated
  USING (owns_teacher(teacher_id)) WITH CHECK (owns_teacher(teacher_id));
CREATE POLICY "class_posts delete" ON public.class_posts FOR DELETE TO authenticated
  USING (owns_teacher(teacher_id));
CREATE TRIGGER t_class_posts_updated BEFORE UPDATE ON public.class_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.lesson_content REPLICA IDENTITY FULL;
ALTER TABLE public.class_posts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_posts;

-- storage policies for lesson-files bucket (path: <teacher_id>/<...>)
CREATE POLICY "lesson files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-files' AND (
    owns_teacher((storage.foldername(name))[1]::uuid)
    OR manages_teacher((storage.foldername(name))[1]::uuid)
    OR EXISTS (
      SELECT 1 FROM public.lesson_content lc
      JOIN public.lessons l ON l.id = lc.lesson_id
      WHERE lc.file_path = name AND is_enrolled_student(l.class_id))
    OR EXISTS (
      SELECT 1 FROM public.class_posts cp
      WHERE cp.file_path = name AND is_enrolled_student(cp.class_id))
  ));
CREATE POLICY "lesson files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-files' AND owns_teacher((storage.foldername(name))[1]::uuid));
CREATE POLICY "lesson files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-files' AND owns_teacher((storage.foldername(name))[1]::uuid));
CREATE POLICY "lesson files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-files' AND owns_teacher((storage.foldername(name))[1]::uuid));