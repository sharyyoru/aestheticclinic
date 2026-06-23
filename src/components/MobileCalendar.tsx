"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface MobileCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  availableDates?: Set<string>; // Set of YYYY-MM-DD strings that are available
  minDate?: Date;
  maxDate?: Date;
  blockedDates?: Set<string>;
  isLoading?: boolean;
  /** Renders a more compact calendar (shorter rows/chrome) so it fits in tight
   *  containers such as a fixed-height embed iframe. */
  compact?: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateToYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYMD(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone issues
}

export default function MobileCalendar({
  selectedDate,
  onDateSelect,
  availableDates,
  minDate,
  maxDate,
  blockedDates,
  isLoading = false,
  compact = false,
}: MobileCalendarProps) {
  // Current view month/year
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      return parseYMD(selectedDate);
    }
    return new Date();
  });

  // Update view when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      const selected = parseYMD(selectedDate);
      setViewDate(selected);
    }
  }, [selectedDate]);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Add days from previous month to fill the first week
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i, 12);
      days.push({
        date,
        dateStr: formatDateToYMD(date),
        isCurrentMonth: false,
      });
    }

    // Add days of current month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentYear, currentMonth, day, 12);
      days.push({
        date,
        dateStr: formatDateToYMD(date),
        isCurrentMonth: true,
      });
    }

    // Add days from next month to complete the grid (6 rows)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentYear, currentMonth + 1, i, 12);
      days.push({
        date,
        dateStr: formatDateToYMD(date),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth, currentYear]);

  const goToPrevMonth = useCallback(() => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1, 12));
  }, [currentMonth, currentYear]);

  const goToNextMonth = useCallback(() => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1, 12));
  }, [currentMonth, currentYear]);

  const isDateDisabled = useCallback((dateStr: string, date: Date): boolean => {
    // Check if before minDate
    if (minDate && date < minDate) return true;
    // Check if after maxDate
    if (maxDate && date > maxDate) return true;
    // Check if blocked
    if (blockedDates?.has(dateStr)) return true;
    // Check if not in available dates (if specified)
    if (availableDates && availableDates.size > 0 && !availableDates.has(dateStr)) return true;
    return false;
  }, [minDate, maxDate, blockedDates, availableDates]);

  const isDateAvailable = useCallback((dateStr: string): boolean => {
    if (!availableDates || availableDates.size === 0) return true;
    return availableDates.has(dateStr);
  }, [availableDates]);

  const handleDateClick = useCallback((dateStr: string, date: Date) => {
    if (isDateDisabled(dateStr, date)) return;
    onDateSelect(dateStr);
  }, [isDateDisabled, onDateSelect]);

  // Check if we can navigate to prev/next month
  const canGoPrev = useMemo(() => {
    if (!minDate) return true;
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    return firstOfMonth > minDate;
  }, [currentYear, currentMonth, minDate]);

  const canGoNext = useMemo(() => {
    if (!maxDate) return true;
    const lastOfMonth = new Date(currentYear, currentMonth + 1, 0);
    return lastOfMonth < maxDate;
  }, [currentYear, currentMonth, maxDate]);

  const today = formatDateToYMD(new Date());

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden select-none">
      {/* Month/Year Header */}
      <div className={`flex items-center justify-between bg-slate-50 border-b border-slate-200 ${compact ? "px-3 py-1.5" : "px-4 py-3"}`}>
        <button
          type="button"
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          className={`flex items-center justify-center rounded-full hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation ${compact ? "w-8 h-8" : "w-10 h-10"}`}
          aria-label="Previous month"
        >
          <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <span className={`font-semibold text-slate-900 ${compact ? "text-sm" : "text-base"}`}>
            {MONTHS[currentMonth]} {currentYear}
          </span>
        </div>
        
        <button
          type="button"
          onClick={goToNextMonth}
          disabled={!canGoNext}
          className={`flex items-center justify-center rounded-full hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation ${compact ? "w-8 h-8" : "w-10 h-10"}`}
          aria-label="Next month"
        >
          <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={`text-center text-xs font-medium text-slate-500 uppercase ${compact ? "py-1" : "py-2"}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-100 p-px">
        {calendarDays.map(({ date, dateStr, isCurrentMonth }, index) => {
          const disabled = isDateDisabled(dateStr, date);
          const available = isDateAvailable(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;

          return (
            <button
              key={`${dateStr}-${index}`}
              type="button"
              onClick={() => handleDateClick(dateStr, date)}
              disabled={disabled || !isCurrentMonth}
              className={`
                relative ${compact ? "h-9" : "aspect-square"} flex flex-col items-center justify-center bg-white
                transition-all duration-150 touch-manipulation
                ${!isCurrentMonth ? "opacity-30 cursor-default" : ""}
                ${disabled && isCurrentMonth ? "opacity-40 cursor-not-allowed bg-slate-50" : ""}
                ${!disabled && isCurrentMonth && available ? "hover:bg-slate-100 active:bg-slate-200 cursor-pointer" : ""}
                ${isSelected ? "!bg-slate-900 text-white" : ""}
                ${isToday && !isSelected ? "ring-2 ring-inset ring-slate-300" : ""}
              `}
              aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              aria-selected={isSelected}
              aria-disabled={disabled}
            >
              <span className={`text-sm font-medium ${isSelected ? "text-white" : isCurrentMonth ? "text-slate-900" : "text-slate-400"}`}>
                {date.getDate()}
              </span>
              {/* Available indicator dot */}
              {available && isCurrentMonth && !disabled && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className={`flex items-center justify-center gap-4 bg-slate-50 border-t border-slate-100 text-xs ${compact ? "px-3 py-1.5" : "px-4 py-3"}`}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-slate-900" />
          <span className="text-slate-600">Selected</span>
        </div>
      </div>
    </div>
  );
}
