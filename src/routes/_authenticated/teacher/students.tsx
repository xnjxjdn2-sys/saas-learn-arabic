import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Search, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyTeacher } from "@/lib/auth";
import { StudentEditForm } from "@/components/StudentEditForm";
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

export const Route = createFileRoute("/_authenticated/teacher/students")({
  head: () => ({
    meta: [
      { title: "الطلاب — لوحة المدرس" },
      { name: "description", content: "سجل طلابك واربطهم بالصفوف الدراسية." },
      { property: "og:title", content: "الطلاب — لوحة المدرس" },
      { property: "og:description", content: "إدارة الطلاب المرتبطين بك وبصفوفك." },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [guardian, setGuardian] = useState("");
  const [grade, setGrade] = useState("");
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

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

  const { data: students, isPending } = useQuery({
    queryKey: ["students", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, enrollments(id, classes(name))")
        .eq("teacher_id", teacher!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .insert({
          teacher_id: teacher!.id,
          center_id: teacher!.center_id,
          full_name: fullName,
          phone: phone || null,
          guardian_phone: guardian || null,
          grade_level: grade || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (classId) {
        const { error: enrollError } = await supabase.from("enrollments").insert({
          student_id: data.id,
          class_id: classId,
          teacher_id: teacher!.id,
        });
        if (enrollError) throw enrollError;
      }
    },
    onSuccess: () => {
      toast.success("تمت إضافة الطالب");
      setOpen(false);
      setFullName("");
      setPhone("");
      setGuardian("");
      setGrade("");
      setClassId("");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error("تعذّر إضافة الطالب"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id).eq("teacher_id", teacher!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الطالب");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error("تعذّر حذف الطالب (قد تكون له سجلات حضور أو مدفوعات)"),
  });

  const q = search.trim().toLowerCase();
  const filtered = (students ?? []).filter(
    (s) =>
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      (s.phone ?? "").includes(q) ||
      (s.guardian_phone ?? "").includes(q),
  );
  const editingStudent = (students ?? []).find((s) => s.id === editing);

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الطلاب</h1>
          <p className="text-sm text-muted-foreground">طلابك أنت فقط، ولا يراهم مدرس آخر.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> طالب جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة طالب</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="s-name">اسم الطالب</Label>
                <Input id="s-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="s-phone">هاتف الطالب</Label>
                  <Input id="s-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-guardian">هاتف ولي الأمر</Label>
                  <Input
                    id="s-guardian"
                    dir="ltr"
                    value={guardian}
                    onChange={(e) => setGuardian(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-grade">الصف الدراسي</Label>
                <Input id="s-grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>إلحاقه بصف (اختياري)</Label>
                <Select value={classId} onValueChange={setClassId}>
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
              <Button type="submit" className="w-full" disabled={create.isPending}>
                حفظ
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث بالاسم أو رقم الهاتف"
          className="pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : filtered.length ? (
        <div className="surface-card divide-y divide-border">
          {filtered.map((s) => {
            const enrollments = (s.enrollments ?? []) as { id: string; classes: { name: string } | null }[];
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Link
                  to="/teacher/students/$studentId"
                  params={{ studentId: s.id }}
                  className="min-w-0 flex-1 rounded-md hover:opacity-80"
                >
                  <p className="font-medium text-primary">{s.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.grade_level || "بدون صف دراسي"} {s.phone ? `· ${s.phone}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {enrollments.map((e) => (
                      <Badge key={e.id} variant="secondary">
                        {e.classes?.name}
                      </Badge>
                    ))}
                  </div>
                </Link>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => setEditing(s.id)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف"
                    className="text-destructive"
                    onClick={() => setDeleting({ id: s.id, name: s.full_name })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <Button asChild variant="ghost" size="icon" aria-label="عرض الملف">
                    <Link to="/teacher/students/$studentId" params={{ studentId: s.id }}>
                      <ChevronLeft className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          {q ? "لا توجد نتائج مطابقة للبحث." : "لا يوجد طلاب بعد. أضف أول طالب."}
        </div>
      )}

      <Dialog open={!!editingStudent} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الطالب</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <StudentEditForm student={editingStudent} teacherId={teacher.id} onSaved={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الطالب «{deleting?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الطالب نهائيًا من قائمتك. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? "جارٍ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
