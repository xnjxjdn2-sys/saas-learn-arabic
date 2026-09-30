import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Users,
  UserCog,
  LogOut,
  Menu,
  GraduationCap,
  ClipboardList,
  Wallet,
  FileText,
  Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useMyProfile, useMyTeacher, useMyRole, roleLabels } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: () => (
    <RoleGuard role="teacher">
      <TeacherLayout />
    </RoleGuard>
  ),
});

const navItems = [
  { to: "/teacher", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { to: "/teacher/students", label: "الطلاب", icon: Users, exact: false },
  { to: "/teacher/classes", label: "الصفوف", icon: BookOpen, exact: false },
  { to: "/teacher/lessons", label: "الحصص", icon: CalendarDays, exact: false },
  { to: "/teacher/content", label: "المحتوى", icon: FileText, exact: false },
  { to: "/teacher/attendance", label: "الحضور", icon: ClipboardList, exact: false },
  { to: "/teacher/payments", label: "المدفوعات", icon: Wallet, exact: false },
  { to: "/teacher/board", label: "لوحة الصف", icon: Megaphone, exact: false },
  { to: "/teacher/profile", label: "ملفي", icon: UserCog, exact: false },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold data-[status=active]:text-sidebar-accent-foreground"
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function TeacherLayout() {
  const { data: profile } = useMyProfile();
  const { data: teacher } = useMyTeacher();
  const { data: role } = useMyRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebarBody = (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="size-5" />
        </span>
        <span className="font-display text-base font-bold">نظام المدرس والطلاب</span>
      </div>
      <NavLinks onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-3 pt-6">
        <div className="rounded-lg bg-sidebar-accent/60 p-3 text-xs">
          <p className="font-semibold">{teacher?.full_name || profile?.full_name || "مستخدم"}</p>
          <p className="opacity-75">{role ? roleLabels[role] : ""}</p>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 right-0 hidden w-64 border-l border-sidebar-border md:block">
        {sidebarBody}
      </aside>

      <div className="md:mr-64">
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <SheetTitle className="sr-only">القائمة</SheetTitle>
              {sidebarBody}
            </SheetContent>
          </Sheet>
          <span className="font-display font-bold">لوحة المدرس</span>
        </header>

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
