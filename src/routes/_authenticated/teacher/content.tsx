import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Video, Image as ImageIcon, FileText, Link2, AlignLeft, ExternalLink } from "lucide-react";
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
import { contentTypeLabels, formatBytes, youtubeEmbedUrl } from "@/lib/content-utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/teacher/content")({
  head: () => ({
    meta: [
      { title: "محتوى الحصص — لوحة المدرس" },
      { name: "description", content: "أضف فيديوهات وصورًا وملفات وروابط وشروحًا لكل حصة." },
      { property: "og:title", content: "محتوى الحصص — لوحة المدرس" },
      { property: "og:description", content: "إدارة محتوى كل حصة تعليمية." },
    ],
  }),
  component: ContentPage,
});

const typeIcons: Record<string, typeof Video> = {
  video: Video,
  image: ImageIcon,
  file: FileText,
  link: Link2,
  text: AlignLeft,
};

function ContentPage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("video");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});

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

  const { data: lessons } = useQuery({
    queryKey: ["lessons", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,title,starts_at")
        .eq("class_id", classId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: items, isPending } = useQuery({
    queryKey: ["lesson-content", lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_content")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      const signedMap: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.file_path) {
          const { data: s } = await supabase.storage
            .from("lesson-files")
            .createSignedUrl(item.file_path, 3600);
          if (s?.signedUrl) signedMap[item.id] = s.signedUrl;
        }
      }
      setSigned(signedMap);
      return (data ?? []) as Tables<"lesson_content">[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      let filePath: string | null = null;
      let fileSize: number | null = null;
      if ((type === "image" || type === "file") && file) {
        filePath = `${teacher!.id}/${Date.now()}-${file.name}`;
        const { error: upError } = await supabase.storage
          .from("lesson-files")
          .upload(filePath, file);
        if (upError) throw upError;
        fileSize = file.size;
      }
      const { error } = await supabase.from("lesson_content").insert({
        lesson_id: lessonId,
        teacher_id: teacher!.id,
        type: type as Tables<"lesson_content">["type"],
        title,
        url: type === "video" || type === "link" ? url : null,
        body: type === "text" ? body : null,
        file_path: filePath,
        file_size: fileSize,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المحتوى");
      setOpen(false);
      setTitle("");
      setUrl("");
      setBody("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["lesson-content", lessonId] });
    },
    onError: () => toast.error("تعذّر إضافة المحتوى"),
  });

  const remove = useMutation({
    mutationFn: async (item: Tables<"lesson_content">) => {
      const { error } = await supabase.from("lesson_content").delete().eq("id", item.id);
      if (error) throw error;
      if (item.file_path) await supabase.storage.from("lesson-files").remove([item.file_path]);
    },
    onSuccess: () => {
      toast.success("تم حذف العنصر");
      queryClient.invalidateQueries({ queryKey: ["lesson-content", lessonId] });
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
          <h1 className="text-2xl font-bold">محتوى الحصص</h1>
          <p className="text-sm text-muted-foreground">فيديوهات وصور وملفات وروابط وشروح لكل حصة.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!lessonId}>
              <Plus className="size-4" /> إضافة محتوى
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة محتوى للحصة</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>نوع المحتوى</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(contentTypeLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-title">العنوان</Label>
                <Input id="ct-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              {(type === "video" || type === "link") && (
                <div className="space-y-2">
                  <Label htmlFor="ct-url">{type === "video" ? "رابط يوتيوب" : "الرابط"}</Label>
                  <Input
                    id="ct-url"
                    dir="ltr"
                    required
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              )}
              {type === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="ct-body">الشرح</Label>
                  <Textarea id="ct-body" rows={4} required value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
              )}
              {(type === "image" || type === "file") && (
                <div className="space-y-2">
                  <Label htmlFor="ct-file">{type === "image" ? "الصورة" : "الملف"}</Label>
                  <Input
                    id="ct-file"
                    type="file"
                    required
                    accept={type === "image" ? "image/*" : undefined}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                حفظ
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface-card grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>الصف</Label>
          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v);
              setLessonId("");
            }}
          >
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
          <Label>الحصة</Label>
          <Select value={lessonId} onValueChange={setLessonId} disabled={!classId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الحصة" />
            </SelectTrigger>
            <SelectContent>
              {(lessons ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {lessonId &&
        (isPending ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : items?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => {
              const Icon = typeIcons[item.type] ?? FileText;
              const size = formatBytes(item.file_size);
              const embed = item.type === "video" && item.url ? youtubeEmbedUrl(item.url) : null;
              return (
                <div key={item.id} className="surface-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {contentTypeLabels[item.type]}
                          {size ? ` · ${size}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="حذف"
                      className="text-destructive"
                      onClick={() => remove.mutate(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {embed && (
                    <div className="mt-3 aspect-video overflow-hidden rounded-lg">
                      <iframe src={embed} title={item.title} className="size-full" allowFullScreen />
                    </div>
                  )}
                  {item.type === "image" && signed[item.id] && (
                    <img src={signed[item.id]} alt={item.title} className="mt-3 rounded-lg" />
                  )}
                  {item.type === "text" && item.body && (
                    <p className="mt-3 whitespace-pre-wrap text-sm">{item.body}</p>
                  )}
                  {(item.type === "file" || item.type === "link") && (
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <a
                        href={item.type === "link" ? (item.url ?? "#") : (signed[item.id] ?? "#")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-4" /> {item.type === "link" ? "فتح الرابط" : "فتح الملف"}
                      </a>
                    </Button>
                  )}
                  {item.type === "video" && !embed && item.url && (
                    <Badge variant="secondary" className="mt-3">
                      رابط خارجي
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">
            لا يوجد محتوى لهذه الحصة بعد. أضف أول عنصر.
          </div>
        ))}
    </div>
  );
}
