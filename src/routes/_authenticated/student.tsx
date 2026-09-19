import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, BookOpen, LogOut, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({
    meta: [
      { title: "لوحة الطالب — نظام المدرس والطلاب" },
      { name: "description", content: "تابع صفوفك وحصصك القادمة في مكان واحد." },
      { property: "og:title", content: "لوحة الطالب" },
      { property: "og:description", content: "صفوفك وحصصك القادمة." },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select("id, status, classes(id, name, grade_level, schedule_note), teachers(full_name, subject)");
      if (error) throw error;

      const classIds = (enrollments ?? [])
        .map((e) => (e.classes as { id: string } | null)?.id)
        .filter(Boolean) as string[];

      let lessons: { id: string; title: string; starts_at: string; class_id: string }[] = [];
      if (classIds.length) {
        const { data: ls, error: lessonError } = await supabase
          .from("lessons")
          .select("id,title,starts_at,class_id")
          .in("class_id", classIds)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(10);
        if (lessonError) throw lessonError;
        lessons = ls ?? [];
      }
      return { enrollments: enrollments ?? [], lessons };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-display font-bold">لوحة الطالب</span>
          </div>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="size-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <h1 className="text-2xl font-bold">أهلًا {profile?.full_name || "بك"}</h1>

        <section className="surface-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="size-5 text-primary" /> صفوفي
          </h2>
          {isPending ? (
            <p className="mt-3 text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : data?.enrollments.length ? (
            <ul className="mt-4 divide-y divide-border">
              {data.enrollments.map((e) => {
                const cls = e.classes as {
                  name: string;
                  grade_level: string | null;
                  schedule_note: string | null;
                } | null;
                const t = e.teachers as { full_name: string; subject: string } | null;
                return (
                  <li key={e.id} className="py-3 text-sm">
                    <p className="font-medium">{cls?.name}</p>
                    <p className="text-muted-foreground">
                      {t ? `${t.full_name} · ${t.subject}` : ""}
                      {cls?.schedule_note ? ` · ${cls.schedule_note}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              لم يتم إلحاقك بأي صف بعد. تواصل مع مدرسك لإضافتك.
            </p>
          )}
        </section>

        <section className="surface-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="size-5 text-primary" /> حصصي القادمة
          </h2>
          {data?.lessons.length ? (
            <ul className="mt-4 divide-y divide-border">
              {data.lessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">{l.title}</span>
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
            <p className="mt-3 text-sm text-muted-foreground">لا توجد حصص قادمة حاليًا.</p>
          )}
        </section>
      </main>
    </div>
  );
}
