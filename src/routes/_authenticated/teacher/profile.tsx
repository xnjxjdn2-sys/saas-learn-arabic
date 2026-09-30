import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  const [inCenter, setInCenter] = useState(false);
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
      setInCenter(!!teacher.center_id);
      setCenterId(teacher.center_id ?? "");
    } else if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? "");
    }
  }, [teacher, profile]);

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
        center_id: inCenter && centerId ? centerId : null,
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

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">مدرس تابع لسنتر</p>
            <p className="text-xs text-muted-foreground">أطفئه إذا كنت مدرسًا مستقلًا.</p>
          </div>
          <Switch checked={inCenter} onCheckedChange={setInCenter} />
        </div>

        {inCenter && (
          <div className="space-y-2">
            <Label>السنتر</Label>
            <Select value={centerId} onValueChange={setCenterId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر السنتر" />
              </SelectTrigger>
              <SelectContent>
                {(centers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!centers?.length && (
              <p className="text-xs text-muted-foreground">
                لا تظهر سناتر متاحة الآن. اطلب من مدير السنتر إضافتك، أو تابع كمدرس مستقل.
              </p>
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
