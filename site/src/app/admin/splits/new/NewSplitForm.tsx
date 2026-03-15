'use client';

import { useMemo, useState } from 'react';
import SectorMultiSelect from '@/components/splits/SectorMultiSelect';

type ServerAction = (formData: FormData) => Promise<void>;

export default function NewSplitForm({ error, onCreate }: { error?: string | string[]; onCreate: ServerAction }) {
  const [type, setType] = useState<'high' | 'low'>('high');

  const errText = useMemo(() => {
    if (!error) return '';
    return Array.isArray(error) ? error.join(', ') : String(error);
  }, [error]);

  return (
    <form action={onCreate}>
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Create split</div>
        </div>
        <div className="ui-card__body">
          {errText ? (
            <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
              {errText}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Callsign</div>
              <input name="callsign" className="ui-input" placeholder="CLE_48_CTR" required />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Frequency</div>
              <input name="frequency" className="ui-input" placeholder="119.875" required />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Type</div>
              <select
                name="type"
                className="ui-input"
                value={type}
                onChange={(e) => setType(e.target.value === 'low' ? 'low' : 'high')}
              >
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </label>

            <div className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Sectors</div>
              <SectorMultiSelect name="splits" mode={type} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-white/50">
              Sectors are stored as a comma-separated list internally; you select them here via checkboxes.
            </div>
            <button className="ui-button" type="submit">
              Create split
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
