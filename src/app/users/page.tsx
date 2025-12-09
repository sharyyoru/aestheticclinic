"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import NewUserForm from "./NewUserForm";

type UserRow = {
  id: string;
  email: string | null;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  createdAt: string | null;
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        // Check current user's role
        const { data: authData } = await supabaseClient.auth.getUser();
        if (!isMounted) return;

        const user = authData?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        setCurrentUserId(user.id);
        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const role = ((meta["role"] as string) || "").toLowerCase();
        setIsAdmin(role === "admin");

        // Fetch users list via API
        const response = await fetch("/api/users/list");
        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }

        setLoading(false);
      } catch {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleMakeAdmin(userId: string) {
    if (!isAdmin || updatingUserId) return;

    try {
      setUpdatingUserId(userId);

      const response = await fetch("/api/users/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: "admin" }),
      });

      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: "admin" } : u))
        );
      }
    } catch {
      // Ignore errors
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleRemoveAdmin(userId: string) {
    if (!isAdmin || updatingUserId) return;

    try {
      setUpdatingUserId(userId);

      const response = await fetch("/api/users/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: "staff" }),
      });

      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: "staff" } : u))
        );
      }
    } catch {
      // Ignore errors
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "Invite, manage, and configure roles for team members using the CRM."
            : "View team members using the CRM."}
        </p>
      </div>

      {isAdmin ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <NewUserForm />
          <UserTable
            users={users}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            updatingUserId={updatingUserId}
            onMakeAdmin={handleMakeAdmin}
            onRemoveAdmin={handleRemoveAdmin}
          />
        </div>
      ) : (
        <UserTable
          users={users}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          updatingUserId={updatingUserId}
          onMakeAdmin={handleMakeAdmin}
          onRemoveAdmin={handleRemoveAdmin}
        />
      )}
    </div>
  );
}

function UserTable({
  users,
  isAdmin,
  currentUserId,
  updatingUserId,
  onMakeAdmin,
  onRemoveAdmin,
}: {
  users: UserRow[];
  isAdmin: boolean;
  currentUserId: string | null;
  updatingUserId: string | null;
  onMakeAdmin: (userId: string) => void;
  onRemoveAdmin: (userId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-slate-800">Team</h2>
          <p className="text-xs text-slate-500">
            {users.length} team member{users.length !== 1 ? "s" : ""} in the system.
          </p>
        </div>
      </div>
      {users.length === 0 ? (
        <p className="text-slate-500">No users found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="border-b text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Designation</th>
                <th className="py-2 pr-4 font-medium">Created</th>
                {isAdmin && <th className="py-2 pr-4 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const fullName = [user.firstName, user.lastName]
                  .filter(Boolean)
                  .join(" ");
                const userRole = (user.role || "staff").toLowerCase();
                const isUserAdmin = userRole === "admin";
                const isSelf = user.id === currentUserId;
                const isUpdating = updatingUserId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-900">
                        {fullName || "—"}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {user.email || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          isUserAdmin
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        {user.role || "staff"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {user.designation || "—"}
                    </td>
                    <td className="py-2 pr-4 text-[11px] text-slate-500">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    {isAdmin && (
                      <td className="py-2 pr-4">
                        {!isSelf && (
                          <>
                            {isUserAdmin ? (
                              <button
                                type="button"
                                onClick={() => onRemoveAdmin(user.id)}
                                disabled={isUpdating}
                                className="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                              >
                                {isUpdating ? "..." : "Remove Admin"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onMakeAdmin(user.id)}
                                disabled={isUpdating}
                                className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 shadow-sm hover:bg-amber-100 disabled:opacity-50"
                              >
                                {isUpdating ? "..." : "Make Admin"}
                              </button>
                            )}
                          </>
                        )}
                        {isSelf && (
                          <span className="text-[10px] text-slate-400">You</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
