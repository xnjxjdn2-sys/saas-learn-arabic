import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMyRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "لوحتي — نظام المدرس والطلاب" },
      { name: "description", content: "توجيه تلقائي إلى لوحة المدرس أو لوحة الطالب." },
      { property: "og:title", content: "لوحتي — نظام المدرس والطلاب" },
      { property: "og:description", content: "توجيه تلقائي حسب نوع الحساب." },
    ],
  }),
  component: RoleRouter,
});

function RoleRouter() {
  const { data: role, isPending } = useMyRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) return;
    if (role === "student") navigate({ to: "/student", replace: true });
    else navigate({ to: "/teacher", replace: true });
  }, [role, isPending, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      جارٍ تحضير لوحتك...
    </div>
  );
}
