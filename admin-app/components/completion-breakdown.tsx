import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  summarizeAssignmentStatuses,
  type Assignment,
  type AssignmentStatusKey,
} from '@/lib/training';

export function CompletionBreakdown({
  records,
  onSelect,
  onBack,
}: {
  records: Assignment[];
  onSelect: (status: AssignmentStatusKey) => void;
  onBack: () => void;
}) {
  return (
    <section
      className="panel completion-panel"
      aria-labelledby="completion-heading"
    >
      <div className="panel-heading">
        <h2 id="completion-heading">Completion status</h2>
        <Button variant="outline" onClick={onBack}>
          View assignment records <ArrowRight size={14} />
        </Button>
      </div>
      <div className="completion-status-grid">
        {summarizeAssignmentStatuses(records).map((status) => (
          <button
            key={status.key}
            type="button"
            className={`completion-status status-${status.key}`}
            onClick={() => onSelect(status.key)}
            aria-label={`View ${status.count} ${status.label} assignments, ${status.percent}% of assignments`}
          >
            <span className="completion-status-label">{status.label}</span>
            <span className="completion-ring" aria-hidden="true">
              <svg viewBox="0 0 100 100" focusable="false">
                <circle
                  className="completion-ring-track"
                  cx="50"
                  cy="50"
                  r="44"
                />
                <circle
                  className="completion-ring-value"
                  cx="50"
                  cy="50"
                  r="44"
                  pathLength="100"
                  strokeDasharray={`${status.percent} 100`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <strong>
                {status.percent}
                <small>%</small>
              </strong>
            </span>
            <span className="completion-status-count">
              <strong>{status.count}</strong>{' '}
              {status.count === 1 ? 'assignment' : 'assignments'}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      {!records.length && (
        <p className="completion-empty">
          No assignments for the selected sites.
        </p>
      )}
    </section>
  );
}
