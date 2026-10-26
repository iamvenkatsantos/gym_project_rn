import { useState } from 'react';

import { PERIOD_PRESETS, presetPeriod, type PeriodPreset } from '@/features/reports/rules';

import type { ReportPeriod } from '../data/types';

type Choice = PeriodPreset | 'custom';

/** A report period: one of the app's presets, or any two dates. */
export function PeriodPicker({
  value,
  onChange,
}: {
  value: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
}) {
  const [choice, setChoice] = useState<Choice>(
    () => PERIOD_PRESETS.find((p) => samePeriod(presetPeriod(p.value), value))?.value ?? 'custom',
  );

  return (
    <>
      <select
        className="select"
        aria-label="Period"
        value={choice}
        onChange={(e) => {
          const next = e.target.value as Choice;
          setChoice(next);
          if (next !== 'custom') onChange(presetPeriod(next));
        }}>
        {PERIOD_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom dates</option>
      </select>
      {choice === 'custom' ? (
        <>
          <input
            className="input"
            type="date"
            aria-label="From"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          <input
            className="input"
            type="date"
            aria-label="To"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </>
      ) : null}
    </>
  );
}

function samePeriod(a: ReportPeriod, b: ReportPeriod) {
  return a.from === b.from && a.to === b.to;
}
