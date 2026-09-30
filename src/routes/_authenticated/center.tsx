import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, GraduationCap, LogOut, Users, BookOpen, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMyProfile, useSession } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/center")({
  head: () => ({
    meta: [
      { title: "لوحة مدير السنتر — نظام المدرس والطلاب" },
      { name: "description", content: "إدارة بيانات السنتر ومتابعة المدرسين والصفوف والطلاب التابعين له." },
      { property: "og:title", content: "لوحة مدير السنتر" },
      { property: "og:description", content: "متابعة مدرسي السنتر وصفوفهم وطلابهم." },
    ],
  }),
  component: () => (
    <RoleGuard role="center_manager">
      <CenterDashboard />
    </RoleGuard>
  ),
});

function CenterDashboard() {
  const { data: session } = useSession();
  const { data: profile } = useMyProfile();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const { data: center, isPending } = useQuery({
    queryKey: ["my-center", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centers")
        .select("*")
        .eq("manager_id", userId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (center) {
      setName(center.name);
      setPhone(center.phone ?? "");
      setAddress(center.address ?? "");
    }
  }, [center]);

  const centerId = center?.id;

  const { data: teachers } = useQuery({
    queryKey: ["center-teachers", centerId],
    enabled: !!centerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, full_name, subject, stage, phone")
        .eq("center_id", centerId!)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const teacherIds = (teachers ?? []).map((t) => t.id);

  const { data: stats } = useQuery({
    queryKey: ["center-stats", centerId, teacherIds.join(",")],
    enabled: !!centerId && teacherIds.length > 0,
    queryFn: async () => {
      const [classes, students] = await Promise.all([
        supabase.from("classes").select("id, name, teacher_id, price").in("teacher_id", teacherIds),
        supabase.from("students").select("id, teacher_id").in("teacher_id", teacherIds),
      ]);
      if (classes.error) throw classes.error;
      if (students.error) throw students.error;
      return { classes: classes.data, students: students.data };
    },
  });

  const saveCenter = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null };
      if (center) {
        const { error } = await supabase.from("centers").update(payload).eq("id", center.id).eq("manager_id", userId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("centers").insert({ ...payload, manager_id: userId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ بيانات السنتر");
      queryClient.invalidateQueries({ queryKey: ["my-center"] });
    },
    onError: () => toast.error("تعذّر حفظ بيانات السنتر"),
  });

  const removeTeacher = useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.rpc("remove_teacher_from_center", { _teacher_id: teacherId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم فصل المدرس عن السنتر");
      setRemoving(null);
      queryClient.invalidateQueries({ queryKey: ["center-teachers"] });
      queryClient.invalidateQueries({ queryKey: ["center-stats"] });
    },
    onError: () => toast.error("تعذّر فصل المدرس"),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-display font-bold">لوحة مدير السنتر</span>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <h1 className="text-2xl font-bold">أهلًا {profile?.full_name || "بك"}</h1>

        <section className="surface-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Building2 className="size-5 text-primary" /> {center ? "بيانات السنتر" : "أنشئ السنتر الخاص بك"}
          </h2>
          {isPending ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveCenter.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="c-name">اسم السنتر</Label>
                <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-phone">الهاتف <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
                <Input id="c-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-address">العنوان <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
                <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={saveCenter.isPending}>
                  {saveCenter.isPending ? "جارٍ الحفظ..." : center ? "حفظ التعديلات" : "إنشاء السنتر"}
                </Button>
              </div>
            </form>
          )}
        </section>

        {center && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat icon={Users} label="المدرسون" value={teachers?.length ?? 0} />
              <Stat icon={BookOpen} label="الصفوف" value={stats?.classes.length ?? 0} />
              <Stat icon={GraduationCap} label="الطلاب" value={stats?.students.length ?? 0} />
            </div>

            <section className="surface-card p-5">
              <h2 className="mb-1 text-lg font-bold">مدرسو السنتر</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                ينضم المدرس لسنترك باختياره من صفحة «ملفي». يمكنك فصل أي مدرس عن السنتر.
              </p>
              {teachers?.length ? (
                <div className="divide-y divide-border">
                  {teachers.map((t) => {
                    const cls = stats?.classes.filter((c) => c.teacher_id === t.id).length ?? 0;
                    const st = stats?.students.filter((s) => s.teacher_id === t.id).length ?? 0;
                    return (
                      <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-medium">{t.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.subject}
                            {t.stage ? ` · ${t.stage}` : ""} · {cls} صف · {st} طالب
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setRemoving({ id: t.id, name: t.full_name })}
                        >
                          <UserMinus className="size-4" /> فصل
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد مدرسون تابعون للسنتر بعد.</p>
              )}
            </section>
          </>
        )}
      </main>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>فصل «{removing?.name}» عن السنتر؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيصبح مدرسًا مستقلًا، ولن تظهر لك بياناته أو طلابه بعد ذلك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (removing) removeTeacher.mutate(removing.id);
              }}
            >
              فصل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center gap-3 p-5">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
