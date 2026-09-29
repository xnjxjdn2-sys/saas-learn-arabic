import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyTeacher } from "@/lib/auth";
import { postTypeLabels } from "@/lib/content-utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/teacher/board")({
  head: () => ({
    meta: [
      { title: "لوحة الصف — لوحة المدرس" },
      { name: "description", content: "انشر إعلانات ومواد لكل طلاب الصف." },
      { property: "og:title", content: "لوحة الصف — لوحة المدرس" },
      { property: "og:description", content: "منشورات تظهر لكل طلاب الصف." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
      if (data?.length && !classId) setClassId(data[0]!.id);
      return data;
    },
  });

  const { data: posts, isPending } = useQuery({
    queryKey: ["class-posts", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_posts")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tables<"class_posts">[];
    },
  });

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`class-posts-${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_posts", filter: `class_id=eq.${classId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["class-posts", classId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, queryClient]);

  const create = useMutation({
    mutationFn: async () => {
      let filePath: string | null = null;
      if ((type === "image" || type === "file") && file) {
        filePath = `${teacher!.id}/${Date.now()}-${file.name}`;
        const { error: upError } = await supabase.storage.from("lesson-files").upload(filePath, file);
        if (upError) throw upError;
      }
      const { error } = await supabase.from("class_posts").insert({
        class_id: classId,
        teacher_id: teacher!.id,
        type: type as Tables<"class_posts">["type"],
        title,
        body: body || null,
        url: url || null,
        file_path: filePath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم النشر");
      setOpen(false);
      setTitle("");
      setBody("");
      setUrl("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["class-posts", classId] });
    },
    onError: () => toast.error("تعذّر النشر"),
  });

  const remove = useMutation({
    mutationFn: async (post: Tables<"class_posts">) => {
      const { error } = await supabase.from("class_posts").delete().eq("id", post.id);
      if (error) throw error;
      if (post.file_path) await supabase.storage.from("lesson-files").remove([post.file_path]);
    },
    onSuccess: () => {
      toast.success("تم حذف المنشور");
      queryClient.invalidateQueries({ queryKey: ["class-posts", classId] });
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
          <h1 className="text-2xl font-bold">لوحة الصف</h1>
          <p className="text-sm text-muted-foreground">ما تنشره هنا يظهر لكل طلاب الصف فورًا.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!classId}>
              <Plus className="size-4" /> منشور جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>نشر في لوحة الصف</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(postTypeLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-title">العنوان</Label>
                <Input id="p-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-body">النص</Label>
                <Textarea id="p-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              {(type === "video" || type === "link") && (
                <div className="space-y-2">
                  <Label htmlFor="p-url">{type === "video" ? "رابط يوتيوب" : "الرابط"}</Label>
                  <Input id="p-url" dir="ltr" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
              )}
              {(type === "image" || type === "file") && (
                <div className="space-y-2">
                  <Label htmlFor="p-file">المرفق</Label>
                  <Input
                    id="p-file"
                    type="file"
                    accept={type === "image" ? "image/*" : undefined}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                نشر
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface-card max-w-xs space-y-2 p-4">
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

      {isPending ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : posts?.length ? (
        <div className="space-y-4">
          {posts.map((p) => (
            <div key={p.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Megaphone className="size-4 text-primary" />
                  <p className="font-bold">{p.title}</p>
                  <span className="text-xs text-muted-foreground">({postTypeLabels[p.type]})</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  className="text-destructive"
                  onClick={() => remove.mutate(p)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {p.body && <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-primary underline" dir="ltr">
                  {p.url}
                </a>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          لا توجد منشورات بعد في هذا الصف.
        </div>
      )}
    </div>
  );
}
