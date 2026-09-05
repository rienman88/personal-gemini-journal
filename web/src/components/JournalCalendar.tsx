/**
 * LOCAL — ships in the frontend bundle.
 *
 * A read-only navigation view derived from the entries already loaded by
 * JournalList. It deliberately has no Firestore listener or write path of
 * its own, so entry deletion and realtime updates stay authoritative.
 */
import { useState } from "react";

interface CalendarEntry {
  id: string;
  createdAt: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function initialMonth(entries: CalendarEntry[]): Date {
  const latest = entries.reduce<Date | null>((currentLatest, entry) => {
    const date = validDate(entry.createdAt);
    if (!date) return currentLatest;
    return !currentLatest || date > currentLatest ? date : currentLatest;
  }, null);

  const source = latest ?? new Date();
  return new Date(source.getFullYear(), source.getMonth(), 1);
}

function monthDays(viewDate: Date): Array<Date | null> {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const leadingBlankDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const usedCells = leadingBlankDays + daysInMonth;
  const trailingBlankDays = (7 - (usedCells % 7)) % 7;

  return Array.from({ length: usedCells + trailingBlankDays }, (_, index) => {
    const dayNumber = index - leadingBlankDays + 1;
    return dayNumber < 1 || dayNumber > daysInMonth
      ? null
      : new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNumber);
  });
}

export default function JournalCalendar({
  entries,
  onSelectEntry,
}: {
  entries: CalendarEntry[];
  onSelectEntry?: (entryId: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => initialMonth(entries));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const entriesByDate = new Map<string, string[]>();
  for (const entry of entries) {
    const date = validDate(entry.createdAt);
    if (!date) continue;
    const key = dateKey(date);
    const matchingIds = entriesByDate.get(key) ?? [];
    matchingIds.push(entry.id);
    entriesByDate.set(key, matchingIds);
  }

  const todayKey = dateKey(new Date());
  const days = monthDays(viewDate);
  const monthLabel = monthFormatter.format(viewDate);

  function moveMonth(offset: number) {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    setSelectedDateKey(null);
  }

  function selectDate(date: Date) {
    const key = dateKey(date);
    const matchingIds = entriesByDate.get(key);
    if (!matchingIds?.length) return;

    setSelectedDateKey(key);
    const entryId = matchingIds[0];
    onSelectEntry?.(entryId);
    window.requestAnimationFrame(() => {
      document.getElementById(`entry-${entryId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goToToday() {
    const today = new Date();
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(entriesByDate.has(todayKey) ? todayKey : null);
  }

  return (
    <aside className="journal-calendar" aria-labelledby="journal-calendar-title">
      <div className="calendar-header">
        <div>
          <p className="calendar-eyebrow">JOURNAL MAP</p>
          <h2 id="journal-calendar-title">{monthLabel}</h2>
        </div>
        <button type="button" className="calendar-today" onClick={goToToday}>
          Today
        </button>
      </div>

      <div className="calendar-nav-row">
        <button type="button" className="calendar-nav" onClick={() => moveMonth(-1)} aria-label="Previous month">
          Prev
        </button>
        <button type="button" className="calendar-nav" onClick={() => moveMonth(1)} aria-label="Next month">
          Next
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="calendar-weekday">
            {weekday}
          </span>
        ))}
      </div>

      <div className="calendar-grid" aria-label={`${monthLabel} journal dates`}>
        {days.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} aria-hidden="true" />;

          const key = dateKey(day);
          const entryCount = entriesByDate.get(key)?.length ?? 0;
          const hasEntries = entryCount > 0;
          const isSelected = selectedDateKey === key;
          const isToday = todayKey === key;
          const fullDate = fullDateFormatter.format(day);

          return (
            <button
              key={key}
              type="button"
              className={`calendar-day${hasEntries ? " has-entries" : ""}${isSelected ? " is-selected" : ""}`}
              disabled={!hasEntries}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              aria-label={`${fullDate}${hasEntries ? `, ${entryCount} journal ${entryCount === 1 ? "entry" : "entries"}` : ""}`}
              onClick={() => selectDate(day)}
            >
              <span>{day.getDate()}</span>
              {hasEntries && <span className="calendar-dot" aria-hidden="true" />}
              {entryCount > 1 && <span className="calendar-count">{entryCount}</span>}
            </button>
          );
        })}
      </div>

      <p className="calendar-hint">Select a marked day to jump to its entry.</p>
    </aside>
  );
}
