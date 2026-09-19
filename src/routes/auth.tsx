import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — نظام المدرس والطلاب" },
      { name: "description", content: "سجّل الدخول أو أنشئ حسابًا كمدرس أو طالب أو مدير سنتر." },
      { property: "og:title", content: "تسجيل الدخول — نظام المدرس والطلاب" },
      { property: "og:description", content: "الدخول إلى لوحة المدرس أو لوحة الطالب." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("teacher");
  const [sentConfirm, setSentConfirm] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/app", replace: true });
  }, [session, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("تعذّر تسجيل الدخول: تأكد من البريد وكلمة المرور");
      return;
    }
    toast.success("أهلًا بك من جديد");
    navigate({ to: "/app", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone, role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already") ? "هذا البريد مسجّل بالفعل" : "تعذّر إنشاء الحساب");
      return;
    }
    if (!data.session) {
      setSentConfirm(true);
      toast.success("أرسلنا رسالة تأكيد إلى بريدك");
      return;
    }
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">نظام المدرس والطلاب</span>
        </Link>

        <div className="surface-card p-6">
          {sentConfirm ? (
            <div className="space-y-3 text-center">
              <h1 className="text-xl font-bold">تحقق من بريدك الإلكتروني</h1>
              <p className="text-sm text-muted-foreground">
                أرسلنا رابط تأكيد إلى <span className="font-medium">{email}</span>. بعد الضغط عليه يمكنك
                تسجيل الدخول.
              </p>
              <Button variant="outline" onClick={() => setSentConfirm(false)}>
                رجوع
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-4 pt-4" onSubmit={handleSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "جارٍ الدخول..." : "دخول"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4 pt-4" onSubmit={handleSignUp}>
                  <div className="space-y-2">
                    <Label htmlFor="name">الاسم الكامل</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">البريد الإلكتروني</Label>
                    <Input
                      id="su-email"
                      type="email"
                      required
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-phone">رقم الهاتف</Label>
                    <Input id="su-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pass">كلمة المرور</Label>
                    <Input
                      id="su-pass"
                      type="password"
                      required
                      minLength={6}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نوع الحساب</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(v) => setRole(v as AppRole)}
                      className="grid grid-cols-1 gap-2"
                    >
                      {(
                        [
                          ["teacher", "مدرس"],
                          ["student", "طالب"],
                          ["center_manager", "مدير سنتر"],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted"
                        >
                          <RadioGroupItem value={value} id={`role-${value}`} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
