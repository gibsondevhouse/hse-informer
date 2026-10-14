import type { ReactNode } from 'react';
import './hse-status-badge.css';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function StatusBadge({ children, tone = 'neutral' }: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return <span className={`hse-status-badge hse-status-badge--${tone}`}>{children}</span>;
}

/** A completion record is a knowledge state, never an authorization decision. */
export function assignmentStatusLabel(status: string) {
  return status === 'Knowledge Complete' ? 'Knowledge complete' : status;
}

export function assignmentStatusTone(status: string): StatusTone {
  if (status === 'Knowledge Complete') return 'success';
  if (status === 'In progress') return 'info';
  if (status === 'Cancelled') return 'neutral';
  return 'neutral';
}
