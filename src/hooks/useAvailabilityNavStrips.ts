import { useEffect, useMemo, useRef } from "react";
import { addDays, addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export function useAvailabilityNavStrips(date: Date | undefined, currentMonth: Date) {
  const monthNavScrollRef = useRef<HTMLDivElement>(null);
  const dateNavScrollRef = useRef<HTMLDivElement>(null);
  const monthNavHasAutoScrolled = useRef(false);
  const dateNavHasAutoScrolled = useRef(false);
  const lastMonthNavScrollKey = useRef<string | null>(null);
  const lastDateNavScrollKey = useRef<string | null>(null);

  const months = useMemo(() => {
    const monthsList: Date[] = [];
    const start = subMonths(currentMonth, 3);
    const end = addMonths(currentMonth, 12);
    let cursor = start;
    while (cursor <= end) {
      monthsList.push(cursor);
      cursor = addMonths(cursor, 1);
    }
    return monthsList;
  }, [currentMonth]);

  const monthDates = useMemo(() => {
    const datesList: Date[] = [];
    const startMonth = subMonths(currentMonth, 3);
    const endMonth = addMonths(currentMonth, 3);
    let current = startOfMonth(startMonth);
    const end = endOfMonth(endMonth);
    while (current <= end) {
      datesList.push(current);
      current = addDays(current, 1);
    }
    return datesList;
  }, [currentMonth]);

  useEffect(() => {
    if (!date || !monthNavScrollRef.current) return;
    const selectedMonth = format(date, "yyyy-MM");
    const scrollKey = `${format(currentMonth, "yyyy-MM")}:${selectedMonth}`;
    if (lastMonthNavScrollKey.current === scrollKey) return;
    lastMonthNavScrollKey.current = scrollKey;
    const container = monthNavScrollRef.current;
    const target = container.querySelector(`[data-month="${selectedMonth}"]`) as HTMLElement | null;
    if (!target) return;
    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const desiredLeft = targetCenter - container.clientWidth / 2;
    const maxLeft = container.scrollWidth - container.clientWidth;
    const clampedLeft = Math.max(0, Math.min(maxLeft, desiredLeft));
    if (!monthNavHasAutoScrolled.current) {
      const nudgeLeft = Math.max(0, Math.min(maxLeft, clampedLeft - 80));
      container.scrollLeft = nudgeLeft;
    }
    requestAnimationFrame(() => {
      container.scrollTo({ left: clampedLeft, behavior: "smooth" });
      monthNavHasAutoScrolled.current = true;
    });
  }, [date, currentMonth]);

  useEffect(() => {
    if (!date || !dateNavScrollRef.current) return;
    const selectedDate = format(date, "yyyy-MM-dd");
    const scrollKey = `${format(currentMonth, "yyyy-MM")}:${selectedDate}`;
    if (lastDateNavScrollKey.current === scrollKey) return;
    lastDateNavScrollKey.current = scrollKey;
    const container = dateNavScrollRef.current;
    const target = container.querySelector(`[data-date="${selectedDate}"]`) as HTMLElement | null;
    if (!target) return;
    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const desiredLeft = targetCenter - container.clientWidth / 2;
    const maxLeft = container.scrollWidth - container.clientWidth;
    const clampedLeft = Math.max(0, Math.min(maxLeft, desiredLeft));
    if (!dateNavHasAutoScrolled.current) {
      const nudgeLeft = Math.max(0, Math.min(maxLeft, clampedLeft - 80));
      container.scrollLeft = nudgeLeft;
    }
    requestAnimationFrame(() => {
      container.scrollTo({ left: clampedLeft, behavior: "smooth" });
      dateNavHasAutoScrolled.current = true;
    });
  }, [date, currentMonth]);

  return { months, monthDates, monthNavScrollRef, dateNavScrollRef };
}
