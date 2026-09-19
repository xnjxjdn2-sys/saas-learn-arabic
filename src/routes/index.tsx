import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Users, ShieldCheck, CalendarDays, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نظام المدرس والطلاب — منصة إدارة الدروس والصفوف" },
      {
        name: "description",
        content:
          "منصة عربية لإدارة الصفوف والحصص والطلاب للمدرس المستقل والسناتر التعليمية، مع لوحة مدرس ولوحة طالب.",
      },
      { property: "og:title", content: "نظام المدرس والطلاب" },
      {
        property: "og:description",
        content: "أدِر صفوفك وحصصك وطلابك في مكان واحد، بواجهة عربية بسيطة وآمنة.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: BookOpen, title: "الصفوف الدراسية", desc: "أنشئ صفوفك وحدد المرحلة والسعر والمواعيد." },
  { icon: CalendarDays, title: "الحصص", desc: "جدول الحصص المرتبطة بكل صف وتابع حالتها." },
  { icon: Users, title: "الطلاب", desc: "سجل طلابك واربطهم بالصفوف المناسبة." },
  { icon: Building2, title: "المدرس والسنتر", desc: "يدعم المدرس المستقل والمدرس التابع لسنتر." },
  { icon: ShieldCheck, title: "حماية البيانات", desc: "كل مدرس يرى بياناته فقط، والطالب يرى بياناته فقط." },
  { icon: GraduationCap, title: "لوحة الطالب", desc: "الطالب يتابع صفوفه وحصصه القادمة بسهولة." },
];

function Landing() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-display text-lg font-bold">نظام المدرس والطلاب</span>
          </div>
          {session ? (
            <Button asChild>
              <Link to="/app">لوحتي</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          )}
        </div>
      </header>

      <section className="hero-gradient text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
            إدارة دروسك الخصوصية بترتيب واحترافية
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base opacity-90 sm:text-lg">
            صفوف، حصص، وطلاب في منصة عربية واحدة — للمدرس المستقل ولسناتر التعليم.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">ابدأ الآن مجانًا</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">ما الذي تقدمه المنصة؟</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="surface-card p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        نظام المدرس والطلاب — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
