import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Users, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMyTeacher } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/teacher/")({
  head: () => ({
    meta: [
      { title: "نظرة عامة — لوحة المدرس" },
      { name: "description", content: "ملخص سريع لصفوفك وحصصك وطلابك." },
      { property: "og:title", content: "نظرة عامة — لوحة المدرس" },
      { property: "og:description", content: "ملخص سريع لصفوفك وحصصك وطلابك." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { data: teacher, isPending } = useMyTeacher();
  const teacherId = teacher?.id;

  const { data: stats } = useQuery({
    queryKey: ["teacher-stats", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const [classes, students, lessons] = await Promise.all([
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("teacher_id", teacherId!),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("teacher_id", teacherId!),
        supabase
          .from("lessons")
          .select("id,title,starts_at,class_id,classes(name)")
          .eq("teacher_id", teacherId!)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(5),
      ]);
      return {
        classes: classes.count ?? 0,
        students: students.count ?? 0,
        upcoming: lessons.data ?? [],
      };
    },
  });

  if (isPending) return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;

  if (!teacher) {
    return (
      <div className="surface-card mx-auto max-w-lg p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-xl font-bold">أكمل ملفك أولًا</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نحتاج بعض البيانات عنك (الاسم، المادة، هل أنت مستقل أم تابع لسنتر) قبل إنشاء الصفوف.
        </p>
        <Button asChild className="mt-4">
          <Link to="/teacher/profile">إعداد ملف المدرس</Link>
        </Button>
      </div>
    );
  }

  const cards = [
    { label: "الصفوف", value: stats?.classes ?? 0, icon: BookOpen, to: "/teacher/classes" as const },
    { label: "الطلاب", value: stats?.students ?? 0, icon: Users, to: "/teacher/students" as const },
    {
      label: "حصص قادمة",
      value: stats?.upcoming.length ?? 0,
      icon: CalendarDays,
      to: "/teacher/lessons" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">أهلًا {teacher.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {teacher.subject}
          {teacher.center_id ? " · مدرس بسنتر" : " · مدرس مستقل"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="surface-card flex items-center gap-4 p-5 hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-primary">
              <c.icon className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="surface-card p-5">
        <h2 className="text-lg font-bold">الحصص القادمة</h2>
        {stats?.upcoming.length ? (
          <ul className="mt-4 divide-y divide-border">
            {stats.upcoming.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-muted-foreground">{(l.classes as { name: string } | null)?.name}</p>
                </div>
                <span className="text-muted-foreground">
                  {new Date(l.starts_at).toLocaleString("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">لا توجد حصص قادمة بعد.</p>
        )}
      </div>
    </div>
  );
}
