"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthContext";
import { useDealNotifications } from "@/components/DealNotificationsContext";

type DealNotification = {
  id: string;
  created_at: string;
  read_at: string | null;
  deal_id: string;
  patient_id: string;
  notification_type: 'stage_changed' | 'deal_created' | 'deal_assigned' | 'deal_updated';
  old_stage_name: string | null;
  new_stage_name: string | null;
  changed_by_name: string | null;
  patient: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  deal: {
    id: string;
    title: string | null;
  } | null;
};

type FilterType = 'all' | 'unread' | 'read';

export default function DealNotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshNotifications } = useDealNotifications();
  const [notifications, setNotifications] = useState<DealNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (!user) return;
    void loadNotifications();
  }, [user, filter]);

  async function loadNotifications() {
    if (!user) return;

    try {
      setLoading(true);

      let query = supabaseClient
        .from("deal_notifications")
        .select(
          "id, created_at, read_at, deal_id, patient_id, notification_type, old_stage_name, new_stage_name, changed_by_name",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filter === 'unread') {
        query = query.is("read_at", null);
      } else if (filter === 'read') {
        query = query.not("read_at", "is", null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching deal notifications:", error);
        setNotifications([]);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const dealIds = [...new Set(data.map(n => n.deal_id).filter(Boolean))];
      const patientIds = [...new Set(data.map(n => n.patient_id).filter(Boolean))];

      let dealsMap: Record<string, { id: string; title: string | null }> = {};
      if (dealIds.length > 0) {
        const { data: deals } = await supabaseClient
          .from("deals")
          .select("id, title")
          .in("id", dealIds);
        if (deals) {
          dealsMap = Object.fromEntries(deals.map(d => [d.id, d]));
        }
      }

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

      const typedData: DealNotification[] = data.map(n => ({
        id: n.id,
        created_at: n.created_at,
        read_at: n.read_at,
        deal_id: n.deal_id,
        patient_id: n.patient_id,
        notification_type: n.notification_type,
        old_stage_name: n.old_stage_name,
        new_stage_name: n.new_stage_name,
        changed_by_name: n.changed_by_name,
        patient: n.patient_id ? patientsMap[n.patient_id] || null : null,
        deal: n.deal_id ? dealsMap[n.deal_id] || null : null,
      }));

      setNotifications(typedData);
      setLoading(false);
    } catch (err) {
      console.error("Error in loadNotifications:", err);
      setNotifications([]);
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const nowIso = new Date().toISOString();
      await supabaseClient
        .from("deal_notifications")
        .update({ read_at: nowIso })
        .eq("id", id);

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: nowIso } : n)
      );
      void refreshNotifications();
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  }

  async function markAllAsRead() {
    if (!user) return;

    try {
      const nowIso = new Date().toISOString();
      await supabaseClient
        .from("deal_notifications")
        .update({ read_at: nowIso })
        .eq("user_id", user.id)
        .is("read_at", null);

      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || nowIso }))
      );
      void refreshNotifications();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  }

  function formatDateTime(dateString: string | null): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function getPatientName(patient: { first_name: string | null; last_name: string | null } | null): string {
    if (!patient) return "Unknown";
    return `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown";
  }

  function getNotificationText(notification: DealNotification): string {
    switch (notification.notification_type) {
      case 'stage_changed':
        return `Organize payment for ${notification.new_stage_name || 'Unknown'}`;
      case 'deal_created':
        return 'New deal created';
      case 'deal_assigned':
        return 'Deal assigned to you';
      case 'deal_updated':
        return 'Deal updated';
      default:
        return 'Deal notification';
    }
  }

  function handleNotificationClick(notification: DealNotification) {
    if (!notification.read_at) {
      void markAsRead(notification.id);
    }
    router.push(`/patients/${notification.patient_id}?m_tab=crm&crm_sub=deals`);
  }

  const unreadNotifications = notifications.filter(n => !n.read_at);
  const readNotifications = notifications.filter(n => n.read_at);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Deal Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Updates on deal stage changes and assignments
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setFilter('read')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'read'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Read
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadNotifications()}
              className="text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              Refresh
            </button>
            {unreadNotifications.length > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No deal notifications
            </div>
          ) : (
            <>
              {filter !== 'read' && unreadNotifications.length > 0 && (
                <div>
                  <div className="bg-slate-50 px-6 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Unread
                    </h3>
                  </div>
                  {unreadNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-purple-50/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                {notification.notification_type === 'stage_changed' ? 'Stage Changed' : 
                                 notification.notification_type === 'deal_created' ? 'Deal Created' :
                                 notification.notification_type === 'deal_assigned' ? 'Deal Assigned' : 'Updated'}
                              </span>
                              <span className="text-xs font-medium text-slate-900">
                                Task: {getNotificationText(notification)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              {user?.email} @Staff Admin
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Patient: {getPatientName(notification.patient)}
                            </p>
                            {notification.changed_by_name && (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                by {notification.changed_by_name}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-[10px] text-slate-400">
                              {formatDateTime(notification.created_at)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void markAsRead(notification.id);
                              }}
                              className="text-[10px] font-medium text-purple-600 hover:text-purple-700"
                            >
                              Mark as read
                            </button>
                            <div className="h-2 w-2 rounded-full bg-purple-500" />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filter !== 'unread' && readNotifications.length > 0 && (
                <div>
                  <div className="bg-slate-50 px-6 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Read
                    </h3>
                  </div>
                  {readNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {notification.notification_type === 'stage_changed' ? 'Stage Changed' : 
                                 notification.notification_type === 'deal_created' ? 'Deal Created' :
                                 notification.notification_type === 'deal_assigned' ? 'Deal Assigned' : 'Updated'}
                              </span>
                              <span className="text-xs text-slate-700">
                                Task: {getNotificationText(notification)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {user?.email} @Staff Admin
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Patient: {getPatientName(notification.patient)}
                            </p>
                            {notification.changed_by_name && (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                by {notification.changed_by_name}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(notification.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
