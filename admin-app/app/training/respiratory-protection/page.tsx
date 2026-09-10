import type { Metadata } from 'next';
import RespiratoryPreview from '@/components/respiratory-player';

export const metadata: Metadata = {
  title: 'Respiratory Protection · Training preview | HSE Informer',
  description:
    'An administrator preview of the first Respiratory Protection lesson. Draft content; no learner records are created.',
};

export default function RespiratoryTrainingPage() {
  return <RespiratoryPreview />;
}
