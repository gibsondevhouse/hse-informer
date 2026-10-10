import type { Metadata } from 'next';
import { LearnerAssignments } from '@/components/learner-assignments';

export const metadata: Metadata = {
  title: 'My training assignments | HSE Informer',
};

export default function LearnerAssignmentsPage() {
  return <LearnerAssignments />;
}
