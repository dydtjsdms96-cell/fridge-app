export const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const MEAL_SLOTS = ["아침", "점심", "저녁"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Local YYYY-MM-DD (not UTC). */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday 00:00 of the week containing `base`. */
export function startOfWeekMonday(base = new Date()): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekDayDates(base = new Date()): { day: WeekDay; date: string }[] {
  const monday = startOfWeekMonday(base);
  return WEEK_DAYS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { day, date: toDateString(d) };
  });
}

export function todayWeekDay(base = new Date()): WeekDay {
  const js = base.getDay();
  return WEEK_DAYS[js === 0 ? 6 : js - 1];
}
