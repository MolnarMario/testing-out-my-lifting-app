import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDateLong, formatDateShort, todayKey } from "../../lib/format";

interface Props {
  date: string;
  onDateChange: (next: string) => void;
}

export function DateBar({ date, onDateChange }: Props) {
  const isToday = date === todayKey();

  return (
    <div className="datebar">
      <button className="round" onClick={() => onDateChange(addDays(date, -1))} aria-label="Previous day">
        <ChevronLeft aria-hidden="true" />
      </button>

      <div className="date-center">
        <Calendar aria-hidden="true" />
        <span className="date-text">
          <span className="date-long">{formatDateLong(date)}</span>
          <span className="date-short">{formatDateShort(date)}</span>
        </span>
        <input
          type="date"
          className="date-native"
          value={date}
          aria-label="Pick a date"
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value);
          }}
        />
      </div>

      <button className="round" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
        <ChevronRight aria-hidden="true" />
      </button>

      {!isToday && (
        <button className="today-btn" onClick={() => onDateChange(todayKey())}>
          Today
        </button>
      )}
    </div>
  );
}
