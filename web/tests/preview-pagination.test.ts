import { describe, expect, it } from 'vitest';
import { paginatePageParts, refinePageBlocks, splitPageBlock, type PageBlock } from '../src/lib/preview/pagination';

describe('measured learner preview pages', () => {
  it('preserves every word while splitting an oversized block', () => {
    const block: PageBlock = { kind: 'text', title: 'Ventilation', text: 'One two three four five six seven eight' };
    const parts = refinePageBlocks([block], { 0: 2 });
    expect(parts.map((part) => part.text).join(' ')).toBe(block.text);
    expect(parts.map((part) => part.source)).toEqual([0, 0, 0, 0]);
    expect(parts.map((part) => part.part)).toEqual([0, 1, 2, 3]);
    const hazard: PageBlock = { kind: 'hazard', title: 'Dust', text: 'Fine airborne material persists', example: 'Bag charging at a mixer' };
    const hazardParts = refinePageBlocks([hazard], { 0: 3 });
    expect(hazardParts.map((part) => part.text).filter(Boolean).join(' ')).toBe(hazard.text);
    expect(hazardParts.map((part) => 'example' in part ? part.example : '').filter(Boolean).join(' ')).toBe(hazard.example);
  });

  it('places measured blocks on pages and keeps split radio answers apart', () => {
    const blocks: PageBlock[] = [
      { kind: 'title', text: 'Changed condition' },
      { kind: 'scenario-choice', optionId: 'stop', optionIndex: 2, text: 'Stop work and report the failed ventilation' },
      { kind: 'context', text: 'Practice only' }
    ];
    const parts = refinePageBlocks(blocks, { 1: 1 });
    const pages = paginatePageParts(parts, [35, 42, 43, 20], 100, 16);
    expect(pages).toEqual([[0, 1], [2, 3]]);
    expect(pages.flat()).toEqual([0, 1, 2, 3]);
    expect(splitPageBlock({ kind: 'check-answer', text: 'Check answer' })).toHaveLength(1);
  });
});
