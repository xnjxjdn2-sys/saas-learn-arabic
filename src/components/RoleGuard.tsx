import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMyRole, type AppRole } from "@/lib/auth";

/** UX-only redirect; real protection is enforced by database RLS. */
export function RoleGuard({ role, children }: { role: AppRole; children: ReactNode }) {
  const { data, isPending } = useMyRole();
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        جارٍ التحميل...
      </div>
    );
  }
  if (data !== role) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
