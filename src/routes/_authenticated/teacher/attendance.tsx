import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyTeacher } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور والغياب — لوحة المدرس" },
      { name: "description", content: "سجّل حضور وغياب طلابك في كل حصة." },
      { property: "og:title", content: "الحضور والغياب — لوحة المدرس" },
      { property: "og:description", content: "تسجيل حضور الطلاب لكل حصة." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [marks, setMarks] = useState<Record<string, "present" | "absent">>({});

  const { data: classes } = useQuery({
    queryKey: ["classes", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .eq("teacher_id", teacher!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,title,starts_at")
        .eq("class_id", classId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roster } = useQuery({
    queryKey: ["attendance-roster", lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("enrollments")
        .select("students(id, full_name)")
        .eq("class_id", classId)
        .eq("status", "active");
      if (error) throw error;
      const { data: existing, error: attError } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("lesson_id", lessonId);
      if (attError) throw attError;
      const initial: Record<string, "present" | "absent"> = {};
      for (const s of students ?? []) {
        const st = s.students as { id: string } | null;
        if (!st) continue;
        const found = (existing ?? []).find((a) => a.student_id === st.id);
        initial[st.id] = (found?.status as "present" | "absent") ?? "present";
      }
      setMarks(initial);
      return (students ?? [])
        .map((s) => s.students as { id: string; full_name: string } | null)
        .filter(Boolean) as { id: string; full_name: string }[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(marks).map(([student_id, status]) => ({
        lesson_id: lessonId,
        student_id,
        teacher_id: teacher!.id,
        status,
      }));
      if (!rows.length) return;
      const { error } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "lesson_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الحضور");
      queryClient.invalidateQueries({ queryKey: ["attendance-roster", lessonId] });
    },
    onError: () => toast.error("تعذّر حفظ الحضور"),
  });

  if (!teacher) {
    return (
      <p className="text-sm text-muted-foreground">
        أكمل{" "}
        <Link to="/teacher/profile" className="text-primary underline">
          ملف المدرس
        </Link>{" "}
        أولًا.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الحضور والغياب</h1>
        <p className="text-sm text-muted-foreground">اختر الصف ثم الحصة وسجّل حالة كل طالب.</p>
      </div>

      <div className="surface-card grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>الصف</Label>
          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v);
              setLessonId("");
              setMarks({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر الصف" />
            </SelectTrigger>
            <SelectContent>
              {(classes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الحصة</Label>
          <Select value={lessonId} onValueChange={setLessonId} disabled={!classId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الحصة" />
            </SelectTrigger>
            <SelectContent>
              {(lessons ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title} — {new Date(l.starts_at).toLocaleDateString("ar-EG")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {lessonId &&
        (roster?.length ? (
          <div className="surface-card divide-y divide-border">
            {roster.map((s) => {
              const status = marks[s.id] ?? "present";
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                  <p className="font-medium">{s.full_name}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={status === "present" ? "default" : "outline"}
                      className={cn(status === "present" && "bg-success text-success-foreground hover:bg-success/90")}
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: "present" }))}
                    >
                      <Check className="size-4" /> حاضر
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={status === "absent" ? "destructive" : "outline"}
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: "absent" }))}
                    >
                      <X className="size-4" /> غائب
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="p-4">
              <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
                حفظ الحضور
              </Button>
            </div>
          </div>
        ) : (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 size-8 text-muted-foreground" />
            لا يوجد طلاب مسجلون في هذا الصف بعد.
          </div>
        ))}
    </div>
  );
}
