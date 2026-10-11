import type { LessonBlock } from './lesson';

export type PageBlock = LessonBlock | {
  kind: 'scenario-choice' | 'check-answer' | 'success';
  text: string;
  optionId?: string;
  optionIndex?: number;
};

export type PagePart = PageBlock & { source: number; part: number };

/** Split long copy at word boundaries while preserving the block's presentation. */
export function splitPageBlock(block: PageBlock): PageBlock[] {
  if (block.kind === 'check-answer') return [block];
  const words = block.text.trim().split(/\s+/);
  if (words.length > 1) {
    const middle = Math.ceil(words.length / 2);
    return [
      { ...block, text: words.slice(0, middle).join(' '), ...('example' in block ? { example: undefined } : {}) },
      { ...block, text: words.slice(middle).join(' ') }
    ];
  }
  if ('example' in block && typeof block.example === 'string') {
    const exampleWords = block.example.trim().split(/\s+/);
    if (exampleWords.length > 1) {
      const middle = Math.ceil(exampleWords.length / 2);
      return [
        { ...block, example: exampleWords.slice(0, middle).join(' ') },
        { ...block, text: '', example: exampleWords.slice(middle).join(' ') }
      ];
    }
  }
  return [block];
}

export function refinePageBlocks(blocks: readonly PageBlock[], depths: Readonly<Record<number, number>>): PagePart[] {
  return blocks.flatMap((block, source) => {
    let parts: PageBlock[] = [block];
    const rounds = Math.min(depths[source] ?? 0, 8);
    for (let round = 0; round < rounds; round++) {
      const next = parts.flatMap(splitPageBlock);
      if (next.length === parts.length) break;
      parts = next;
    }
    return parts.map((part, index) => ({ ...part, source, part: index }));
  });
}

/** Pack measured blocks into the available reading height without dropping any. */
export function paginatePageParts(parts: readonly PagePart[], heights: readonly number[], available: number, gap = 16): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  for (let index = 0; index < parts.length; index++) {
    const height = heights[index] ?? 0;
    const duplicateChoice = parts[index].kind === 'scenario-choice' && page.some((item) => parts[item].source === parts[index].source);
    if (page.length && (used + gap + height > available || duplicateChoice)) {
      pages.push(page);
      page = [];
      used = 0;
    }
    used += (page.length ? gap : 0) + height;
    page.push(index);
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}
