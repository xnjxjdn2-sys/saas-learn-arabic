import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyTeacher } from "@/lib/auth";
import { arabicMonths } from "@/lib/content-utils";

export const Route = createFileRoute("/_authenticated/teacher/payments")({
  head: () => ({
    meta: [
      { title: "المدفوعات — لوحة المدرس" },
      { name: "description", content: "تابع حالة الدفع الشهري لكل طالب." },
      { property: "og:title", content: "المدفوعات — لوحة المدرس" },
      { property: "og:description", content: "سجل المدفوعات الشهرية للطلاب." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { data: teacher } = useMyTeacher();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const { data, isPending } = useQuery({
    queryKey: ["payments", teacher?.id, year, month],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("students")
        .select("id, full_name, grade_level")
        .eq("teacher_id", teacher!.id)
        .order("full_name");
      if (error) throw error;
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("*")
        .eq("teacher_id", teacher!.id)
        .eq("year", Number(year))
        .eq("month", Number(month));
      if (payError) throw payError;
      const initial: Record<string, string> = {};
      for (const p of payments ?? []) initial[p.student_id] = String(p.amount);
      setAmounts((prev) => ({ ...initial, ...prev }));
      return { students: students ?? [], payments: payments ?? [] };
    },
  });

  const togglePaid = useMutation({
    mutationFn: async ({ studentId, paid }: { studentId: string; paid: boolean }) => {
      const { error } = await supabase.from("payments").upsert(
        {
          student_id: studentId,
          teacher_id: teacher!.id,
          year: Number(year),
          month: Number(month),
          amount: Number(amounts[studentId]) || 0,
          paid,
          paid_at: paid ? new Date().toISOString() : null,
        },
        { onConflict: "student_id,year,month" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الدفع");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: () => toast.error("تعذّر التحديث"),
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

  const years = Array.from({ length: 4 }, (_, i) => String(now.getFullYear() - 1 + i));
  const paymentOf = (id: string) => data?.payments.find((p) => p.student_id === id);
  const total = (data?.payments ?? []).filter((p) => p.paid).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المدفوعات الشهرية</h1>
        <p className="text-sm text-muted-foreground">اختر الشهر لعرض حالة الدفع لكل طالب.</p>
      </div>

      <div className="surface-card grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>السنة</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الشهر</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {arabicMonths.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : data?.students.length ? (
        <>
          <div className="surface-card divide-y divide-border">
            {data.students.map((s) => {
              const p = paymentOf(s.id);
              const paid = p?.paid ?? false;
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p?.paid_at
                        ? `دُفع في ${new Date(p.paid_at).toLocaleDateString("ar-EG")}`
                        : s.grade_level || ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      dir="ltr"
                      className="w-24"
                      placeholder="المبلغ"
                      value={amounts[s.id] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [s.id]: e.target.value }))}
                      onBlur={() => {
                        if (paid && Number(amounts[s.id]) !== Number(p?.amount)) {
                          togglePaid.mutate({ studentId: s.id, paid: true });
                        }
                      }}
                    />
                    <Badge
                      className={
                        paid
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }
                    >
                      {paid ? "مدفوع" : "غير مدفوع"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={paid ? "outline" : "default"}
                      onClick={() => togglePaid.mutate({ studentId: s.id, paid: !paid })}
                      disabled={togglePaid.isPending}
                    >
                      {paid ? "إلغاء الدفع" : "تسجيل الدفع"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="surface-card flex items-center gap-3 p-5">
            <Wallet className="size-5 text-primary" />
            <p className="font-bold">
              إجمالي مدفوعات {arabicMonths[Number(month) - 1]}: {total.toLocaleString("ar-EG")} ج.م
            </p>
          </div>
        </>
      ) : (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          لا يوجد طلاب بعد. أضف طلابًا من صفحة الطلاب أولًا.
        </div>
      )}
    </div>
  );
}
