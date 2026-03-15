import {
  TRAINING_RUBRIC,
  RUBRIC_RATING_OPTIONS,
  type RubricChecks,
  type RubricRatings,
  defaultRubricChecks,
  defaultRubricRatings,
  normalizeRubricRating,
} from '@/lib/trainingRubric';

function coerceObject(v: any): any {
  if (!v) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

export default function TrainingTicketRubric({
  initialRatings,
  initialChecks,
}: {
  initialRatings?: any;
  initialChecks?: any;
}) {
  const ratingsObj = (coerceObject(initialRatings) ?? defaultRubricRatings()) as RubricRatings;
  const checksObj = (coerceObject(initialChecks) ?? defaultRubricChecks()) as RubricChecks;

  return (
    <div className="space-y-4">
      {TRAINING_RUBRIC.map((cat) => {
        const currentRating = normalizeRubricRating(ratingsObj[cat.key]);
        const checked = new Set((checksObj[cat.key] ?? []) as string[]);

        return (
          <div key={cat.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{cat.title}</div>
                <div className="text-xs text-white/50">Select what was demonstrated, and choose a rating.</div>
              </div>
              <div className="min-w-[220px]">
                <label className="ui-label sr-only">{cat.title} rating</label>
                <select name={`rating_${cat.key}`} className="ui-input" defaultValue={currentRating}>
                  {RUBRIC_RATING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {cat.items.map((b) => (
                <label key={b.key} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <input
                    type="checkbox"
                    name={`check_${cat.key}`}
                    value={b.key}
                    defaultChecked={checked.has(b.key)}
                    className="mt-1"
                  />
                  <span className="text-sm text-white/90">{b.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
