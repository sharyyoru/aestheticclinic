export function normalizeDoctorName(name: string | null | undefined): string {
  const normalized = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(mme|mr|mrs|ms|dr|prof)\.?\s+/i, "")
    .replace(/z/g, "s")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
  // Explicit booking alias; never match arbitrary first names.
  return normalized === "ekaterina" ? "ekaterina iosipoi" : normalized;
}

/** Resolve only unique calendar owners; billing providers are a separate table. */
export function resolveCalendarOwner<T extends { id: string; full_name: string | null }>(
  users: T[], name: string,
): T | null {
  const key = normalizeDoctorName(name);
  const matches = users.filter(user => user.full_name &&
    !user.full_name.toLowerCase().includes("deactivated") &&
    normalizeDoctorName(user.full_name) === key);
  return matches.length === 1 ? matches[0] : null;
}

/** Continue until empty, even when the server caps pages below the requested size. */
export async function fetchAllCalendarPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await fetchPage(rows.length, rows.length + 499);
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to load appointments.");
    if (data.length === 0) return rows;
    rows.push(...data);
  }
}
