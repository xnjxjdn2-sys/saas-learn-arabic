import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type StudentLike = {
  id: string;
  full_name: string;
  phone: string | null;
  guardian_phone: string | null;
  grade_level: string | null;
  notes: string | null;
};

export function StudentEditForm({
  student,
  teacherId,
  onSaved,
}: {
  student: StudentLike;
  teacherId: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(student.full_name);
  const [phone, setPhone] = useState(student.phone ?? "");
  const [guardian, setGuardian] = useState(student.guardian_phone ?? "");
  const [grade, setGrade] = useState(student.grade_level ?? "");
  const [notes, setNotes] = useState(student.notes ?? "");
  const [selected, setSelected] = useState<string[] | null>(null);

  const { data: classes } = useQuery({
    queryKey: ["classes", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .eq("teacher_id", teacherId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id,class_id")
        .eq("student_id", student.id)
        .eq("teacher_id", teacherId);
      if (error) throw error;
      return data;
    },
  });

  const current = selected ?? (enrollments ?? []).map((e) => e.class_id);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          guardian_phone: guardian.trim() || null,
          grade_level: grade.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", student.id)
        .eq("teacher_id", teacherId);
      if (error) throw error;

      const existing = enrollments ?? [];
      const toRemove = existing.filter((e) => !current.includes(e.class_id)).map((e) => e.id);
      const toAdd = current.filter((c) => !existing.some((e) => e.class_id === c));
      if (toRemove.length) {
        const { error: rErr } = await supabase.from("enrollments").delete().in("id", toRemove);
        if (rErr) throw rErr;
      }
      if (toAdd.length) {
        const { error: aErr } = await supabase
          .from("enrollments")
          .insert(toAdd.map((class_id) => ({ class_id, student_id: student.id, teacher_id: teacherId })));
        if (aErr) throw aErr;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ بيانات الطالب");
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      queryClient.invalidateQueries({ queryKey: ["student-enrollments", student.id] });
      onSaved?.();
    },
    onError: () => toast.error("تعذّر حفظ بيانات الطالب"),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`e-name-${student.id}`}>اسم الطالب</Label>
        <Input id={`e-name-${student.id}`} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>هاتف الطالب <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
          <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>هاتف ولي الأمر <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
          <Input dir="ltr" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>الصف الدراسي <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
        <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>ملاحظات <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>الصفوف المسجّل بها</Label>
        {classes?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <Checkbox
                  checked={current.includes(c.id)}
                  onCheckedChange={(v) =>
                    setSelected(v ? [...current, c.id] : current.filter((x) => x !== c.id))
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">لا توجد صفوف بعد.</p>
        )}
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
      </Button>
    </form>
  );
}
