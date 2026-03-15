'use client';

import * as React from 'react';

export default function PilotCountInput({ initial = 5, min = 1, max = 300 }: { initial?: number; min?: number; max?: number }) {
  const [val, setVal] = React.useState<number>(Number.isFinite(initial) ? initial : 5);

  return (
    <div className="flex items-center gap-3">
      <input
        name="pilot_count"
        type="number"
        min={min}
        max={max}
        value={val}
        onChange={(e) => {
          const n = Number(e.target.value);
          setVal(Number.isFinite(n) ? n : min);
        }}
        className="ui-input w-20"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={(e) => {
          const n = Number(e.target.value);
          setVal(Number.isFinite(n) ? n : min);
        }}
        className="w-full"
      />
    </div>
  );
}
