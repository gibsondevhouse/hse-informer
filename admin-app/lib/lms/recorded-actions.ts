import {
  courseStatus,
  isInteractionBlock,
  lessonOrder,
  reducePlayer,
  type PlayerAction,
  type PlayerState,
} from './engine.ts';
import type { Course, LearnerResponse } from './schema';

const plainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const shortString = (value: unknown, max = 5_000): value is string =>
  typeof value === 'string' && value.length <= max;

function response(value: unknown): value is LearnerResponse {
  if (shortString(value) || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.length <= 100 && value.every((item) => shortString(item, 500));
  return (
    plainObject(value) &&
    Object.keys(value).length <= 100 &&
    Object.entries(value).every(
      ([key, item]) => shortString(key, 200) && shortString(item, 500),
    )
  );
}

/**
 * Recorded progress accepts learner actions, never a client-authored score or
 * completion snapshot. The server replays these actions against the pinned
 * course package and creates the result from its own reducer.
 */
export function parseRecordedAction(
  value: unknown,
  course: Course,
  now: string,
): PlayerAction | null {
  if (!plainObject(value) || typeof value.type !== 'string') return null;
  const blocks = lessonOrder(course).flatMap((lesson) => lesson.blocks);
  const block =
    typeof value.blockId === 'string'
      ? blocks.find((item) => 'id' in item && item.id === value.blockId)
      : undefined;
  switch (value.type) {
    case 'open-overview':
    case 'back':
    case 'complete-lesson':
    case 'open-assessment':
    case 'submit-assessment':
    case 'open-summary':
      return value.type === 'submit-assessment'
        ? { type: value.type, at: now }
        : { type: value.type };
    case 'open-lesson':
      return typeof value.lessonId === 'string' &&
        lessonOrder(course).some((lesson) => lesson.id === value.lessonId)
        ? { type: value.type, lessonId: value.lessonId }
        : null;
    case 'go-slide':
      return Number.isInteger(value.index) &&
        (value.index as number) >= 0 &&
        (value.index as number) < 10_000
        ? { type: value.type, index: value.index as number }
        : null;
    case 'answer':
      return block && isInteractionBlock(block) && response(value.response)
        ? { type: value.type, blockId: block.id, response: value.response }
        : null;
    case 'check':
    case 'retry':
      return block && isInteractionBlock(block)
        ? { type: value.type, blockId: block.id }
        : null;
    case 'toggle-checklist':
      return block?.type === 'checklist' &&
        Number.isInteger(value.index) &&
        (value.index as number) >= 0 &&
        (value.index as number) < block.items.length
        ? { type: value.type, blockId: block.id, index: value.index as number }
        : null;
    case 'set-reflection':
      return block?.type === 'reflection' && shortString(value.text)
        ? { type: value.type, blockId: block.id, text: value.text }
        : null;
    case 'set-survey':
      return block?.type === 'survey' &&
        block.scale.some((choice) => choice.id === value.value)
        ? { type: value.type, blockId: block.id, value: value.value as string }
        : null;
    case 'attest':
      return block?.type === 'attestation' &&
        shortString(value.name, 200) &&
        value.name.trim().length > 0
        ? { type: value.type, blockId: block.id, name: value.name, at: now }
        : null;
    case 'select-option':
      return block?.type === 'optionSelect' &&
        block.options.some((option) => option.id === value.optionId)
        ? { type: value.type, blockId: block.id, optionId: value.optionId as string }
        : null;
    case 'start-assessment':
      return Number.isInteger(value.seed) &&
        (value.seed as number) >= 0 &&
        (value.seed as number) <= 0xffffffff
        ? { type: value.type, seed: value.seed as number, at: now }
        : null;
    case 'answer-assessment':
      return typeof value.questionId === 'string' &&
        course.assessment.questions.some((item) => item.id === value.questionId) &&
        response(value.response)
        ? {
            type: value.type,
            questionId: value.questionId,
            response: value.response,
          }
        : null;
    default:
      // Reset, author controls, and unknown actions cannot change evidence.
      return null;
  }
}

export function replayRecordedAction(
  course: Course,
  state: PlayerState,
  action: unknown,
  now: string,
) {
  const parsed = parseRecordedAction(action, course, now);
  if (!parsed) return null;
  const next = reducePlayer(course, state, parsed);
  return { state: next, status: courseStatus(course, next), action: parsed };
}
