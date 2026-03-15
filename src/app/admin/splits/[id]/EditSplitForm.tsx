'use client';

import { useMemo, useState } from 'react';
import SectorMultiSelect from '@/components/splits/SectorMultiSelect';

type ServerAction = (formData: FormData) => Promise<void>;

export default function EditSplitForm({
  id,
  initial,
  saved,
  onSave,
  onDelete,
}: {
  id: string;
  initial: { callsign: string; frequency: string; type: 'high' | 'low' | string; sectors: string[] };
  saved?: boolean;
  onSave: ServerAction;
  onDelete: ServerAction;
}) {
  const [type, setType] = useState<'high' | 'low'>(initial.type === 'low' ? 'low' : 'high');

  const sectors = useMemo(() => initial.sectors ?? [], [initial.sectors]);

  return (
    <div className="space-y-4">
      {saved ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          Saved.
        </div>
      ) : null}

      <form action={onSave}>
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">Edit split</div>
          </div>
          <div className="ui-card__body">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="text-xs text-white/60 mb-1">Callsign</div>
                <input name="callsign" className="ui-input" defaultValue={initial.callsign} required />
              </label>

              <label className="block">
                <div className="text-xs text-white/60 mb-1">Frequency</div>
                <input name="frequency" className="ui-input" defaultValue={initial.frequency} required />
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
                <SectorMultiSelect name="splits" mode={type} defaultSelected={sectors} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
<button className="ui-button" type="submit">
                Save changes
              </button>
            </div>
          </div>
        </div>
      </form>

      <form action={onDelete}>
        <button className="ui-btn ui-btn--danger" type="submit">
          Delete split
        </button>
      </form>
    </div>
  );
}
