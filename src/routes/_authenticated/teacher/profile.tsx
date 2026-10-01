import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyProfile, useMyTeacher, useSession } from "@/lib/auth";

const SUBJECTS = ["اللغة العربية","اللغة الإنجليزية","الرياضيات","العلوم","الفيزياء","الكيمياء","الأحياء","الدراسات الاجتماعية","التاريخ","الجغرافيا","الفلسفة وعلم النفس","اللغة الفرنسية","اللغة الألمانية","الحاسب الآلي","التربية الدينية"];
const STAGES = ["المرحلة الابتدائية","المرحلة الإعدادية","المرحلة الثانوية","جامعي","كل المراحل"];
const OTHER = "__other__";

function PickOrOther({ id, label, options, value, onChange, required, placeholder }: {
  id: string; label: string; options: string[]; value: string; onChange: (v: string) => void; required?: boolean; placeholder: string;
}) {
  const isOther = value !== "" && !options.includes(value);
  const [otherMode, setOtherMode] = useState(false);
  const showOther = otherMode || isOther;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{!required && <span className="text-xs text-muted-foreground"> (اختياري)</span>}</Label>
      <Select
        value={showOther ? OTHER : value}
        onValueChange={(v) => {
          if (v === OTHER) { setOtherMode(true); onChange(""); }
          else { setOtherMode(false); onChange(v); }
        }}
      >
        <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          <SelectItem value={OTHER}>أخرى</SelectItem>
        </SelectContent>
      </Select>
      {showOther && (
        <Input required={required} placeholder="اكتب هنا" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/teacher/profile")({
  head: () => ({
    meta: [
      { title: "ملف المدرس — نظام المدرس والطلاب" },
      { name: "description", content: "أكمل بيانات المدرس: الاسم، المادة، المرحلة، والسنتر." },
      { property: "og:title", content: "ملف المدرس" },
      { property: "og:description", content: "إعداد بيانات المدرس المستقل أو التابع لسنتر." },
    ],
  }),
  component: TeacherProfile,
});

function TeacherProfile() {
  const { data: session } = useSession();
  const { data: profile } = useMyProfile();
  const { data: teacher, isPending } = useMyTeacher();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("");
  const [stage, setStage] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [centerId, setCenterId] = useState<string>("");

  const { data: centers } = useQuery({
    queryKey: ["visible-centers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_centers_directory");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (teacher) {
      setFullName(teacher.full_name);
      setSubject(teacher.subject);
      setStage(teacher.stage ?? "");
      setPhone(teacher.phone ?? "");
      setBio(teacher.bio ?? "");
    } else if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? "");
    }
  }, [teacher, profile]);

  const { data: pending } = useQuery({
    queryKey: ["my-join-request", teacher?.id],
    enabled: !!teacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("center_join_requests")
        .select("id, center_id, status")
        .eq("teacher_id", teacher!.id)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const centerAction = useMutation({
    mutationFn: async (action: "request" | "cancel" | "leave") => {
      const r =
        action === "request"
          ? await supabase.rpc("request_join_center", { _center_id: centerId })
          : action === "cancel"
            ? await supabase.rpc("cancel_join_request")
            : await supabase.rpc("leave_center");
      if (r.error) throw r.error;
      return action;
    },
    onSuccess: (a) => {
      toast.success(a === "request" ? "تم إرسال طلب الانضمام لمدير السنتر" : a === "cancel" ? "تم إلغاء الطلب" : "أصبحت مدرسًا مستقلًا");
      queryClient.invalidateQueries({ queryKey: ["my-join-request"] });
      queryClient.invalidateQueries({ queryKey: ["my-teacher"] });
    },
    onError: () => toast.error("تعذّر تنفيذ الطلب"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const userId = session!.user.id;
      const payload = {
        user_id: userId,
        full_name: fullName,
        subject,
        stage: stage || null,
        phone: phone || null,
        bio: bio || null,
      };
      if (teacher) {
        const { error } = await supabase.from("teachers").update(payload).eq("id", teacher.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teachers").insert(payload);
        if (error) throw error;
      }
      await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", userId);
    },
    onSuccess: () => {
      toast.success("تم حفظ ملف المدرس");
      queryClient.invalidateQueries({ queryKey: ["my-teacher"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: () => toast.error("تعذّر الحفظ، تأكد من البيانات المطلوبة"),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ملف المدرس</h1>
        <p className="text-sm text-muted-foreground">هذه البيانات تظهر لك ولمدير سنترك فقط.</p>
      </div>

      <form
        className="surface-card space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!subject.trim()) { toast.error("اختر المادة"); return; }
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <PickOrOther id="subject" label="المادة" required options={SUBJECTS} value={subject} onChange={setSubject} placeholder="اختر المادة" />
          <PickOrOther id="stage" label="المرحلة الدراسية" options={STAGES} value={stage} onChange={setStage} placeholder="اختر المرحلة" />
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
            <Input id="phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">نبذة تعريفية <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
          <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        {teacher && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">السنتر</p>
            {teacher.center_id ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>أنت تابع لسنتر: {centers?.find((c) => c.id === teacher.center_id)?.name ?? "—"}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => centerAction.mutate("leave")} disabled={centerAction.isPending}>
                  العمل كمدرس مستقل
                </Button>
              </div>
            ) : pending ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>طلب انضمام معلّق لسنتر: {centers?.find((c) => c.id === pending.center_id)?.name ?? "—"}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => centerAction.mutate("cancel")} disabled={centerAction.isPending}>
                  إلغاء الطلب
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">أنت مدرس مستقل. للانضمام لسنتر أرسل طلبًا ويوافق عليه مدير السنتر.</p>
                <div className="flex flex-wrap gap-2">
                  <Select value={centerId} onValueChange={setCenterId}>
                    <SelectTrigger className="w-60"><SelectValue placeholder="اختر السنتر" /></SelectTrigger>
                    <SelectContent>
                      {(centers ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" disabled={!centerId || centerAction.isPending} onClick={() => centerAction.mutate("request")}>
                    إرسال طلب انضمام
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "جارٍ الحفظ..." : "حفظ الملف"}
        </Button>
      </form>
    </div>
  );
}
