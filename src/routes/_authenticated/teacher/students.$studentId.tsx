import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, X, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyTeacher } from "@/lib/auth";
import { arabicMonths } from "@/lib/content-utils";
import { StudentEditForm } from "@/components/StudentEditForm";

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId")({
  head: () => ({
    meta: [
      { title: "ملف الطالب — لوحة المدرس" },
      { name: "description", content: "تفاصيل الطالب: الحضور والمدفوعات والملف الشخصي." },
      { property: "og:title", content: "ملف الطالب" },
      { property: "og:description", content: "سجل الطالب الكامل." },
    ],
  }),
  component: StudentDetailPage,
});

function StudentDetailPage() {
  const { studentId } = Route.useParams();
  const { data: teacher } = useMyTeacher();
  const teacherId = teacher?.id;

  const { data: student, isPending: studentPending } = useQuery({
    queryKey: ["student", studentId, teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, enrollments(classes(name))")
        .eq("id", studentId)
        .eq("teacher_id", teacherId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["student-attendance", studentId, teacherId],
    enabled: !!teacherId && !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, lessons(title, starts_at)")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["student-payments", studentId, teacherId],
    enabled: !!teacherId && !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId!)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!teacher) return null;

  if (studentPending) {
    return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;
  }
  if (!student) {
    return (
      <div className="surface-card space-y-3 p-8 text-center">
        <p className="font-medium">هذا الطالب غير موجود أو لا يتبعك.</p>
        <Link to="/teacher/students" className="text-sm text-primary underline">
          عودة للطلاب
        </Link>
      </div>
    );
  }

  const totalLessons = attendance?.length ?? 0;
  const present = attendance?.filter((a) => a.status === "present").length ?? 0;
  const absent = totalLessons - present;
  const pct = totalLessons ? Math.round((present / totalLessons) * 100) : 0;
  const enrollments = (student.enrollments ?? []) as { classes: { name: string } | null }[];
  const totalPaid = (payments ?? []).filter((p) => p.paid).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <Link to="/teacher/students" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="size-4" /> عودة للطلاب
      </Link>

      <div className="surface-card flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {student.full_name.charAt(0)}
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{student.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {student.grade_level || "بدون صف دراسي"}
            {student.phone ? ` · ${student.phone}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {enrollments.map((e, i) => (
              <Badge key={i} variant="secondary">
                {e.classes?.name}
              </Badge>
            ))}
          </div>
        </div>
        <Badge className="bg-success text-success-foreground">نشط</Badge>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">الحضور والغياب</TabsTrigger>
          <TabsTrigger value="payments">المدفوعات</TabsTrigger>
          <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
          <TabsTrigger value="exams" disabled>
            الامتحانات (قريبًا)
          </TabsTrigger>
          <TabsTrigger value="results" disabled>
            النتائج (قريبًا)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="surface-card flex flex-col items-center justify-center p-5">
              <svg viewBox="0 0 80 80" className="size-24">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="8" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
                  transform="rotate(-90 40 40)"
                />
                <text x="40" y="46" textAnchor="middle" className="fill-foreground text-lg font-bold">
                  {pct}%
                </text>
              </svg>
              <p className="text-sm text-muted-foreground">نسبة الحضور</p>
            </div>
            <div className="surface-card flex flex-col items-center justify-center p-5">
              <ClipboardList className="size-6 text-primary" />
              <p className="mt-1 text-2xl font-bold">{totalLessons}</p>
              <p className="text-sm text-muted-foreground">إجمالي الحصص</p>
            </div>
            <div className="surface-card flex flex-col items-center justify-center p-5">
              <Check className="size-6 text-success" />
              <p className="mt-1 text-2xl font-bold">{present}</p>
              <p className="text-sm text-muted-foreground">مرات الحضور</p>
            </div>
            <div className="surface-card flex flex-col items-center justify-center p-5">
              <X className="size-6 text-destructive" />
              <p className="mt-1 text-2xl font-bold">{absent}</p>
              <p className="text-sm text-muted-foreground">مرات الغياب</p>
            </div>
          </div>

          <div className="surface-card divide-y divide-border">
            <p className="p-4 font-bold">سجل الحضور والغياب</p>
            {attendance?.length ? (
              attendance.map((a) => {
                const lesson = a.lessons as { title: string; starts_at: string } | null;
                return (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <span className="font-medium">{lesson?.title}</span>
                    <span className="text-muted-foreground">
                      {lesson ? new Date(lesson.starts_at).toLocaleDateString("ar-EG") : ""}
                    </span>
                    <Badge
                      className={
                        a.status === "present"
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }
                    >
                      {a.status === "present" ? "حاضر" : "غائب"}
                    </Badge>
                    {a.note && <span className="w-full text-xs text-muted-foreground">{a.note}</span>}
                  </div>
                );
              })
            ) : (
              <p className="p-4 text-sm text-muted-foreground">لا يوجد سجل حضور بعد.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="surface-card divide-y divide-border">
            {payments?.length ? (
              payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span className="font-medium">
                    {arabicMonths[p.month - 1]} {p.year}
                  </span>
                  <span>{Number(p.amount).toLocaleString("ar-EG")} ج.م</span>
                  <span className="text-muted-foreground">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("ar-EG") : "—"}
                  </span>
                  <Badge
                    className={
                      p.paid
                        ? "bg-success text-success-foreground"
                        : "bg-destructive text-destructive-foreground"
                    }
                  >
                    {p.paid ? "مدفوع" : "غير مدفوع"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">لا توجد مدفوعات مسجلة بعد.</p>
            )}
          </div>
          <div className="surface-card p-4 text-sm font-bold">
            إجمالي المدفوعات: {totalPaid.toLocaleString("ar-EG")} ج.م
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="surface-card p-5">
            <StudentEditForm key={student.updated_at} student={student} teacherId={teacher.id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
