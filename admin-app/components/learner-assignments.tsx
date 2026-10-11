'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import './learner-assignments.css';

type Assignment = {
  id: string;
  title: string;
  version: string;
  dueDate: string;
  status: string;
  reason: string;
  deliveryState: string;
  launchable: boolean;
  href: string;
};

export function LearnerAssignments() {
  const [data, setData] = useState<{
    worker: { name: string };
    assignments: Assignment[];
    asOf: string;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/learner/assignments', { cache: 'no-store' })
      .then(async (response) => {
        const value = (await response.json()) as {
          error?: string;
          worker: { name: string };
          assignments: Assignment[];
          asOf: string;
        };
        if (!response.ok) throw new Error(value.error || 'Assignments could not be loaded.');
        return value;
      })
      .then((value) => active && setData(value))
      .catch((reason) => active && setError(String(reason.message || reason)));
    return () => { active = false; };
  }, []);
  return (
    <main className="learner-inbox">
      <header className="learner-inbox-header">
        <span><ShieldCheck size={22} aria-hidden="true" /> HSE Informer</span>
        <h1>My training assignments</h1>
        <p>{data ? `${data.worker.name} · Updated ${new Date(data.asOf).toLocaleString()}` : 'Your assigned training and progress.'}</p>
      </header>
      {error && <div role="alert" className="notice">{error}</div>}
      {!data && !error && <p>Loading assignments…</p>}
      {data && data.assignments.length === 0 && <p>No training assignments are currently linked to your account.</p>}
      {data && data.assignments.length > 0 && (
        <div className="learner-inbox-list">
          {data.assignments.map((assignment) => (
            <article className="panel learner-inbox-card" key={assignment.id}>
              <div>
                <small>{assignment.version} · {assignment.reason}</small>
                <h2>{assignment.title}</h2>
                <p>Due {new Date(`${assignment.dueDate}T12:00:00Z`).toLocaleDateString()} · {assignment.status}</p>
              </div>
              {assignment.launchable ? (
                <Link href={assignment.href} className="learner-inbox-action">
                  {assignment.status === 'Knowledge Complete' ? 'Review record' : 'Open training'} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : <span className="learner-inbox-unavailable">Course release unavailable</span>}
            </article>
          ))}
        </div>
      )}
      <p className="learner-inbox-boundary">Knowledge completion alone does not authorize site work or equipment use.</p>
    </main>
  );
}
