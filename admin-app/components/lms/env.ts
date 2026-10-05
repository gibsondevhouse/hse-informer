import type { LearnerResponse } from '@/lib/lms/schema';
import type { Attestation } from '@/lib/lms/engine';

/** lesson: formative with Check/Try again · exam: inputs only · review: read-only with feedback. */
export type BlockMode = 'lesson' | 'exam' | 'review';

export type BlockEnv = {
  mode: BlockMode;
  showDevNotes: boolean;
  responses: Record<string, LearnerResponse>;
  checked: readonly string[];
  checklists: Record<string, number[]>;
  reflections: Record<string, string>;
  surveys: Record<string, string>;
  attestations: Record<string, Attestation>;
  onAnswer: (blockId: string, response: LearnerResponse) => void;
  onCheck: (blockId: string) => void;
  onRetry: (blockId: string) => void;
  onToggleChecklist: (blockId: string, index: number) => void;
  onSetReflection: (blockId: string, text: string) => void;
  onSetSurvey: (blockId: string, value: string) => void;
  onAttest: (blockId: string, name: string) => void;
};

/** Small stable hash so per-block shuffles do not change between renders or sessions. */
export function hashId(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
