import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, GraduationCap, LogOut, ClipboardList, Wallet, Megaphone, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyProfile, useSession } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";
import { arabicMonths, youtubeEmbedUrl, contentTypeLabels, postTypeLabels } from "@/lib/content-utils";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({
    meta: [
      { title: "لوحة الطالب — نظام المدرس والطلاب" },
      { name: "description", content: "تابع صفوفك وحصصك وحضورك ومدفوعاتك ومحتوى الحصص في مكان واحد." },
      { property: "og:title", content: "لوحة الطالب" },
      { property: "og:description", content: "صفوفك وحصصك وحضورك ومدفوعاتك." },
    ],
  }),
  component: () => (
    <RoleGuard role="student">
      <StudentDashboard />
    </RoleGuard>
  ),
});

function StudentDashboard() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["student-dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Only my own student records (also enforced by RLS)
      const { data: me, error: meErr } = await supabase.from("students").select("id").eq("user_id", userId!);
      if (meErr) throw meErr;
      const studentIds = (me ?? []).map((s) => s.id);
      if (!studentIds.length) {
        return { enrollments: [], lessons: [], attendance: [], payments: [], posts: [], content: [] };
      }

      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select("id, status, classes(id, name, grade_level, schedule_note), teachers(full_name, subject)")
        .in("student_id", studentIds);
      if (error) throw error;

      const classIds = (enrollments ?? [])
        .map((e) => (e.classes as { id: string } | null)?.id)
        .filter(Boolean) as string[];

      const [lessonsR, attR, payR, postsR, contentR] = await Promise.all([
        classIds.length
          ? supabase
              .from("lessons")
              .select("id,title,starts_at,class_id")
              .in("class_id", classIds)
              .gte("starts_at", new Date().toISOString())
              .order("starts_at")
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("attendance")
          .select("id,status,created_at,lessons(title,starts_at)")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id,year,month,amount,paid,paid_at")
          .in("student_id", studentIds)
          .order("year", { ascending: false })
          .order("month", { ascending: false }),
        classIds.length
          ? supabase
              .from("class_posts")
              .select("id,type,title,body,url,created_at,classes(name)")
              .in("class_id", classIds)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),
        classIds.length
          ? supabase
              .from("lesson_content")
              .select("id,type,title,body,url,file_path,sort_order,lessons!inner(title,class_id,starts_at)")
              .in("lessons.class_id", classIds)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [lessonsR, attR, payR, postsR, contentR]) if (r.error) throw r.error;

      return {
        enrollments: enrollments ?? [],
        lessons: (lessonsR.data ?? []) as { id: string; title: string; starts_at: string; class_id: string }[],
        attendance: attR.data ?? [],
        payments: payR.data ?? [],
        posts: postsR.data ?? [],
        content: contentR.data ?? [],
      };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function openFile(path: string) {
    const { data: signed, error } = await supabase.storage.from("lesson-files").createSignedUrl(path, 3600);
    if (!error && signed) window.open(signed.signedUrl, "_blank", "noopener");
  }

  const now = new Date();
  const thisMonth = data?.payments.find((p) => p.year === now.getFullYear() && p.month === now.getMonth() + 1);
  const present = data?.attendance.filter((a) => a.status === "present").length ?? 0;
  const total = data?.attendance.length ?? 0;
  const pct = total ? Math.round((present / total) * 100) : 0;

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
        <LinkCodeCard onLinked={() => queryClient.invalidateQueries({ queryKey: ["student-dashboard"] })} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-card p-5">
            <p className="text-sm text-muted-foreground">نسبة الحضور</p>
            <p className="text-2xl font-bold">{total ? `${pct}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">{present} حضور من {total} حصة</p>
          </div>
          <div className="surface-card p-5">
            <p className="text-sm text-muted-foreground">اشتراك {arabicMonths[now.getMonth()]}</p>
            <p className="mt-1">
              {thisMonth ? (
                thisMonth.paid ? (
                  <Badge className="bg-success text-success-foreground">مدفوع</Badge>
                ) : (
                  <Badge variant="destructive">غير مدفوع</Badge>
                )
              ) : (
                <Badge variant="secondary">لم يُسجّل بعد</Badge>
              )}
            </p>
          </div>
          <div className="surface-card p-5">
            <p className="text-sm text-muted-foreground">صفوفي</p>
            <p className="text-2xl font-bold">{data?.enrollments.length ?? 0}</p>
          </div>
        </div>

        <Tabs defaultValue="classes">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="classes"><BookOpen className="size-4" /> صفوفي</TabsTrigger>
            <TabsTrigger value="board"><Megaphone className="size-4" /> لوحة الصف</TabsTrigger>
            <TabsTrigger value="content"><FileText className="size-4" /> محتوى الحصص</TabsTrigger>
            <TabsTrigger value="attendance"><ClipboardList className="size-4" /> الحضور</TabsTrigger>
            <TabsTrigger value="payments"><Wallet className="size-4" /> المدفوعات</TabsTrigger>
          </TabsList>

          <TabsContent value="classes" className="space-y-6">
            <section className="surface-card p-5">
              <h2 className="text-lg font-bold">صفوفي</h2>
              {isPending ? (
                <p className="mt-3 text-sm text-muted-foreground">جارٍ التحميل...</p>
              ) : data?.enrollments.length ? (
                <ul className="mt-4 divide-y divide-border">
                  {data.enrollments.map((e) => {
                    const cls = e.classes as { name: string; schedule_note: string | null } | null;
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
                        {new Date(l.starts_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">لا توجد حصص قادمة حاليًا.</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="board">
            <section className="space-y-3">
              {data?.posts.length ? (
                data.posts.map((p) => (
                  <article key={p.id} className="surface-card p-5">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{postTypeLabels[p.type as keyof typeof postTypeLabels] ?? p.type}</Badge>
                      <span>{(p.classes as { name: string } | null)?.name}</span>
                      <span>· {new Date(p.created_at).toLocaleDateString("ar-EG")}</span>
                    </div>
                    <h3 className="font-bold">{p.title}</h3>
                    {p.body && <p className="mt-1 whitespace-pre-wrap text-sm">{p.body}</p>}
                    {p.type === "video" && p.url && youtubeEmbedUrl(p.url) ? (
                      <div className="mt-3 aspect-video overflow-hidden rounded-lg">
                        <iframe src={youtubeEmbedUrl(p.url)!} className="size-full" allowFullScreen title={p.title} />
                      </div>
                    ) : p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">
                        فتح الرابط
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="surface-card p-8 text-center text-sm text-muted-foreground">لا توجد منشورات بعد.</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="content">
            <section className="space-y-3">
              {data?.content.length ? (
                data.content.map((c) => {
                  const lesson = c.lessons as { title: string } | null;
                  return (
                    <article key={c.id} className="surface-card p-5">
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{contentTypeLabels[c.type as keyof typeof contentTypeLabels] ?? c.type}</Badge>
                        <span>{lesson?.title}</span>
                      </div>
                      <h3 className="font-bold">{c.title}</h3>
                      {c.body && <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>}
                      {c.type === "video" && c.url && youtubeEmbedUrl(c.url) ? (
                        <div className="mt-3 aspect-video overflow-hidden rounded-lg">
                          <iframe src={youtubeEmbedUrl(c.url)!} className="size-full" allowFullScreen title={c.title} />
                        </div>
                      ) : c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">
                          فتح الرابط
                        </a>
                      ) : null}
                      {c.file_path && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => openFile(c.file_path!)}>
                          فتح الملف
                        </Button>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="surface-card p-8 text-center text-sm text-muted-foreground">لا يوجد محتوى منشور بعد.</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="attendance">
            <section className="surface-card p-5">
              {data?.attendance.length ? (
                <ul className="divide-y divide-border">
                  {data.attendance.map((a) => {
                    const l = a.lessons as { title: string; starts_at: string } | null;
                    return (
                      <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                        <div>
                          <p className="font-medium">{l?.title}</p>
                          <p className="text-muted-foreground">
                            {l ? new Date(l.starts_at).toLocaleDateString("ar-EG") : ""}
                          </p>
                        </div>
                        {a.status === "present" ? (
                          <Badge className="bg-success text-success-foreground">حاضر</Badge>
                        ) : (
                          <Badge variant="destructive">غائب</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-center text-sm text-muted-foreground">لا توجد سجلات حضور بعد.</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="payments">
            <section className="surface-card p-5">
              {data?.payments.length ? (
                <ul className="divide-y divide-border">
                  {data.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium">{arabicMonths[p.month - 1]} {p.year}</p>
                        <p className="text-muted-foreground">{Number(p.amount)} ج.م</p>
                      </div>
                      {p.paid ? (
                        <Badge className="bg-success text-success-foreground">مدفوع</Badge>
                      ) : (
                        <Badge variant="destructive">غير مدفوع</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-sm text-muted-foreground">لا توجد مدفوعات مسجّلة بعد.</p>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function LinkCodeCard({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("claim_student_link", { _code: code });
    setBusy(false);
    if (error) {
      toast.error("الكود غير صحيح أو مستخدم من قبل");
      return;
    }
    toast.success("تم ربط حسابك بسجلك عند المدرس");
    setCode("");
    onLinked();
  }
  return (
    <form onSubmit={submit} className="surface-card flex flex-wrap items-end gap-2 p-4">
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">ربط حسابك بمدرس</p>
        <p className="text-xs text-muted-foreground">اطلب كود الربط من مدرسك وأدخله هنا.</p>
        <Input dir="ltr" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123DEF4" />
      </div>
      <Button type="submit" disabled={busy}>{busy ? "جارٍ الربط..." : "ربط"}</Button>
    </form>
  );
}
