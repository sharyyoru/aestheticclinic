import { strict as assert } from "node:assert";
import { normalizeDoctorName, resolveCalendarOwner, fetchAllCalendarPages } from "../lib/appointmentCalendar";

async function main() {
  const owner = { id: "ekaterina-id", full_name: "Ekaterina Iosipoi" };
  assert.equal(normalizeDoctorName("Ekaterina"), normalizeDoctorName(owner.full_name));
  assert.equal(resolveCalendarOwner([owner], "Dr. Ekaterina"), owner);
  assert.equal(resolveCalendarOwner([owner], "Ekaterina Someone Else"), null);
  assert.equal(resolveCalendarOwner([owner, { ...owner, id: "duplicate" }], "Ekaterina"), null);
  assert.equal(resolveCalendarOwner([{ ...owner, full_name: "Ekaterina Iosipoi (Deactivated User)" }], "Ekaterina"), null);
  assert.equal(normalizeDoctorName("Dr. Cesar Rodriguez"), normalizeDoctorName("Cezar Rodrigues"));

  // A busy month with a server cap LOWER than the requested page size.
  const month = Array.from({ length: 1443 }, (_, id) => ({ id }));
  const rows = await fetchAllCalendarPages(async (from, to) => ({
    data: month.slice(from, Math.min(to + 1, from + 200)), error: null,
  }));
  assert.deepEqual(rows, month);
  assert.deepEqual(await fetchAllCalendarPages(async () => ({ data: [], error: null })), []);
  await assert.rejects(fetchAllCalendarPages(async (from) => from === 0
    ? { data: [{ id: 1 }], error: null }
    : { data: null, error: { message: "Page failed" } }), /Page failed/);
  console.log("Appointment calendar regression tests passed");
}
void main();
