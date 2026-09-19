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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyTeacher } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/teacher/lessons")({
  head: () => ({
    meta: [
      { title: "الحصص — لوحة المدرس" },
      { name: "description", content: "جدولة الحصص المرتبطة بصفوفك ومتابعة حالتها." },
      { property: "og:title", content: "الحصص — لوحة المدرس" },
      { property: "og:description", content: "إدارة مواعيد الحصص لكل صف." },
    ],
  }),
  component: LessonsPage,
});

const statusLabels: Record<string, string> = {
  scheduled: "مجدولة",
  done: "تمت",
  cancelled: "ملغاة",
};

function LessonsPage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("60");

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

  const { data: lessons, isPending } = useQuery({
    queryKey: ["lessons", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, classes(name)")
        .eq("teacher_id", teacher!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lessons").insert({
        teacher_id: teacher!.id,
        class_id: classId,
        title,
        description: desc || null,
        starts_at: new Date(startsAt).toISOString(),
        duration_min: Number(duration) || 60,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الحصة");
      setOpen(false);
      setTitle("");
      setDesc("");
      setStartsAt("");
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
    onError: () => toast.error("تعذّر إضافة الحصة"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الحصة");
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });

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
          <h1 className="text-2xl font-bold">الحصص</h1>
          <p className="text-sm text-muted-foreground">كل حصة مرتبطة بأحد صفوفك.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!classes?.length}>
              <Plus className="size-4" /> حصة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة حصة</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>الصف</Label>
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
              <div className="space-y-2">
                <Label htmlFor="l-title">عنوان الحصة</Label>
                <Input id="l-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="l-date">الموعد</Label>
                  <Input
                    id="l-date"
                    type="datetime-local"
                    required
                    dir="ltr"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="l-dur">المدة (دقيقة)</Label>
                  <Input
                    id="l-dur"
                    type="number"
                    min="15"
                    dir="ltr"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-desc">الوصف</Label>
                <Textarea id="l-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending || !classId}>
                حفظ
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : lessons?.length ? (
        <div className="surface-card divide-y divide-border">
          {lessons.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{l.title}</p>
                <p className="text-sm text-muted-foreground">
                  {(l.classes as { name: string } | null)?.name} ·{" "}
                  {new Date(l.starts_at).toLocaleString("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {l.duration_min} دقيقة
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{statusLabels[l.status] ?? l.status}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  className="text-destructive"
                  onClick={() => remove.mutate(l.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          {classes?.length ? "لا توجد حصص بعد." : "أضف صفًا أولًا لتتمكن من جدولة الحصص."}
        </div>
      )}
    </div>
  );
}
