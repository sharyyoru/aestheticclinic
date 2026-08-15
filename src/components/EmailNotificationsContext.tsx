"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

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

export type CampaignNotification = {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  completed_at: string;
  notification_read_at: string | null;
};

type EmailNotificationsContextValue = {
  unreadCount: number | null;
  notifications: EmailNotification[];
  campaignNotifications: CampaignNotification[];
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markCampaignAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const EmailNotificationsContext = createContext<EmailNotificationsContextValue | undefined>(
  undefined,
);

export function EmailNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [campaignNotifications, setCampaignNotifications] = useState<CampaignNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setCampaignNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const [{ data, error }, { data: campaigns, error: campaignsError }] = await Promise.all([
        supabaseClient
          .from("email_reply_notifications")
          .select("id, created_at, read_at, patient_id, original_email_id, reply_email_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseClient
          .from("marketing_campaigns")
          .select("id, name, status, total_recipients, total_sent, total_failed, completed_at, notification_read_at")
          .eq("created_by", user.id)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(20),
      ]);

      if (error || campaignsError) {
        console.error("Error fetching email notifications:", error);
        setUnreadCount(0);
        setNotifications([]);
        setCampaignNotifications([]);
        setLoading(false);
        return;
      }

      const typedCampaigns = (campaigns ?? []) as CampaignNotification[];
      setCampaignNotifications(typedCampaigns);

      // Fetch related emails and patients separately for reliability
      const replyEmailIds = (data ?? []).map(n => n.reply_email_id).filter(Boolean);
      const patientIds = [...new Set((data ?? []).map(n => n.patient_id).filter(Boolean))];

      // Fetch reply emails
      let emailsMap: Record<string, { id: string; subject: string | null; body: string | null; from_address: string | null; sent_at: string | null; created_at: string | null }> = {};
      if (replyEmailIds.length > 0) {
        const { data: emails } = await supabaseClient
          .from("emails")
          .select("id, subject, body, from_address, sent_at, created_at")
          .in("id", replyEmailIds);
        if (emails) {
          emailsMap = Object.fromEntries(emails.map(e => [e.id, e]));
        }
      }

      // Fetch patients
      let patientsMap: Record<string, { id: string; first_name: string | null; last_name: string | null }> = {};
      if (patientIds.length > 0) {
        const { data: patients } = await supabaseClient
          .from("patients")
          .select("id, first_name, last_name")
          .in("id", patientIds);
        if (patients) {
          patientsMap = Object.fromEntries(patients.map(p => [p.id, p]));
        }
      }

      // Combine data
      const typedData: EmailNotification[] = (data ?? []).map(n => ({
        id: n.id,
        created_at: n.created_at,
        read_at: n.read_at,
        patient_id: n.patient_id,
        original_email_id: n.original_email_id,
        reply_email_id: n.reply_email_id,
        reply_email: n.reply_email_id ? emailsMap[n.reply_email_id] || null : null,
        patient: n.patient_id ? patientsMap[n.patient_id] || null : null,
      }));

      setNotifications(typedData);
      setUnreadCount(
        typedData.filter(n => !n.read_at).length +
        typedCampaigns.filter(n => !n.notification_read_at).length,
      );
      setLoading(false);
    } catch (err) {
      console.error("Error in refreshNotifications:", err);
      setUnreadCount(0);
      setNotifications([]);
      setCampaignNotifications([]);
      setLoading(false);
    }
  }, [user]);

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

  const markCampaignAsRead = async (id: string) => {
    const nowIso = new Date().toISOString();
    await supabaseClient
      .from("marketing_campaigns")
      .update({ notification_read_at: nowIso })
      .eq("id", id);
    setCampaignNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, notification_read_at: nowIso } : n),
    );
    setUnreadCount(prev => Math.max(0, (prev ?? 0) - 1));
  };

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const nowIso = new Date().toISOString();
      await supabaseClient
        .from("email_reply_notifications")
        .update({ read_at: nowIso })
        .eq("user_id", user.id)
        .is("read_at", null);
      await supabaseClient
        .from("marketing_campaigns")
        .update({ notification_read_at: nowIso })
        .eq("created_by", user.id)
        .not("completed_at", "is", null)
        .is("notification_read_at", null);

      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || nowIso }))
      );
      setCampaignNotifications(prev =>
        prev.map(n => ({ ...n, notification_read_at: n.notification_read_at || nowIso })),
      );
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  }, [user]);

  useVisibilityPolling(refreshNotifications, !authLoading);

  const value: EmailNotificationsContextValue = {
    unreadCount,
    notifications,
    campaignNotifications,
    loading,
    refreshNotifications,
    markAsRead,
    markCampaignAsRead,
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
