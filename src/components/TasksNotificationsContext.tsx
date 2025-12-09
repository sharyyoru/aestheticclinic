"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type TasksNotificationsContextValue = {
  openTasksCount: number | null;
  refreshOpenTasksCount: () => Promise<void>;
  setOpenTasksCountOptimistic: (updater: (prev: number) => number) => void;
};

const TasksNotificationsContext =
  createContext<TasksNotificationsContextValue | undefined>(undefined);

export function TasksNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [openTasksCount, setOpenTasksCount] = useState<number | null>(null);

  const refreshOpenTasksCount = async () => {
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setOpenTasksCount(0);
        return;
      }

      const { count, error } = await supabaseClient
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_user_id", user.id)
        .is("assigned_read_at", null);

      if (error) {
        setOpenTasksCount(0);
        return;
      }

      setOpenTasksCount(count ?? 0);
    } catch {
      setOpenTasksCount(0);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!isMounted) return;
      await refreshOpenTasksCount();
    }

    void load();

    const intervalId = window.setInterval(() => {
      if (!isMounted) return;
      void refreshOpenTasksCount();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const setOpenTasksCountOptimistic = (updater: (prev: number) => number) => {
    setOpenTasksCount((prev) => {
      const base = prev ?? 0;
      const next = updater(base);
      return next < 0 ? 0 : next;
    });
  };

  const value: TasksNotificationsContextValue = {
    openTasksCount,
    refreshOpenTasksCount,
    setOpenTasksCountOptimistic,
  };

  return (
    <TasksNotificationsContext.Provider value={value}>
      {children}
    </TasksNotificationsContext.Provider>
  );
}

export function useTasksNotifications(): TasksNotificationsContextValue {
  const ctx = useContext(TasksNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useTasksNotifications must be used within TasksNotificationsProvider",
    );
  }
  return ctx;
}
