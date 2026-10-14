/** Read-only reference syllabi from the React preview. None is an approved course. */
export type PreviewCourse = {
  code: string;
  title: string;
  purpose: string;
  lessons: readonly string[];
  localInstruction: readonly string[];
};

export const previewCourses = [
  {
    code: 'RP', title: 'Respiratory Protection',
    purpose: 'Respiratory hazards, how respirators protect, and responsibilities within a respiratory protection program.',
    lessons: [
      'What can harm your breathing', 'How the workplace controls exposure',
      'How the respiratory protection program works', 'What different respirators do',
      'Filters, cartridges, and protection limits', 'Medical evaluation, fit testing, and seal checks',
      'Inspecting and wearing a respirator', 'Cleaning, storage, and replacement',
      'Recognizing trouble and responding'
    ],
    localInstruction: [
      'Assigned respirators and task-specific hazards', 'Cartridge schedules, cleaning, and storage',
      'Medical evaluation, fit testing, and local contacts'
    ]
  },
  {
    code: 'LOTO', title: 'Lockout/Tagout',
    purpose: 'Hazardous energy, why shutdown is not isolation, and the responsibilities of different employee groups.',
    lessons: [
      'How equipment can hurt someone unexpectedly', 'The different forms of hazardous energy',
      'When hazardous-energy control matters', 'Who does what', 'Stopping versus isolating equipment',
      'How the energy-control process works', 'What locks and tags communicate',
      'Maintaining protection during changes', 'Returning equipment to service'
    ],
    localInstruction: [
      'Equipment-specific procedures and isolation points', 'Group lockout and shift-change arrangements',
      'Role-specific instruction and employer authorization'
    ]
  },
  {
    code: 'CS', title: 'Confined Space',
    purpose: 'Confined-space hazards, entry safeguards, team responsibilities, and emergency boundaries.',
    lessons: [
      'Recognizing a confined space', 'Understanding permit-required spaces',
      'Understanding what counts as entry', 'Atmospheric hazards', 'Other serious hazards',
      'How entry is planned and controlled', 'Understanding air testing',
      'Understanding entry-team responsibilities', 'Recognizing when entry must stop',
      'Responding to an emergency'
    ],
    localInstruction: [
      'Space inventory, permits, and isolation methods', 'Air testing, communication, and entry equipment',
      'Assigned roles and site rescue arrangements'
    ]
  },
  {
    code: 'CH', title: 'Chemical Hygiene',
    purpose: 'Chemical-exposure prevention and contamination control in everyday manufacturing work.',
    lessons: [
      'How chemicals reach the body', 'How exposure can affect health',
      'Where exposure happens during work', 'How exposure is controlled', 'Protecting skin and eyes',
      'Keeping contamination out of clean areas', 'Handling contaminated clothing and equipment',
      'Housekeeping and cleaning without spreading contamination', 'Responding to suspected exposure',
      'Recognizing when the normal method is no longer adequate'
    ],
    localInstruction: [
      'Local exposure concerns and approved cleaning methods', 'PPE, hygiene facilities, and changing arrangements',
      'Contaminated-clothing handling and reporting'
    ]
  },
  {
    code: 'HC', title: 'Hazard Communication',
    purpose: 'Find, understand, and use chemical-hazard information through labels, safety data sheets, and workplace instructions.',
    lessons: [
      'How hazard communication protects workers', 'Understanding chemical hazards',
      'Understanding a chemical label', 'Understanding workplace labels',
      'Finding the right Safety Data Sheet', 'Reading an SDS without getting lost',
      'Recognizing a release or changed condition', 'Turning information into protective actions',
      'Handling unfamiliar work or chemicals', 'Knowing where to get help'
    ],
    localInstruction: [
      'Actual chemical inventory and workplace labeling', 'SDS access and nonroutine-task procedures',
      'Local controls and emergency arrangements'
    ]
  }
] as const satisfies readonly PreviewCourse[];

/** Requirement codes used by the admin drawer; reference syllabi only. */
export const courseOutlines: Record<string, PreviewCourse> = {
  'respiratory-protection': previewCourses[0],
  'lockout-tagout': previewCourses[1],
  'confined-space': previewCourses[2],
  'chemical-hygiene': previewCourses[3],
  'hazard-communication': previewCourses[4]
};

export const respiratoryCourse = previewCourses[0];
export const previewSteps = [
  'Course introduction', 'Recognize a breathing hazard', 'Know the forms of contamination',
  'Understand what you cannot detect', 'Practice a workplace decision', 'Opening lesson recap'
] as const;

export const breathingHazards = [
  { name: 'Dust', kind: 'Solid particles', explanation: 'Solid material can become airborne when it is handled, cut, ground, or otherwise disturbed.', example: 'Charging dry powder from a bag.' },
  { name: 'Mist', kind: 'Liquid droplets', explanation: 'Spraying or splashing can suspend small liquid droplets in the air.', example: 'Spraying a cleaning solution.' },
  { name: 'Fume', kind: 'Very small solid particles', explanation: 'Heating can turn material into vapor that cools and condenses into fine solid particles. Fume is not another word for gas.', example: 'Metal fume produced by welding.' },
  { name: 'Gas', kind: 'A substance in its gaseous form', explanation: 'Gases mix with the surrounding air. Some are toxic, and some can displace the oxygen you need.', example: 'A nitrogen release into an enclosed area.' },
  { name: 'Vapor', kind: 'The gaseous form of a liquid or solid', explanation: 'A liquid can evaporate into the air, even when you do not see a cloud.', example: 'Solvent evaporating during an open transfer.' }
] as const;

export const scenarioOptions = [
  { id: 'continue', text: 'Continue because the dust cloud has cleared and you feel fine.', feedback: 'A clearing cloud and a lack of symptoms do not show that the exposure is controlled. Some airborne particles are too small to see, and harmful effects may not appear immediately.' },
  { id: 'mask', text: 'Put on a spare dust mask and finish the batch.', feedback: 'Do not choose a respirator yourself to compensate for a failed control. Respiratory protection must match the evaluated hazard and the employer’s program; a spare mask does not establish that the task is safe.' },
  { id: 'stop', text: 'Stop the task, move clear as the site procedure directs, and report the failed exhaust before work resumes.', feedback: 'That addresses the changed condition. Follow the site’s stop-work and reporting instructions. The responsible people must evaluate the problem and establish the controls before the task resumes.' }
] as const;
