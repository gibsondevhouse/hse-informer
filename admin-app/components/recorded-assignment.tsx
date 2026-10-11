'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CoursePlayer } from '@/components/lms/course-player';
import { getRecordedCoursePackage } from '@/lib/lms/recorded-courses';
import type { PlayerState } from '@/lib/lms/engine';
import './learner-assignments.css';

type Record = {
  assignment: {
    id: string;
    courseId: string;
    version: string;
    title: string;
    launchable: boolean;
  };
  state: PlayerState | null;
  revision: number | null;
  practice?: boolean;
};

export function RecordedAssignment({ assignmentId }: { assignmentId: string }) {
  const [record, setRecord] = useState<Record | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`/api/learner/assignments/${encodeURIComponent(assignmentId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const value = (await response.json()) as Record & { error?: string };
        if (!response.ok) throw new Error(value.error || 'Assignment could not be loaded.');
        return value;
      })
      .then((value) => active && setRecord(value))
      .catch((reason) => active && setError(String(reason.message || reason)));
    return () => { active = false; };
  }, [assignmentId]);

  if (error) return <main className="learner-inbox"><p role="alert">{error}</p><Link href="/learn">Return to assignments</Link></main>;
  if (!record) return <main className="learner-inbox"><p>Loading assignment…</p></main>;
  const course = getRecordedCoursePackage(record.assignment.courseId, record.assignment.version);
  if (!record.assignment.launchable || !record.state || record.revision === null || !course) {
    return <main className="learner-inbox"><h1>Course unavailable</h1><p>This assignment has no approved, deliverable course package.</p><Link href="/learn">Return to assignments</Link></main>;
  }
  return (
    <CoursePlayer
      course={course}
      homeHref="/learn"
      homeLabel="Return to assignments"
      recorded={{ assignmentId, state: record.state, revision: record.revision, practice: !!record.practice }}
    />
  );
}
