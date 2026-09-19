import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AppRole = "teacher" | "student" | "center_manager";

export const roleLabels: Record<AppRole, string> = {
  teacher: "مدرس",
  student: "طالب",
  center_manager: "مدير سنتر",
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: 30_000,
  });
}

export function useMyRole() {
  const { data: session, isPending: sessionPending } = useSession();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: ["my-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.role ?? null) as AppRole | null;
    },
  });
  return { ...query, isPending: sessionPending || query.isPending };
}

export function useMyTeacher() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["my-teacher", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Tables<"teachers"> | null;
    },
  });
}

export function useMyProfile() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Tables<"profiles"> | null;
    },
  });
}
