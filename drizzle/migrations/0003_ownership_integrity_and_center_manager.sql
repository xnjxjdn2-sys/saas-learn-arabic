-- Validate that referenced rows belong to the same teacher (prevents cross-teacher linking)
CREATE OR REPLACE FUNCTION public.enforce_same_teacher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'lessons' THEN
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND teacher_id = NEW.teacher_id) THEN
      RAISE EXCEPTION 'class does not belong to teacher';
    END IF;
  ELSIF TG_TABLE_NAME = 'enrollments' THEN
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND teacher_id = NEW.teacher_id)
       OR NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id AND teacher_id = NEW.teacher_id) THEN
      RAISE EXCEPTION 'class/student does not belong to teacher';
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance' THEN
    IF NOT EXISTS (SELECT 1 FROM lessons WHERE id = NEW.lesson_id AND teacher_id = NEW.teacher_id)
       OR NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id AND teacher_id = NEW.teacher_id) THEN
      RAISE EXCEPTION 'lesson/student does not belong to teacher';
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id AND teacher_id = NEW.teacher_id) THEN
      RAISE EXCEPTION 'student does not belong to teacher';
    END IF;
  ELSIF TG_TABLE_NAME = 'lesson_content' THEN
    IF NOT EXISTS (SELECT 1 FROM lessons WHERE id = NEW.lesson_id AND teacher_id = NEW.teacher_id) THEN
      RAISE EXCEPTION 'lesson does not belong to teacher';
    END IF;
  ELSIF TG_TABLE_NAME = 'class_posts' THEN
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND teacher_id = NEW.teacher_id) THEN
      RAISE EXCEPTION 'class does not belong to teacher';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t_lessons_same_teacher BEFORE INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.enforce_same_teacher();
CREATE TRIGGER t_enrollments_same_teacher BEFORE INSERT OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.enforce_same_teacher();
CREATE TRIGGER t_attendance_same_teacher BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.enforce_same_teacher();
CREATE TRIGGER t_payments_same_teacher BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_same_teacher();
CREATE TRIGGER t_lesson_content_same_teacher BEFORE INSERT OR UPDATE ON public.lesson_content FOR EACH ROW EXECUTE FUNCTION public.enforce_same_teacher();
CREATE TRIGGER t_class_posts_same_teacher BEFORE INSERT OR UPDATE ON public.class_posts FOR EACH ROW EXECUTE FUNCTION public.enforce_same_teacher();

-- Keep students/classes center_id consistent with their teacher's center
CREATE OR REPLACE FUNCTION public.sync_center_from_teacher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.center_id := (SELECT center_id FROM teachers WHERE id = NEW.teacher_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER t_students_center_sync BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.sync_center_from_teacher();
CREATE TRIGGER t_classes_center_sync BEFORE INSERT OR UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.sync_center_from_teacher();

-- Minimal center directory (id, name) for teachers choosing a center
CREATE OR REPLACE FUNCTION public.list_centers_directory()
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name FROM centers c
  WHERE auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'teacher') OR c.manager_id = auth.uid())
  ORDER BY c.name;
$$;
REVOKE ALL ON FUNCTION public.list_centers_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_centers_directory() TO authenticated;

-- Manager can detach a teacher from their own center only
CREATE OR REPLACE FUNCTION public.remove_teacher_from_center(_teacher_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.manages_teacher(_teacher_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE teachers SET center_id = NULL WHERE id = _teacher_id;
  UPDATE students SET center_id = NULL WHERE teacher_id = _teacher_id;
  UPDATE classes SET center_id = NULL WHERE teacher_id = _teacher_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_teacher_from_center(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_teacher_from_center(uuid) TO authenticated;

-- Only center managers may own one center each and managers see center's teachers' profiles-free data via existing policies
REVOKE EXECUTE ON FUNCTION public.enforce_same_teacher() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_center_from_teacher() FROM PUBLIC, anon, authenticated;