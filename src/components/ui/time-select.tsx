// timeselect.tsx (responsive layout improvements)
import * as React from "react";
import { Clock, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TimeSelectProps {
  value?: string;
  onChange?: (time: string) => void;
  disabled?: boolean;
  availableTimes?: string[];
  className?: string;
  startHour?: number;
  endHour?: number;
  interval?: number;
  placeholder?: string;
  hour24?: boolean;
  autoOpenOnValue?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/* ---------- helpers (unchanged) ---------- */
function normalizeForCompare(t: string, hour24 = false) {
  if (!t) return "";
  const m = t.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i);
  if (!m) return t.trim();
  let hh = parseInt(m[1], 10);
  const mm = pad(parseInt(m[2], 10));
  const ap = (m[3] || "").toUpperCase();

  if (hour24) {
    if (ap === "AM" && hh === 12) hh = 0;
    else if (ap === "PM" && hh !== 12) hh += 12;
    return `${pad(hh)}:${mm}`;
  } else {
    const hh12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${pad(hh12)}:${mm} ${ap || (hh >= 12 ? "PM" : "AM")}`;
  }
}

/* ---------- Small accessible custom Dropdown (theme-aware) ---------- */
function Dropdown<T extends string | number>(props: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { value, onChange, options, placeholder, ariaLabel, className } = props;
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // keyboard nav
  React.useEffect(() => {
    if (!open) return;
    setHighlight((prev) => {
      if (prev === null) {
        // first enabled item
        const idx = options.findIndex((o) => !o.disabled);
        return idx >= 0 ? idx : null;
      }
      return prev;
    });
  }, [open, options]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    if (highlight !== null && listRef.current) {
      const el = listRef.current.querySelectorAll("[data-option]")[highlight] as HTMLElement;
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlight]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let idx = highlight ?? -1;
      for (let i = 0; i < options.length; i++) {
        idx = (idx + dir + options.length) % options.length;
        if (!options[idx].disabled) {
          setHighlight(idx);
          break;
        }
      }
      return;
    }
    if (e.key === "Enter" && highlight !== null) {
      const opt = options[highlight];
      if (!opt.disabled) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  };

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        className="w-full h-12 rounded-lg bg-white border border-gray-200 px-4 flex items-center justify-between text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-slate-700"
      >
        <span className={selectedLabel ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-400"}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-2 w-full max-h-44 overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg py-1 dark:bg-slate-900 dark:border-slate-800"
        >
          {options.map((opt, i) => {
            const isHighlighted = i === highlight;
            return (
              <div
                key={`${opt.value}-${i}`}
                data-option
                role="option"
                aria-selected={String(value) === String(opt.value)}
                onMouseEnter={() => setHighlight(i)}
                onMouseLeave={() => setHighlight(null)}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer flex items-center justify-between",
                  opt.disabled
                    ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500"
                    : "text-slate-900 dark:text-slate-100",
                  isHighlighted && !opt.disabled
                    ? "bg-gray-100 dark:bg-slate-800"
                    : "hover:bg-gray-50 dark:hover:bg-slate-800/60"
                )}
              >
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------- TimeSelect component -------------------------- */
export function TimeSelect({
  value,
  onChange,
  disabled,
  availableTimes,
  className,
  startHour = 8,
  endHour = 18,
  interval = 5,
  placeholder = "Select time",
  hour24 = false,
  autoOpenOnValue = false,
}: TimeSelectProps) {
  const [open, setOpen] = React.useState(false);

  const s = Math.max(0, Math.min(23, startHour));
  const e = Math.max(s, Math.min(23, endHour));

  const hours = React.useMemo(() => {
    if (hour24) {
      const arr: string[] = [];
      for (let h = s; h <= e; h++) arr.push(pad(h));
      return arr;
    } else {
      const set = new Set<string>();
      for (let h = s; h <= e; h++) {
        const display = h % 12 === 0 ? 12 : h % 12;
        set.add(pad(display));
      }
      return Array.from(set);
    }
  }, [s, e, hour24]);

  const minutes = React.useMemo(() => {
    const arr: string[] = [];
    const step = Math.max(1, interval);
    for (let m = 0; m < 60; m += step) arr.push(pad(m));
    return arr;
  }, [interval]);

  const availableSet = React.useMemo(() => {
    if (!availableTimes?.length) return null;
    const set = new Set<string>();
    for (const t of availableTimes) set.add(normalizeForCompare(t, hour24));
    return set;
  }, [availableTimes, hour24]);

  const parseIncoming = React.useCallback(
    (v?: string) => {
      if (!v) return { hour: "", minute: "", ampm: hour24 ? "" : "AM" };
      const m = v.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i);
      if (!m) {
        if (hour24) {
          const mm = v.match(/^\s*(\d{2}):(\d{2})\s*$/);
          if (mm) return { hour: mm[1], minute: mm[2], ampm: "" };
        }
        return { hour: "", minute: "", ampm: hour24 ? "" : "AM" };
      }
      let hh = parseInt(m[1], 10);
      const mm = pad(parseInt(m[2], 10));
      const ap = (m[3] || "").toUpperCase();
      if (hour24) {
        let hh24 = hh;
        if (ap === "AM" && hh === 12) hh24 = 0;
        if (ap === "PM" && hh !== 12) hh24 = hh + 12;
        return { hour: pad(hh24), minute: mm, ampm: "" };
      } else {
        const hh12 = hh % 12 === 0 ? 12 : hh % 12;
        return { hour: pad(hh12), minute: mm, ampm: ap || (hh >= 12 ? "PM" : "AM") };
      }
    },
    [hour24]
  );

  const [confirmed, setConfirmed] = React.useState<string | "">(value ?? "");
  const initial = React.useMemo(() => parseIncoming(value), [value, parseIncoming]);
  const [hour, setHour] = React.useState<string>(initial.hour || "");
  const [minute, setMinute] = React.useState<string>(initial.minute || "");
  const [ampm, setAmpm] = React.useState<string>(initial.ampm || (hour24 ? "" : "AM"));
  // Track if user has explicitly interacted with each field
  const [userInteractions, setUserInteractions] = React.useState({
    hour: false,
    minute: false,
    ampm: false,
  });

  React.useEffect(() => {
    const p = parseIncoming(value);
    setHour(p.hour || "");
    setMinute(p.minute || "");
    setAmpm(p.ampm || (hour24 ? "" : "AM"));
    setConfirmed(value ?? "");
    // Reset interactions when value changes externally
    if (value) {
      setUserInteractions({ hour: true, minute: true, ampm: true });
    } else {
      setUserInteractions({ hour: false, minute: false, ampm: false });
    }
  }, [value, parseIncoming, hour24]);

  const prevValueRef = React.useRef<string | undefined>(value);
  React.useEffect(() => {
    if (!autoOpenOnValue) {
      prevValueRef.current = value;
      return;
    }
    if (value && value !== prevValueRef.current) setOpen(true);
    prevValueRef.current = value;
  }, [value, autoOpenOnValue]);

  React.useEffect(() => {
    if (!open) return;
    if (!minute) {
      const now = new Date();
      const step = Math.max(1, interval);
      let current = Math.round(now.getMinutes() / step) * step;
      if (current === 60) current = 0;
      setMinute(pad(current));
    }
    if (!hour) {
      const now = new Date();
      let h = now.getHours();
      if (hour24) setHour(pad(h));
      else {
        const hh12 = h % 12 === 0 ? 12 : h % 12;
        setHour(pad(hh12));
        setAmpm(h >= 12 ? "PM" : "AM");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-confirm when all fields are selected AND user has interacted with all fields
  React.useEffect(() => {
    // For 24-hour mode, only need hour and minute
    // For 12-hour mode, need hour, minute, AND ampm interaction
    const allFieldsSet = hour && minute && (hour24 || ampm);
    const allInteractionsDone = hour24 
      ? (userInteractions.hour && userInteractions.minute)
      : (userInteractions.hour && userInteractions.minute && userInteractions.ampm);
    
    if (allFieldsSet && allInteractionsDone) {
      const timeStr = hour24 ? `${pad(Number(hour))}:${minute}` : `${pad(Number(hour))}:${minute} ${ampm}`;
      if (timeStr !== confirmed && timeStr !== value) {
        setConfirmed(timeStr);
        onChange?.(timeStr);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, minute, ampm, hour24, confirmed, userInteractions]);

  const isComboAvailable = React.useCallback(
    (h: string, m: string, ap?: string) => {
      if (!availableSet) return true;
      if (hour24) return availableSet.has(`${h}:${m}`);
      return availableSet.has(`${h}:${m} ${ap}`);
    },
    [availableSet, hour24]
  );

  const preview = React.useMemo(() => {
    if (!hour || !minute) return "";
    return hour24 ? `${pad(Number(hour))}:${minute}` : `${pad(Number(hour))}:${minute} ${ampm}`;
  }, [hour, minute, ampm, hour24]);

  const hourOptions = React.useMemo(
    () =>
      hours.map((h) => {
        let disabled = false;
        const testMinute = minutes[0] ?? "00";
        if (hour24) disabled = !isComboAvailable(h, testMinute);
        else {
          const availAM = isComboAvailable(h, testMinute, "AM");
          const availPM = isComboAvailable(h, testMinute, "PM");
          disabled = !availAM && !availPM;
        }
        return { value: h, label: h, disabled };
      }),
    [hours, minutes, isComboAvailable, hour24]
  );

  const minuteOptions = React.useMemo(
    () =>
      minutes.map((m) => {
        let enabled = false;
        if (!availableSet) enabled = true;
        else {
          if (hour24) {
            for (let hh = s; hh <= e; hh++) {
              const key = `${pad(hh)}:${m}`;
              if (availableSet.has(key)) {
                enabled = true;
                break;
              }
            }
          } else {
            for (const hh of hours) {
              if (isComboAvailable(hh, m, "AM") || isComboAvailable(hh, m, "PM")) {
                enabled = true;
                break;
              }
            }
          }
        }
        return { value: m, label: m, disabled: !enabled };
      }),
    [minutes, availableSet, hours, isComboAvailable, hour24, s, e]
  );

  const ampmOptions = React.useMemo(
    () => [
      { value: "AM", label: "AM", disabled: false },
      { value: "PM", label: "PM", disabled: false },
    ],
    []
  );

  /* ---------------------- layout: responsive grid + stacked actions --------------------- */
  return (
    <div
      className={cn(
        // responsive container: full width, but restrict width on md+
        "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-md w-full",
        // allow user to pass extra className
        className
      )}
      style={{ maxWidth: undefined }}
    >
      {/* grid: on small screens stack vertically; on sm+ display 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start mb-3">
        <div className="w-full">
          <Dropdown
            value={hour || ""}
            onChange={(v) => {
              setHour(String(v));
              setUserInteractions(prev => ({ ...prev, hour: true }));
            }}
            options={hourOptions.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
            placeholder="Hour"
            ariaLabel="Select hour"
            className="w-full"
          />
        </div>

        <div className="w-full">
          <Dropdown
            value={minute || ""}
            onChange={(v) => {
              setMinute(String(v));
              setUserInteractions(prev => ({ ...prev, minute: true }));
            }}
            options={minuteOptions.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
            placeholder="MM"
            ariaLabel="Select minute"
            className="w-full"
          />
        </div>

        <div className="w-full">
          <Dropdown
            value={ampm || "AM"}
            onChange={(v) => {
              setAmpm(String(v));
              setUserInteractions(prev => ({ ...prev, ampm: true }));
            }}
            options={ampmOptions.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
            placeholder="AM/PM"
            ariaLabel="Select AM/PM"
            className="w-full"
          />
        </div>
      </div>

      {/* Clear button */}
      <div className="flex items-center">
        <button
          type="button"
          className="px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          onClick={() => {
            setHour("");
            setMinute("");
            setAmpm("AM");
            setConfirmed("");
            setUserInteractions({ hour: false, minute: false, ampm: false });
            onChange?.("");
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default TimeSelect;
