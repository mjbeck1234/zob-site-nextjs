import { TRAINING_RUBRIC, RubricRating, badgeClass, normalizeRubricRating, ratingLabel } from '@/lib/trainingRubric';

type Props = {
  rubricRatings: unknown;
  rubricChecks: unknown;
  compact?: boolean;
  /**
   * checklist: shows items as disabled checkbox rows (mentor-style)
   * bullets: shows ONLY selected items as a bulleted list (student-style)
   */
  variant?: 'checklist' | 'bullets';
};

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s) return undefined;
  // Only attempt parse when it looks like JSON.
  if (!(s.startsWith('{') || s.startsWith('['))) return value;
  try {
    return JSON.parse(s);
  } catch {
    return value;
  }
}

function coerceRecord(value: unknown): Record<string, any> {
  const v = tryParseJson(value);
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as any;
  return {};
}

export default function TrainingTicketRubricView({ rubricRatings, rubricChecks, compact, variant = 'checklist' }: Props) {
  const ratingsObj = coerceRecord(rubricRatings) as Record<string, RubricRating>;
  const checksObj = coerceRecord(rubricChecks) as Record<string, string[]>;

  const gridClass = compact ? '' : 'sm:grid-cols-2';

  return (
    <div className="grid gap-4">
      {TRAINING_RUBRIC.map((cat) => {
        const rating = normalizeRubricRating(ratingsObj[cat.key]);
        const selected = Array.isArray(checksObj[cat.key]) ? (checksObj[cat.key] as string[]) : [];
        const selectedSet = new Set(selected);
        const selectedItems = (cat.items ?? []).filter((i) => selectedSet.has(i.key));

        // Student view rules:
        // - Hide "not assessed" entirely.
        // - Hide categories that are satisfactory AND have no selected items.
        if (variant === 'bullets') {
          if (rating === 'not_assessed') return null;
          if (rating === 'satisfactory' && selectedItems.length === 0) return null;
        }

        return (
          <div key={cat.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{cat.title}</div>
              </div>
              {/* In student view, "not assessed" never reaches here due to hiding above. */}
              <span
                className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(
                  rating,
                )}`}
              >
                {ratingLabel(rating)}
              </span>
            </div>

            {variant === 'bullets' ? (
              selectedItems.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/80">
                  {selectedItems.map((item) => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 text-sm text-white/50">No items selected.</div>
              )
            ) : (
              <ul className={`mt-3 grid gap-2 ${gridClass}`}>
                {(cat.items ?? []).map((item) => {
                  const checked = selectedSet.has(item.key);
                  return (
                    <li key={item.key} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
                      <input type="checkbox" checked={checked} readOnly className="mt-0.5 h-4 w-4" />
                      <span className="text-sm text-white/80">{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
