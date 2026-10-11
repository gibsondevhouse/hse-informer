import type { Metadata } from 'next';
import { RecordedAssignment } from '@/components/recorded-assignment';

export const metadata: Metadata = {
  title: 'Assigned training | HSE Informer',
};

export default async function AssignedTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecordedAssignment assignmentId={id} />;
}
