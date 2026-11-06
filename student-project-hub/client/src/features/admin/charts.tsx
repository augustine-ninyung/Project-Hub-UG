import { useState } from 'react';
import { format } from 'date-fns';

/**
 * Single-series daily column chart. One hue (primary) because the data has one
 * job (magnitude over time); identity is carried by the card title, so no legend.
 * Each column has a hit target wider than the mark and a hover/focus tooltip;
 * an sr-only table provides the accessible view.
 */
export function DailyBarChart({
  data,
  label,
}: {
  data: { date: string; value: number }[];
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <figure className="space-y-3">
      <div className="flex items-baseline justify-between">
        <figcaption className="text-sm font-medium">{label}</figcaption>
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{total}</span> in 14 days
        </span>
      </div>
      <div className="relative">
        {/* Recessive baseline grid */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" aria-hidden />
        <div className="flex h-32 items-end gap-[2px]" aria-hidden>
          {data.map((d, i) => (
            <div
              key={d.date}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className="w-full origin-bottom animate-grow-y rounded-t-[4px] bg-primary transition-[opacity,height] duration-300"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  minHeight: d.value ? 2 : 0,
                  opacity: active === null || active === i ? 1 : 0.45,
                  animationDelay: `${i * 25}ms`,
                }}
              />
              {active === i && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 animate-scale-in whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                  <span className="text-muted-foreground">{format(new Date(d.date), 'MMM d')}: </span>
                  <span className="font-semibold tabular-nums">{d.value}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground" aria-hidden>
          <span>{data[0] && format(new Date(data[0].date), 'MMM d')}</span>
          <span>{data.at(-1) && format(new Date(data.at(-1)!.date), 'MMM d')}</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>{label} per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>{label}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars for a ranked categorical magnitude, values direct-labelled in text ink. */
export function HorizontalBars({ data }: { data: { name: string; count: number }[] }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((d) => d.count));
  return (
    <ul className="space-y-2.5">
      {sorted.map((d, i) => (
        <li key={d.name} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{d.name}</span>
          <span className="h-2 overflow-hidden rounded-r-[4px] bg-muted" aria-hidden>
            <span
              className="block h-full origin-left animate-grow-x rounded-r-[4px] bg-primary transition-[width] duration-300"
              style={{ width: `${(d.count / max) * 100}%`, animationDelay: `${i * 40}ms` }}
            />
          </span>
          <span className="text-right font-medium tabular-nums">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}
