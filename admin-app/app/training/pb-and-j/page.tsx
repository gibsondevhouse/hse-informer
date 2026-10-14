import type { Metadata } from 'next';
import { PBJPresentation } from '@/components/pbj-presentation/pbj-presentation';

export const metadata: Metadata = {
  title: 'PBJ-101 · Peanut Butter and Jelly | HSE Informer',
  description:
    'A slide-based PB&J course presentation and design scratch pad. Explore slides, captions, and transcripts without creating a training record.',
};

export default function PeanutButterAndJellyPage() {
  return <PBJPresentation />;
}
