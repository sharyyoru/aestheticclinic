// Shared list of bookable doctors, keyed by the booking page "slug".
// Keep these slugs in sync with DOCTOR_AVAILABILITY in the booking pages
// (src/app/book-appointment/doctors/[slug]/page.tsx and src/app/embed/book/page.tsx).
export const BOOKING_DOCTORS: { slug: string; name: string }[] = [
  { slug: "xavier-tenorio", name: "Dr. Xavier Tenorio" },
  { slug: "cesar-rodriguez", name: "Dr. Cesar Rodriguez" },
  { slug: "yulia-raspertova", name: "Dr. Yulia Raspertova" },
  { slug: "clinic", name: "Laser & Treatments" },
  { slug: "lily-radionova", name: "Nurse Lily Radionova" },
];

// Weekday numbers follow JS Date.getDay() / getSwissDayOfWeek(): 0 = Sunday.
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export type DoctorDaysOff = {
  slug: string;
  days_off: number[];
  updated_at?: string;
};
