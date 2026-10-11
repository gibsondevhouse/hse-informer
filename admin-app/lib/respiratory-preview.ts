export const previewSteps = [
  'Course introduction',
  'Recognize a breathing hazard',
  'Know the forms of contamination',
  'Understand what you cannot detect',
  'Practice a workplace decision',
  'Opening lesson recap',
];
export const lessonReferences = [
  {
    label: 'OSHA · Industrial Hygiene (OSHA 3143)',
    href: 'https://www.osha.gov/publications/OSHA3143',
  },
  {
    label: 'NIOSH · A Guide to Air-Purifying Respirators',
    href: 'https://www.cdc.gov/niosh/docs/2018-176/',
  },
  {
    label: 'NIOSH · Confined-space hazards',
    href: 'https://archive.cdc.gov/www_cdc_gov/niosh/topics/emres/confined.html',
  },
] as const;

export type PreviewState = {
  step: number;
  answer: string;
  checked: boolean;
  completed: number[];
};
export const initialPreviewState: PreviewState = {
  step: 0,
  answer: '',
  checked: false,
  completed: [],
};
export type PreviewAction =
  | { type: 'next' | 'back' | 'check' | 'overview' | 'restart' | 'resume' }
  | { type: 'section'; value: number }
  | { type: 'answer'; value: string };

export const scenarioOptions = [
  {
    id: 'continue',
    text: 'Continue because the dust cloud has cleared and you feel fine.',
    feedback:
      'A clearing cloud and a lack of symptoms do not show that the exposure is controlled. Some airborne particles are too small to see, and harmful effects may not appear immediately.',
  },
  {
    id: 'mask',
    text: 'Put on a spare dust mask and finish the batch.',
    feedback:
      'Do not choose a respirator yourself to compensate for a failed control. Respiratory protection must match the evaluated hazard and the employer’s program; a spare mask does not establish that the task is safe.',
  },
  {
    id: 'stop',
    text: 'Stop the task, move clear as the site procedure directs, and report the failed exhaust before work resumes.',
    feedback:
      'That addresses the changed condition. Follow the site’s stop-work and reporting instructions. The responsible people must evaluate the problem and establish the controls before the task resumes.',
  },
] as const;

export function reducePreview(
  state: PreviewState,
  action: PreviewAction,
): PreviewState {
  switch (action.type) {
    case 'answer':
      return scenarioOptions.some((option) => option.id === action.value)
        ? { ...state, answer: action.value, checked: false }
        : state;
    case 'check':
      return state.answer ? { ...state, checked: true } : state;
    case 'next':
      return state.step === 4 && (!state.checked || state.answer !== 'stop')
        ? state
        : {
            ...state,
            step: Math.min(state.step + 1, previewSteps.length - 1),
            completed:
              state.step > 0
                ? [...new Set([...state.completed, state.step])].sort(
                    (a, b) => a - b,
                  )
                : state.completed,
          };
    case 'back':
      return { ...state, step: Math.max(0, state.step - 1) };
    case 'overview':
      return { ...state, step: 0 };
    case 'restart':
      return { ...initialPreviewState, step: 1 };
    case 'resume':
      return {
        ...state,
        step: state.step || Math.min(Math.max(0, ...state.completed) + 1, 5),
      };
    case 'section':
      return Number.isInteger(action.value) &&
        action.value >= 1 &&
        action.value <= Math.min(Math.max(0, ...state.completed) + 1, 5)
        ? { ...state, step: action.value }
        : state;
  }
}

/** Keep each content block intact; never skip a block when the viewport changes. */
export function paginateBlocks(
  heights: number[],
  available: number,
  gap = 16,
  exclusiveGroups: (number | undefined)[] = [],
): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  heights.forEach((height, index) => {
    const group = exclusiveGroups[index];
    const repeatsControl =
      group !== undefined &&
      page.some((item) => exclusiveGroups[item] === group);
    if (page.length && (used + gap + height > available || repeatsControl)) {
      pages.push(page);
      page = [];
      used = 0;
    }
    used += (page.length ? gap : 0) + height;
    page.push(index);
  });
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

export const breathingHazards = [
  {
    name: 'Dust',
    kind: 'Solid particles',
    explanation:
      'Solid material can become airborne when it is handled, cut, ground, or otherwise disturbed.',
    example: 'Charging dry powder from a bag.',
  },
  {
    name: 'Mist',
    kind: 'Liquid droplets',
    explanation:
      'Spraying or splashing can suspend small liquid droplets in the air.',
    example: 'Spraying a cleaning solution.',
  },
  {
    name: 'Fume',
    kind: 'Very small solid particles',
    explanation:
      'Heating can turn material into vapor that cools and condenses into fine solid particles. Fume is not another word for gas.',
    example: 'Metal fume produced by welding.',
  },
  {
    name: 'Gas',
    kind: 'A substance in its gaseous form',
    explanation:
      'Gases mix with the surrounding air. Some are toxic, and some can displace the oxygen you need.',
    example: 'A nitrogen release into an enclosed area.',
  },
  {
    name: 'Vapor',
    kind: 'The gaseous form of a liquid or solid',
    explanation:
      'A liquid can evaporate into the air, even when you do not see a cloud.',
    example: 'Solvent evaporating during an open transfer.',
  },
];
