"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type EmailNotification = {
  id: string;
  created_at: string;
  read_at: string | null;
  patient_id: string;
  original_email_id: string;
  reply_email_id: string;
  reply_email: {
    id: string;
    subject: string | null;
    body: string | null;
    from_address: string | null;
    sent_at: string | null;
    created_at: string | null;
  } | null;
  patient: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type EmailNotificationsContextValue = {
  unreadCount: number | null;
  notifications: EmailNotification[];
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const EmailNotificationsContext = createContext<EmailNotificationsContextValue | undefined>(
  undefined,
);

export function EmailNotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshNotifications = async () => {
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setUnreadCount(0);
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Fetch email reply notifications
      const { data, error } = await supabaseClient
        .from("email_reply_notifications")
        .select(
          "id, created_at, read_at, patient_id, original_email_id, reply_email_id, reply_email:emails!reply_email_id(id, subject, body, from_address, sent_at, created_at), patient:patients(id, first_name, last_name)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        setUnreadCount(0);
        setNotifications([]);
        setLoading(false);
        return;
      }

      const typedData = (data || []) as unknown as EmailNotification[];
      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.read_at).length);
      setLoading(false);
    } catch {
      setUnreadCount(0);
      setNotifications([]);
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const nowIso = new Date().toISOString();
      await supabaseClient
        .from("email_reply_notifications")
        .update({ read_at: nowIso })
        .eq("id", id);

      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read_at: nowIso } : n)
      );
      setUnreadCount(prev => Math.max(0, (prev ?? 0) - 1));
    } catch {
      // Silent fail
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const nowIso = new Date().toISOString();
      await supabaseClient
        .from("email_reply_notifications")
        .update({ read_at: nowIso })
        .eq("user_id", user.id)
        .is("read_at", null);

      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || nowIso }))
      );
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!isMounted) return;
      await refreshNotifications();
    }

    load();

    const intervalId = window.setInterval(() => {
      if (!isMounted) return;
      void refreshNotifications();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const value: EmailNotificationsContextValue = {
    unreadCount,
    notifications,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  };

  return (
    <EmailNotificationsContext.Provider value={value}>
      {children}
    </EmailNotificationsContext.Provider>
  );
}

export function useEmailNotifications(): EmailNotificationsContextValue {
  const ctx = useContext(EmailNotificationsContext);
  if (!ctx) {
    throw new Error("useEmailNotifications must be used within EmailNotificationsProvider");
  }
  return ctx;
}
