/** Opening Respiratory Protection lesson, copied as a draft reference from admin-app. */
export type LessonBlock = {
  kind: 'title' | 'lead' | 'text' | 'context' | 'objective' | 'note' | 'warning' | 'recap' | 'example' | 'hazard';
  text: string;
  title?: string;
  subtitle?: string;
  example?: string;
};

export const draftLesson: Record<number, readonly LessonBlock[]> = {
  0: [
    { kind: 'title', text: 'Respiratory Protection' },
    { kind: 'lead', text: 'Understand what can harm your breathing, how protection works, and what you need to do at work.' },
    { kind: 'context', text: 'Chemical manufacturing teams · 9-lesson course in development' },
    { kind: 'text', title: 'Start with the hazard', text: 'In this opening lesson, you will learn to:' },
    { kind: 'objective', text: 'Recognize particles, gases, and vapors in familiar work activities.' },
    { kind: 'objective', text: 'Explain why clear air and no unusual smell do not prove an area is safe.' },
    { kind: 'objective', text: 'Recognize a changed condition and follow the site’s response instructions.' },
    { kind: 'note', title: 'You’re viewing an early lesson draft.', text: 'Only the opening lesson is available here. Full instruction, demonstrations, narration, and assessment will be developed and reviewed before release.' }
  ],
  1: [
    { kind: 'title', text: 'Breathing hazards can be part of an ordinary task.' },
    { kind: 'lead', text: 'Airborne contamination can reach your lungs when you breathe. A familiar job can still create a harmful exposure.' },
    { kind: 'example', title: 'Production and packaging', text: 'Opening bags, charging a mixer, or filling containers can release material into the air.' },
    { kind: 'text', text: 'A visible cloud is a warning sign; smaller particles may remain after it clears.' },
    { kind: 'example', title: 'Cleaning and maintenance', text: 'Spraying a cleaner, opening process equipment, or welding can create different breathing hazards. A different task may need different controls.' },
    { kind: 'example', title: 'Changeovers and abnormal conditions', text: 'A new material, a ventilation failure, or an unexpected release can change the hazard.' },
    { kind: 'text', text: 'Previous experience with the task is not a substitute for checking the current instructions.' },
    { kind: 'note', title: 'What this means for you', text: 'Before work, know which hazards and controls the site has identified for your task.' },
    { kind: 'text', text: 'If the material, equipment, or conditions do not match the instructions, stop and get the issue resolved.' }
  ],
  2: [
    { kind: 'title', text: 'Not every breathing hazard is a particle.' },
    { kind: 'lead', text: 'The form of the contaminant matters. Protection that filters particles does not automatically protect against gases or vapors.' },
    { kind: 'hazard', title: 'Dust', subtitle: 'Solid particles', text: 'Solid material can become airborne when it is handled, cut, ground, or otherwise disturbed.', example: 'Charging dry powder from a bag.' },
    { kind: 'hazard', title: 'Mist', subtitle: 'Liquid droplets', text: 'Spraying or splashing can suspend small liquid droplets in the air.', example: 'Spraying a cleaning solution.' },
    { kind: 'hazard', title: 'Fume', subtitle: 'Very small solid particles', text: 'Heating can turn material into vapor that cools and condenses into fine solid particles. Fume is not another word for gas.', example: 'Metal fume produced by welding.' },
    { kind: 'hazard', title: 'Gas', subtitle: 'A substance in its gaseous form', text: 'Gases mix with the surrounding air. Some are toxic, and some can displace the oxygen you need.', example: 'A nitrogen release into an enclosed area.' },
    { kind: 'hazard', title: 'Vapor', subtitle: 'The gaseous form of a liquid or solid', text: 'A liquid can evaporate into the air, even when you do not see a cloud.', example: 'Solvent evaporating during an open transfer.' },
    { kind: 'note', title: 'A particle filter does not protect against gases or vapors.', text: 'A particulate-only respirator does not remove gases or vapors.' },
    { kind: 'text', text: 'The employer must evaluate the hazard and select suitable respiratory protection within its program. Do not substitute equipment yourself.' }
  ],
  3: [
    { kind: 'title', text: 'Air can look normal and still be unsafe.' },
    { kind: 'lead', text: 'You cannot establish safe breathing conditions by looking around, taking a sniff, or waiting to see how you feel.' },
    { kind: 'example', title: '“I can’t see anything.”', text: 'Many particles are too small to see. Gases and vapors may also be invisible. Clear-looking air is not an exposure measurement.' },
    { kind: 'example', title: '“There’s no unusual smell.”', text: 'Not all hazards have a useful warning odor. Your ability to notice a smell can also change. No smell does not establish that the air is safe.' },
    { kind: 'text', title: 'A separate hazard: too little oxygen', text: 'Some processes can use up oxygen, and gases such as nitrogen can displace it.' },
    { kind: 'text', text: 'An air-purifying respirator filters surrounding air; it does not supply oxygen.' },
    { kind: 'warning', title: 'Do not enter an area with unknown or suspected oxygen-deficient conditions.', text: 'Stay out, keep clear, and follow the site’s reporting or emergency instructions. Do not enter to investigate or attempt an unplanned rescue.' },
    { kind: 'note', text: 'Later lessons will cover respirator types and their limitations. Respirator selection and atmospheric evaluation are assigned responsibilities, not decisions to improvise during a task.' }
  ],
  5: [
    { kind: 'title', text: 'Recognize the hazard before relying on protection.' },
    { kind: 'lead', text: 'The first step is knowing what may be in the air and recognizing when conditions have changed.' },
    { kind: 'recap', title: 'Know what the task can release.', text: 'Dust, mist, and fume are particles. Gases and vapors need different consideration.' },
    { kind: 'recap', title: 'Do not use your senses as a safety test.', text: 'Clear air, no smell, and no immediate symptoms do not establish safe conditions.' },
    { kind: 'recap', title: 'Know a critical protection limit.', text: 'Air-purifying respirators do not supply oxygen. Stay out of unknown or suspected oxygen-deficient atmospheres.' },
    { kind: 'recap', title: 'Respond to a changed condition.', text: 'Follow the site’s stop-work, reporting, and emergency instructions. Do not improvise a replacement for a failed control.' },
    { kind: 'note', title: 'Next in development: How the workplace controls exposure', text: 'Source controls, ventilation, work practices, and the role of respirators.' },
    { kind: 'note', title: 'End of this draft preview', text: 'This has not completed the course, created a learning record, or established qualification. The remaining lessons and full assessment are still in development.' }
  ]
};

export const draftReferences = [
  { title: 'OSHA · Industrial Hygiene', href: 'https://www.osha.gov/publications/OSHA3143' },
  { title: 'NIOSH · A Guide to Air-Purifying Respirators', href: 'https://www.cdc.gov/niosh/docs/2018-176/' },
  { title: 'OSHA · Respiratory protection standard', href: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.134' },
  { title: 'NIOSH · Confined-space hazards', href: 'https://archive.cdc.gov/www_cdc_gov/niosh/topics/emres/confined.html' }
] as const;
