"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface MobileDateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDateToYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYMD(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDisplayDate(dateStr: string): string {
  const date = parseYMD(dateStr);
  if (!date) return "";
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function MobileDateInput({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  disabled = false,
  className = "",
}: MobileDateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const parsed = parseYMD(value);
    return parsed || new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseYMD(value);
      if (parsed) setViewDate(parsed);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Generate calendar days
  const calendarDays = useCallback(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Previous month days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i, 12);
      days.push({ date, dateStr: formatDateToYMD(date), isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentYear, currentMonth, day, 12);
      days.push({ date, dateStr: formatDateToYMD(date), isCurrentMonth: true });
    }

    // Next month days to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(currentYear, currentMonth + 1, i, 12);
      days.push({ date, dateStr: formatDateToYMD(date), isCurrentMonth: false });
    }

    return days;
  }, [currentMonth, currentYear]);

  const isDateDisabled = useCallback((dateStr: string): boolean => {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  }, [min, max]);

  const handleDateSelect = useCallback((dateStr: string) => {
    if (isDateDisabled(dateStr)) return;
    onChange(dateStr);
    setIsOpen(false);
  }, [onChange, isDateDisabled]);

  const goToPrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1, 12));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1, 12));
  };

  const today = formatDateToYMD(new Date());

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button styled like an input */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-left rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 touch-manipulation ${className}`}
        style={{ fontSize: '16px' }} /* Prevents iOS zoom */
      >
        {value ? formatDisplayDate(value) : <span className="text-slate-400">{placeholder}</span>}
      </button>

      {/* Dropdown calendar */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Month/Year header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 touch-manipulation"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {FULL_MONTHS[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 touch-manipulation"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-2 py-1 text-center text-[10px] font-medium text-slate-400 uppercase">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5 p-2">
            {calendarDays().map(({ date, dateStr, isCurrentMonth }, idx) => {
              const isSelected = dateStr === value;
              const isToday = dateStr === today;
              const disabled = !isCurrentMonth || isDateDisabled(dateStr);

              return (
                <button
                  key={`${dateStr}-${idx}`}
                  type="button"
                  onClick={() => handleDateSelect(dateStr)}
                  disabled={disabled}
                  className={`
                    aspect-square flex items-center justify-center text-xs font-medium rounded-lg touch-manipulation
                    transition-colors duration-100
                    ${!isCurrentMonth ? "text-slate-300" : "text-slate-700"}
                    ${disabled && isCurrentMonth ? "text-slate-300 cursor-not-allowed" : ""}
                    ${!disabled && isCurrentMonth ? "hover:bg-slate-100 active:bg-slate-200" : ""}
                    ${isSelected ? "!bg-sky-600 !text-white" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-inset ring-sky-400" : ""}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 px-2 pb-2">
            <button
              type="button"
              onClick={() => handleDateSelect(today)}
              disabled={isDateDisabled(today)}
              className="flex-1 py-1.5 text-[11px] font-medium text-sky-600 hover:bg-sky-50 active:bg-sky-100 rounded-lg touch-manipulation disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="flex-1 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded-lg touch-manipulation"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
