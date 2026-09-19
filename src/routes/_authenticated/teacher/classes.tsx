import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMyTeacher } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/teacher/classes")({
  head: () => ({
    meta: [
      { title: "الصفوف — لوحة المدرس" },
      { name: "description", content: "أنشئ وأدر صفوفك الدراسية وأسعارها ومواعيدها." },
      { property: "og:title", content: "الصفوف — لوحة المدرس" },
      { property: "og:description", content: "إدارة الصفوف الدراسية الخاصة بك." },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [price, setPrice] = useState("0");
  const [note, setNote] = useState("");

  const { data: classes, isPending } = useQuery({
    queryKey: ["classes", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", teacher!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({
        teacher_id: teacher!.id,
        center_id: teacher!.center_id,
        name,
        grade_level: grade || null,
        price: Number(price) || 0,
        schedule_note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الصف");
      setOpen(false);
      setName("");
      setGrade("");
      setPrice("0");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: () => toast.error("تعذّر إضافة الصف"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الصف");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: () => toast.error("تعذّر حذف الصف"),
  });

  if (!teacher) {
    return (
      <p className="text-sm text-muted-foreground">
        أكمل <Link to="/teacher/profile" className="text-primary underline">ملف المدرس</Link> أولًا.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الصفوف</h1>
          <p className="text-sm text-muted-foreground">صفوفك الدراسية وحدها تظهر هنا.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> صف جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة صف</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="c-name">اسم الصف</Label>
                <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-grade">الصف الدراسي</Label>
                  <Input id="c-grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-price">السعر الشهري</Label>
                  <Input
                    id="c-price"
                    type="number"
                    min="0"
                    dir="ltr"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-note">ملاحظة المواعيد</Label>
                <Textarea
                  id="c-note"
                  rows={2}
                  placeholder="مثال: السبت والثلاثاء 5 مساءً"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                حفظ
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : classes?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <div key={c.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold">{c.name}</h2>
                  <p className="text-sm text-muted-foreground">{c.grade_level || "بدون مرحلة محددة"}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  onClick={() => remove.mutate(c.id)}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="mt-3 text-sm">السعر: {Number(c.price).toLocaleString("ar-EG")}</p>
              {c.schedule_note && <p className="mt-1 text-sm text-muted-foreground">{c.schedule_note}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          لا توجد صفوف بعد. ابدأ بإضافة صف جديد.
        </div>
      )}
    </div>
  );
}
