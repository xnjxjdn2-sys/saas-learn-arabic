import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "لوحتي — نظام المدرس والطلاب" },
      { name: "description", content: "توجيه تلقائي إلى لوحة المدرس أو الطالب أو مدير السنتر." },
      { property: "og:title", content: "لوحتي — نظام المدرس والطلاب" },
      { property: "og:description", content: "توجيه تلقائي حسب نوع الحساب." },
    ],
  }),
  component: RoleRouter,
});

function RoleRouter() {
  const { data: role, isPending, isError } = useMyRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) return;
    if (role === "student") navigate({ to: "/student", replace: true });
    else if (role === "center_manager") navigate({ to: "/center", replace: true });
    else if (role === "teacher") navigate({ to: "/teacher", replace: true });
  }, [role, isPending, navigate]);

  if (!isPending && (isError || !role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ManagerCodeForm />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      جارٍ تحضير لوحتك...
    </div>
  );
}

function ManagerCodeForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("claim_center_manager", { _code: code });
    setBusy(false);
    if (error) {
      toast.error("كود التفعيل غير صحيح أو مستخدم من قبل");
      return;
    }
    toast.success("تم تفعيل حساب مدير السنتر");
    queryClient.invalidateQueries({ queryKey: ["my-role"] });
  }
  return (
    <form onSubmit={submit} className="surface-card w-full max-w-sm space-y-3 p-6 text-center">
      <h1 className="text-lg font-bold">تفعيل حساب مدير السنتر</h1>
      <p className="text-sm text-muted-foreground">أدخل كود التفعيل الذي حصلت عليه من إدارة المنصة.</p>
      <Input dir="ltr" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CM-XXXXXXXX" />
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "جارٍ التفعيل..." : "تفعيل"}</Button>
    </form>
  );
}
