import { supabaseAdmin } from "@/lib/supabaseAdmin";
import NewUserForm from "./NewUserForm";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  email: string | null;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  createdAt: string | null;
};

async function getUsers(): Promise<UserRow[]> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });

  if (error || !data?.users) {
    return [];
  }

  return data.users.map((user) => {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;

    return {
      id: user.id,
      email: user.email ?? null,
      role: (meta["role"] as string) ?? null,
      firstName: (meta["first_name"] as string) ?? null,
      lastName: (meta["last_name"] as string) ?? null,
      designation: (meta["designation"] as string) ?? null,
      createdAt: (user as any).created_at ?? null,
    };
  });
}

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">
          Invite, manage, and configure roles for team members using the CRM.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <NewUserForm />
        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-slate-800">Team</h2>
              <p className="text-xs text-slate-500">
                Users created via this panel and in Supabase Auth.
              </p>
            </div>
          </div>
          {users.length === 0 ? (
            <p className="text-slate-500">
              No users yet. Create your first team member using the form on the
              left.
            </p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => {
                    const fullName = [user.firstName, user.lastName]
                      .filter(Boolean)
                      .join(" ");

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
                          <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700">
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
