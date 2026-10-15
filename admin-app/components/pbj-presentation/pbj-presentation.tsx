'use client';

import { PresentationPlayer } from '@/components/presentation/presentation-player';
import { pbjPresentation } from '@/lib/lms/pbj-presentation';
import { PBJArt } from './pbj-art';
import { PBJQualityArt } from './pbj-quality-art';
import { PBJLearningArt } from './pbj-learning-art';

const artworkLabels: Record<string, string> = {
  sandwich: 'A familiar task. A consistent result.',
  ingredients: 'Bread. Peanut butter. Fruit spread.',
  handwash: 'Good preparation starts with clean hands.',
  workstation: 'A place for everything you need.',
  spread: 'Even layers, all the way to the edges.',
  cut: 'A gentle touch. A clean finish.',
  storage: 'Ready to serve. Ready for later.',
};

export function PBJPresentation() {
  return (
    <PresentationPlayer
      course={pbjPresentation}
      artworkLabels={artworkLabels}
      renderArtwork={(kind) =>
        kind.startsWith('quality-') ? (
          <PBJQualityArt kind={kind} />
        ) : kind.startsWith('learn-') ? (
          <PBJLearningArt kind={kind} />
        ) : Object.hasOwn(artworkLabels, kind) ? (
          <PBJArt kind={kind as Parameters<typeof PBJArt>[0]['kind']} />
        ) : null
      }
    />
  );
}
