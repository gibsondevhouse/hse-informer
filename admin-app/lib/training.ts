export const DEMO_DATE = '2026-09-09';
export const STORAGE_KEY = 'hse-informer-admin-preview-v2';
export const sites = [
  { id: 'north', name: 'North Plant', location: 'Greensboro, NC', code: 'NP' },
  {
    id: 'river',
    name: 'Riverbend Facility',
    location: 'Richmond, VA',
    code: 'RF',
  },
  { id: 'west', name: 'West Works', location: 'Columbus, OH', code: 'WW' },
];
export const reasons = [
  'Initial assignment',
  'Required recurring interval',
  'Company recurring policy',
  'New chemical hazard',
  'Equipment or process change',
  'Job or work-area change',
  'Incident or near miss',
  'Observed deficiency or failed evaluation',
  'Qualification renewal',
] as const;
export const courseIds = [
  'respiratory',
  'loto',
  'confined',
  'hygiene',
  'hazcom',
  'electrical',
  'heat',
  'pit',
  'bbp',
  'walking',
] as const;
export type CourseId = (typeof courseIds)[number];
export const legalStatuses = [
  'Federal regulatory requirement',
  'State-specific requirement',
  'Permit-specific requirement',
  'Employer-program requirement',
  'Consensus-standard-based',
  'Recommended practice',
  'General awareness',
] as const;
export type LegalStatus = (typeof legalStatuses)[number];
export type RecurrenceKind =
  | 'annual'
  | 'three-year-evaluation'
  | 'event-driven'
  | 'employer-defined';
export type Regulatory = {
  authority: string;
  paragraphs: string[];
  legalStatus: LegalStatus;
  appliesWhen: string;
  retrainingTriggers: string[];
  recurrence: { kind: RecurrenceKind; summary: string };
  competency?: string;
  records: string[];
  notes?: string[];
  references: { label: string; href: string }[];
};
export const cadences = [
  'Annual (required)',
  'Every three years (evaluation)',
  'Event-driven',
  'Annual company policy',
  'Interval to be determined',
] as const;
export type Cadence = (typeof cadences)[number];
export function defaultCadence(course: Course): Cadence {
  switch (course.regulatory?.recurrence.kind) {
    case 'annual':
      return 'Annual (required)';
    case 'three-year-evaluation':
      return 'Every three years (evaluation)';
    case 'event-driven':
      return 'Event-driven';
    default:
      return 'Interval to be determined';
  }
}
const osha = (standard: string) =>
  `https://www.osha.gov/laws-regs/regulations/standardnumber/1910/${standard}`;
export type Course = {
  id: CourseId;
  name: string;
  code: string;
  accent: string;
  previewPath?: string;
  unitLabel?: string;
  purpose: string;
  lessons: string[];
  local: string[];
  authorizationPrerequisites?: string[];
  regulatory?: Regulatory;
  reviewNote?: string;
};
export const courses: Course[] = [
  {
    id: 'respiratory',
    name: 'Respiratory Protection',
    code: 'RP',
    accent: 'blue',
    previewPath: '/training/respiratory-protection',
    unitLabel: 'modules',
    purpose:
      'Respiratory hazards, how respirators protect, and responsibilities within a respiratory protection program.',
    lessons: [
      'Respiratory hazards and program scope',
      'Assigned respirators, selection, and limitations',
      'Donning, doffing, inspection, and user seal checks',
      'Routine use and work practices',
      'Maintenance, cleaning, storage, and replacement',
      'Emergency response and respirator malfunction',
      'Medical signs, training requirements, and retraining',
    ],
    local: [
      'Site respiratory-protection program, task hazards, selected equipment, and emergency procedures',
      'Assigned filters/cartridges, objective change schedule, cleaning, storage, and defect reporting',
      'Medical-clearance and fit-test coordination, practical demonstration, and program-administrator contacts',
    ],
    authorizationPrerequisites: [
      'Employer hazard assessment and selection of a suitable NIOSH-certified respirator for the task.',
      'Medical evaluation and written PLHCP recommendation before fit testing or required use; retain status, not questionnaire answers, in the LMS.',
      'Understandable initial and annual training before required use, with retraining when conditions, respirators, knowledge, or use require it.',
      'For tight-fitting facepieces, a passed fit test for the exact make, model, style, and size before use; repeat at least annually and after applicable changes.',
      'The employer verifies current prerequisites, issues the selected equipment, and authorizes its use for defined tasks; course completion alone does not authorize wear.',
    ],
    regulatory: {
      authority: '29 CFR 1910.134',
      paragraphs: [
        '(a)',
        '(c)',
        '(d)',
        '(e)',
        '(f)',
        '(g)',
        '(h)',
        '(i) where atmosphere-supplying respirators are used',
        '(j)',
        '(k)',
        '(l)',
        '(m)',
      ],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Required respirator use; voluntary use has different Appendix D and program duties. Confirm the user, model, exposure, and task.',
      retrainingTriggers: [
        'At least annually, no later than the anniversary of prior training',
        'Workplace or respirator-type changes that make prior training obsolete',
        'Inadequate knowledge or use, or another condition indicating retraining is needed for safe use',
      ],
      recurrence: {
        kind: 'annual',
        summary:
          'At least annually for required users; more often when needed.',
      },
      competency:
        'OSHA requires each employee to demonstrate knowledge of the subjects in 1910.134(k)(1). Hands-on practice and documented task-specific observation are strong program controls; fit-test procedures also require respirator donning and a user seal check. Medical evaluation and fit testing remain separate prerequisites.',
      records: [
        'Current written program and documented training content/version, date, language, and knowledge evidence',
        'Medical-evaluation records retained under 1910.1020; keep questionnaire responses confidential and separate from training records',
        'Fit-test record: employee, test type, make/model/style/size, date, and result; retain until the next fit test',
        'Program evaluation findings and corrective-action evidence under the employer retention policy',
      ],
      notes: [
        'Training completion does not establish medical clearance, fit-test status, respirator selection, equipment issuance, or task authorization.',
        'For voluntary use, distinguish filtering facepieces (Appendix D) from other respirators, which require applicable medical and maintenance safeguards.',
      ],
      references: [
        { label: 'OSHA · 29 CFR 1910.134', href: osha('1910.134') },
        {
          label: 'OSHA · Appendix A: Fit Testing Procedures',
          href: `${osha('1910.134')}AppA`,
        },
        {
          label: 'OSHA · Appendix B-1: User Seal Check Procedures',
          href: `${osha('1910.134')}AppB1`,
        },
        {
          label: 'OSHA · Appendix D: Voluntary Use Information',
          href: `${osha('1910.134')}AppD`,
        },
        {
          label: 'OSHA · Annual training and fit-test timing interpretation',
          href: 'https://www.osha.gov/laws-regs/standardinterpretations/1998-12-23',
        },
        {
          label: 'OSHA · Required versus voluntary N95 use interpretation',
          href: 'https://www.osha.gov/laws-regs/standardinterpretations/2009-07-14-0',
        },
        {
          label: 'NIOSH · Respirator Selection and Use',
          href: 'https://www.cdc.gov/niosh/ppe/respirators/selection.html',
        },
      ],
    },
  },
  {
    id: 'loto',
    name: 'Lockout/Tagout',
    code: 'LOTO',
    accent: 'amber',
    purpose:
      'Hazardous energy, why shutdown is not isolation, and the responsibilities of different employee groups.',
    lessons: [
      'How equipment can hurt someone unexpectedly',
      'The different forms of hazardous energy',
      'When hazardous-energy control matters',
      'Who does what',
      'Stopping versus isolating equipment',
      'How the energy-control process works',
      'What locks and tags communicate',
      'Maintaining protection during changes',
      'Returning equipment to service',
    ],
    local: [
      'Equipment-specific procedures and isolation points',
      'Group lockout and shift-change arrangements',
      'Role-specific instruction and employer authorization',
    ],
    regulatory: {
      authority: '29 CFR 1910.147',
      paragraphs: ['(c)(1)', '(c)(4)', '(c)(6)', '(c)(7)'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Servicing or maintenance where unexpected energization, startup, or stored-energy release could injure employees; role-specific instruction applies.',
      retrainingTriggers: [
        'Job, equipment, process, or procedure change',
        'Inspection finding',
        'Observed deviation or knowledge gap',
      ],
      recurrence: {
        kind: 'event-driven',
        summary:
          'Retrain after specified changes or deficiencies. Annual procedure inspection is not automatic annual retraining.',
      },
      competency:
        'Verify authorized employees can use the actual equipment-specific isolation and control procedure.',
      records: [
        'Employee names and training dates',
        'Energy-control procedures',
        'Annual periodic-inspection certifications',
      ],
      references: [{ label: 'OSHA · 29 CFR 1910.147', href: osha('1910.147') }],
    },
  },
  {
    id: 'confined',
    name: 'Confined Space',
    code: 'CS',
    accent: 'purple',
    purpose:
      'Confined-space hazards, entry safeguards, team responsibilities, and emergency boundaries.',
    lessons: [
      'Recognizing a confined space',
      'Understanding permit-required spaces',
      'Understanding what counts as entry',
      'Atmospheric hazards',
      'Other serious hazards',
      'How entry is planned and controlled',
      'Understanding air testing',
      'Understanding entry-team responsibilities',
      'Recognizing when entry must stop',
      'Responding to an emergency',
    ],
    local: [
      'Space inventory, permits, and isolation methods',
      'Air testing, communication, and entry equipment',
      'Assigned roles and site rescue arrangements',
    ],
    regulatory: {
      authority: '29 CFR 1910.146',
      paragraphs: ['(g)'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Employees with duties in a permit-required confined-space program; role and actual space determine training.',
      retrainingTriggers: [
        'New duty',
        'Permit-space operation change',
        'Observed deficiency',
      ],
      recurrence: {
        kind: 'event-driven',
        summary:
          'Before assigned duties and again when duties, operations, or demonstrated understanding change.',
      },
      competency:
        'Verify proficiency in assigned entry, attendant, supervisor, or rescue duties as applicable.',
      records: [
        'Training certification with employee, trainer, and date',
        'Site permits and role-specific records',
      ],
      notes: [
        'This subject was in the existing library and vision document, but not in the supplied source map. Domain review is still required.',
      ],
      references: [{ label: 'OSHA · 29 CFR 1910.146', href: osha('1910.146') }],
    },
  },
  {
    id: 'hygiene',
    name: 'Chemical Hygiene',
    code: 'CH',
    accent: 'teal',
    purpose:
      'Chemical-exposure prevention and contamination control in everyday manufacturing work.',
    lessons: [
      'How chemicals reach the body',
      'How exposure can affect health',
      'Where exposure happens during work',
      'How exposure is controlled',
      'Protecting skin and eyes',
      'Keeping contamination out of clean areas',
      'Handling contaminated clothing and equipment',
      'Housekeeping and cleaning without spreading contamination',
      'Responding to suspected exposure',
      'Recognizing when the normal method is no longer adequate',
    ],
    local: [
      'Local exposure concerns and approved cleaning methods',
      'PPE, hygiene facilities, and changing arrangements',
      'Contaminated-clothing handling and reporting',
    ],
    reviewNote:
      'The existing syllabus covers production chemical-exposure prevention. 29 CFR 1910.1450 applies to qualifying laboratory use, so its citation cannot be assigned to this production course without a domain review and scope decision.',
  },
  {
    id: 'hazcom',
    name: 'Hazard Communication',
    code: 'HC',
    accent: 'orange',
    purpose:
      'Find, understand, and use chemical-hazard information through labels, safety data sheets, and workplace instructions.',
    lessons: [
      'How hazard communication protects workers',
      'Understanding chemical hazards',
      'Understanding a chemical label',
      'Understanding workplace labels',
      'Finding the right Safety Data Sheet',
      'Reading an SDS without getting lost',
      'Recognizing a release or changed condition',
      'Turning information into protective actions',
      'Handling unfamiliar work or chemicals',
      'Knowing where to get help',
    ],
    local: [
      'Actual chemical inventory and workplace labeling',
      'SDS access and nonroutine-task procedures',
      'Local controls and emergency arrangements',
    ],
    regulatory: {
      authority: '29 CFR 1910.1200',
      paragraphs: ['(e)', '(f)', '(g)', '(h)'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Employees may be exposed to hazardous chemicals during normal work or a foreseeable emergency.',
      retrainingTriggers: [
        'Initial assignment',
        'New chemical hazard not previously covered',
        'Newly identified hazards under the revised rule',
      ],
      recurrence: {
        kind: 'event-driven',
        summary:
          'Initial assignment and each newly introduced chemical hazard; no blanket federal annual interval.',
      },
      records: [
        'Written HazCom program',
        'Chemical inventory and SDS access',
        'Labels and training evidence',
      ],
      notes: [
        'November 20, 2026: review necessary workplace-label, written-program, and additional training updates for newly identified hazards under the revised rule. Confirm site applicability before deployment.',
      ],
      references: [
        { label: 'OSHA · 29 CFR 1910.1200', href: osha('1910.1200') },
      ],
    },
  },
  {
    id: 'electrical',
    name: 'Electrical Safety',
    code: 'ES',
    accent: 'gold',
    purpose:
      'Recognize electrical hazards and follow the safe-work practices assigned to qualified and unqualified employees.',
    lessons: [
      'Recognizing shock, arc, and fire hazards',
      'Who may perform electrical work',
      'Damaged cords, wet locations, and temporary power',
      'Panel clearance and electrical-room access',
      'Deenergization and verification',
      'Electrical work and hazardous-energy control',
      'Guarding, approach, and protective equipment',
      'Responding to a defect or incident',
      'Qualified-person skills and boundaries',
    ],
    local: [
      'Site electrical-safe-work procedures and authorized duties',
      'Actual equipment, voltage, and protective-equipment verification',
      'NFPA 70E qualified-person layer as a separate consensus-standard overlay',
    ],
    regulatory: {
      authority: '29 CFR 1910.331–1910.335',
      paragraphs: ['1910.332(a)', '1910.332(b)', '1910.333'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Employees face electrical shock risk not reduced to a safe level by installation requirements; qualified-person depth depends on assigned work.',
      retrainingTriggers: [
        'Job or equipment change',
        'Changed safe-work practices',
        'Incident, near miss, or observed deficiency',
      ],
      recurrence: {
        kind: 'event-driven',
        summary:
          'No blanket annual interval in 1910.332; reassess after changes or lost proficiency.',
      },
      competency:
        'Qualified persons must demonstrate live-part recognition, voltage determination, and applicable clearance skills for their duties.',
      records: [
        'Role and qualification evidence',
        'Site procedures and task-specific evaluations',
      ],
      notes: [
        'NFPA 70E is a consensus-standard overlay, not the OSHA citation for this course.',
      ],
      references: [
        { label: 'OSHA · 29 CFR 1910.332', href: osha('1910.332') },
        { label: 'OSHA · 29 CFR 1910.333', href: osha('1910.333') },
      ],
    },
  },
  {
    id: 'heat',
    name: 'Heat and Thermal Stress',
    code: 'HT',
    accent: 'coral',
    purpose:
      'Recognize heat illness, apply the employer’s prevention plan, and respond promptly to symptoms.',
    lessons: [
      'Where heat exposure occurs',
      'How work and PPE increase heat load',
      'Recognizing early heat illness',
      'Heat stroke as a medical emergency',
      'Hydration and recovery areas',
      'Acclimatization and return after absence',
      'Buddy observation and supervisor checks',
      'Work-rest and exposure controls',
      'Reporting symptoms and activating emergency response',
    ],
    local: [
      'Site heat-illness prevention and escalation plan',
      'Work-area exposure assessment, monitoring, and controls',
      'Supervisor briefings, acclimatization, and emergency contacts',
    ],
    regulatory: {
      authority: 'OSH Act §5(a)(1) General Duty Clause',
      paragraphs: ['§5(a)(1)'],
      legalStatus: 'Employer-program requirement',
      appliesWhen:
        'Recognized indoor or outdoor heat exposures capable of causing serious harm; employer assessment controls assignment.',
      retrainingTriggers: [
        'Hot-weather or hot-process assignment',
        'Changed conditions or controls',
        'Incident or observed knowledge gap',
      ],
      recurrence: {
        kind: 'employer-defined',
        summary:
          'Set by the employer heat program; this is not a 1910 annual-training mandate.',
      },
      records: [
        'Heat program and hazard assessment',
        'Training and acclimatization evidence',
        'Monitoring and response records as applicable',
      ],
      notes: [
        'Planning label reflects the General Duty Clause and employer program. Confirm the current regulatory position before release.',
      ],
      references: [
        {
          label: 'OSHA · General Duty Clause',
          href: 'https://www.osha.gov/laws-regs/oshact/section5-duties',
        },
        { label: 'OSHA · Heat', href: 'https://www.osha.gov/heat-exposure' },
      ],
    },
  },
  {
    id: 'pit',
    name: 'Powered Industrial Trucks',
    code: 'PIT',
    accent: 'slate',
    purpose:
      'Learn truck hazards and site controls before practical training and workplace performance evaluation.',
    lessons: [
      'Operator duties and truck types',
      'Controls, warnings, and limitations',
      'Stability, capacity, and data plates',
      'Travel, turning, and visibility',
      'Load handling and stacking',
      'Pedestrians and site traffic',
      'Ramps, docks, trailers, and racks',
      'Fuel, charging, and hazardous locations',
      'Pre-use inspection and out-of-service decisions',
      'Supervised practice and field evaluation',
    ],
    local: [
      'Truck- and attachment-specific supervised practical training',
      'Actual workplace driving and load-handling evaluation',
      'Site traffic plan, inspections, and operator authorization',
    ],
    regulatory: {
      authority: '29 CFR 1910.178',
      paragraphs: ['(l)(1)–(6)'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Before operating a powered industrial truck except as a supervised trainee; equipment and workplace determine content.',
      retrainingTriggers: [
        'Unsafe operation or evaluation',
        'Accident or near miss',
        'Different truck type',
        'Changed workplace conditions',
      ],
      recurrence: {
        kind: 'three-year-evaluation',
        summary:
          'Evaluate operator performance at least every three years; this is an evaluation interval, not automatic retraining.',
      },
      competency:
        'Formal instruction, practical exercises, and workplace performance evaluation by a qualified trainer/evaluator.',
      records: [
        'Operator name',
        'Training and evaluation dates',
        'Trainer/evaluator identity',
      ],
      references: [
        { label: 'OSHA · 29 CFR 1910.178(l)', href: osha('1910.178') },
      ],
    },
  },
  {
    id: 'bbp',
    name: 'Bloodborne Pathogens',
    code: 'BBP',
    accent: 'rose',
    purpose:
      'Prevent and respond to occupational exposure to blood and other potentially infectious materials.',
    lessons: [
      'Who has occupational exposure',
      'Bloodborne disease and transmission',
      'Exposure Control Plan and universal precautions',
      'Recognizing exposure tasks',
      'Engineering and work-practice controls',
      'Sharps, PPE, and hand hygiene',
      'Cleaning, laundry, and regulated waste',
      'Hepatitis B vaccination',
      'Exposure incident and post-exposure steps',
      'Interactive questions and reporting',
    ],
    local: [
      'Exposure determination and site Exposure Control Plan',
      'Actual PPE, sharps, decontamination, and disposal procedures',
      'Vaccination, reporting, and post-exposure contacts',
    ],
    regulatory: {
      authority: '29 CFR 1910.1030',
      paragraphs: ['(c)', '(f)', '(g)(2)', '(h)(2)'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Only employees with reasonably anticipated occupational exposure to blood or OPIM as part of assigned duties.',
      retrainingTriggers: [
        'Annual interval',
        'New or changed task or procedure creating exposure',
      ],
      recurrence: {
        kind: 'annual',
        summary:
          'At initial assignment and at least annually thereafter, within one year of previous training.',
      },
      competency:
        'Provide an opportunity for interactive questions and answers with a knowledgeable person.',
      records: [
        'Training date and content',
        'Trainer qualifications',
        'Attendee names and job titles',
        'Retain training records for three years',
      ],
      references: [
        { label: 'OSHA · 29 CFR 1910.1030', href: osha('1910.1030') },
      ],
    },
  },
  {
    id: 'walking',
    name: 'Walking-Working Surfaces',
    code: 'WWS',
    accent: 'moss',
    purpose:
      'Recognize surface and fall hazards, use covered equipment, and apply task-specific fall protection.',
    lessons: [
      'Walking-surface hazards in a chemical plant',
      'Housekeeping, inspection, and repair',
      'Stairs, ladders, platforms, and openings',
      'Dockboards and loading areas',
      'Recognizing covered fall hazards',
      'Selecting fall-protection controls',
      'Inspecting and using personal fall protection',
      'Hookup, anchoring, and tie-off',
      'Equipment care and storage',
      'Retraining after changes or skill gaps',
    ],
    local: [
      'Actual surfaces, fall hazards, and inspection/repair process',
      'Qualified-person instruction on assigned fall-protection systems',
      'Dockboard, designated-area, or rope-descent procedures where applicable',
    ],
    regulatory: {
      authority: '29 CFR 1910 Subpart D',
      paragraphs: ['1910.22', '1910.30(a)–(d)'],
      legalStatus: 'Federal regulatory requirement',
      appliesWhen:
        'Specific 1910.30 training applies to employees using covered fall-protection systems or equipment; broad surface awareness may be employer policy.',
      retrainingTriggers: [
        'Workplace change',
        'Fall-protection system or equipment change',
        'Knowledge or skill inadequacy',
      ],
      recurrence: {
        kind: 'event-driven',
        summary:
          'Before covered exposure or equipment use; retrain when prior understanding or skill becomes inadequate.',
      },
      competency:
        'Qualified-person training and correct use of assigned equipment in a manner the employee understands.',
      records: [
        'Site inspection and repair evidence',
        'Covered training and qualification evidence',
      ],
      references: [
        { label: 'OSHA · 29 CFR 1910.22', href: osha('1910.22') },
        { label: 'OSHA · 29 CFR 1910.30', href: osha('1910.30') },
      ],
    },
  },
];
export type Learner = {
  id: string;
  name: string;
  siteId: string;
  group: string;
};
const names = [
  'Avery Morgan',
  'Jordan Ellis',
  'Taylor Brooks',
  'Cameron Lee',
  'Riley Bennett',
  'Morgan Davis',
  'Casey Rivera',
  'Parker Wilson',
  'Drew Sullivan',
  'Jamie Carter',
  'Quinn Foster',
  'Alex Reynolds',
  'Sam Mitchell',
  'Blake Cooper',
  'Reese Anderson',
  'Robin Hayes',
  'Devon Parker',
  'Skyler Reed',
  'Emerson Clark',
  'Rowan Kelly',
  'Finley Adams',
  'Charlie Ross',
  'Hayden Price',
  'Dakota Bell',
  'Logan Walker',
  'Harper Scott',
  'Kendall Wright',
  'Bailey Evans',
  'Jesse Turner',
  'Payton Green',
  'Sage Collins',
  'Kerry Ward',
  'Arden James',
  'Remy Lewis',
  'Shawn King',
  'Lee Murphy',
];
export const learners: Learner[] = names.map((name, i) => ({
  id: `person-${i + 1}`,
  name,
  siteId: sites[Math.floor(i / 12)].id,
  group: ['Production', 'Maintenance', 'Warehouse'][i % 3],
}));
export type Assignment = {
  id: string;
  learnerId: string;
  courseId: string;
  due: string;
  assigned: string;
  status: 'Not started' | 'In progress' | 'Knowledge Complete';
  reason: string;
  cadence: string;
  version: string;
};
export const seedAssignments: Assignment[] = learners.flatMap((person, i) =>
  courses
    .filter((_, c) => (i + c) % 7 !== 0)
    .map((course, c) => ({
      id: `sample-${person.id}-${course.id}`,
      learnerId: person.id,
      courseId: course.id,
      due:
        (i + c) % 11 === 0
          ? '2026-09-04'
          : (i + c) % 4 === 0
            ? '2026-09-16'
            : '2026-09-30',
      assigned: '2026-08-24',
      status:
        (i * 3 + c) % 10 < 7
          ? 'Knowledge Complete'
          : (i + c) % 2 === 0
            ? 'In progress'
            : 'Not started',
      reason: i % 2 ? 'Initial assignment' : 'Company recurring policy',
      cadence: defaultCadence(course),
      version: 'Foundation preview',
    })),
);
export function scopedAssignments(records: Assignment[], siteId: string) {
  const ids = new Set(
    learners
      .filter((p) => siteId === 'all' || p.siteId === siteId)
      .map((p) => p.id),
  );
  return records.filter((record) => ids.has(record.learnerId));
}
export function isOverdue(record: Assignment) {
  return record.status !== 'Knowledge Complete' && record.due < DEMO_DATE;
}
export const assignmentStatuses = [
  { key: 'not-started', label: 'Not started' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'complete', label: 'Knowledge Complete' },
  { key: 'overdue', label: 'Overdue' },
] as const;
export type AssignmentStatusKey = (typeof assignmentStatuses)[number]['key'];

/** Overdue takes precedence so every assignment belongs to exactly one group. */
export function assignmentStatus(record: Assignment): AssignmentStatusKey {
  if (isOverdue(record)) return 'overdue';
  if (record.status === 'Knowledge Complete') return 'complete';
  return record.status === 'In progress' ? 'in-progress' : 'not-started';
}

export function summarizeAssignmentStatuses(records: Assignment[]) {
  const counts: Record<AssignmentStatusKey, number> = {
    'not-started': 0,
    'in-progress': 0,
    complete: 0,
    overdue: 0,
  };
  for (const record of records) counts[assignmentStatus(record)] += 1;
  return assignmentStatuses.map((status) => ({
    ...status,
    count: counts[status.key],
    percent: records.length
      ? Math.round((counts[status.key] / records.length) * 100)
      : 0,
  }));
}
export function isDueSoon(record: Assignment) {
  return (
    record.status !== 'Knowledge Complete' &&
    record.due >= DEMO_DATE &&
    record.due <= '2026-10-09'
  );
}

export type AssignmentSortKey =
  | 'learner'
  | 'site'
  | 'course'
  | 'reason'
  | 'status'
  | 'due';
export type AssignmentSort = {
  key: AssignmentSortKey;
  direction: 'asc' | 'desc';
};
const assignmentCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});
const learnerById = new Map(learners.map((person) => [person.id, person]));
const courseById = new Map<string, Course>(
  courses.map((course) => [course.id, course]),
);
const siteById = new Map(sites.map((site) => [site.id, site]));

/** Sort the complete filtered set before pagination; never mutate saved records. */
export function sortAssignments(
  records: Assignment[],
  sort: AssignmentSort,
): Assignment[] {
  const name = (record: Assignment) =>
    learnerById.get(record.learnerId)?.name ?? '';
  const courseName = (record: Assignment) =>
    courseById.get(record.courseId)?.name ?? '';
  const value = (record: Assignment): string | number => {
    switch (sort.key) {
      case 'learner':
        return name(record);
      case 'site':
        return (
          siteById.get(learnerById.get(record.learnerId)?.siteId ?? '')?.name ??
          ''
        );
      case 'course':
        return courseName(record);
      case 'reason':
        return record.reason;
      case 'status':
        return isOverdue(record)
          ? 0
          : record.status === 'Not started'
            ? 1
            : record.status === 'In progress'
              ? 2
              : 3;
      case 'due':
        return record.due;
    }
  };
  return [...records].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    const primary =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : assignmentCollator.compare(String(left), String(right));
    return (
      primary * (sort.direction === 'asc' ? 1 : -1) ||
      assignmentCollator.compare(name(a), name(b)) ||
      assignmentCollator.compare(courseName(a), courseName(b)) ||
      a.due.localeCompare(b.due) ||
      assignmentCollator.compare(a.id, b.id)
    );
  });
}
export function summarize(records: Assignment[]) {
  const complete = records.filter(
    (r) => r.status === 'Knowledge Complete',
  ).length;
  return {
    total: records.length,
    people: new Set(records.map((r) => r.learnerId)).size,
    incompletePeople: new Set(
      records
        .filter((r) => r.status !== 'Knowledge Complete')
        .map((r) => r.learnerId),
    ).size,
    complete,
    percent: records.length ? Math.round((complete / records.length) * 100) : 0,
    overdue: records.filter(isOverdue).length,
    dueSoon: records.filter(isDueSoon).length,
  };
}
export function eligibleLearners(
  records: Assignment[],
  courseId: string,
  siteIds: string[],
  group: string,
) {
  return learners.filter(
    (person) =>
      siteIds.includes(person.siteId) &&
      (group === 'All employees' || person.group === group) &&
      !records.some(
        (record) =>
          record.learnerId === person.id &&
          record.courseId === courseId &&
          record.status !== 'Knowledge Complete',
      ),
  );
}
export function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
export function isAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== 'object') return false;
  const r = value as Assignment;
  return (
    typeof r.id === 'string' &&
    learners.some((p) => p.id === r.learnerId) &&
    courses.some((c) => c.id === r.courseId) &&
    ['Not started', 'In progress', 'Knowledge Complete'].includes(r.status) &&
    [r.due, r.assigned].every(
      (d) =>
        typeof d === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        !Number.isNaN(Date.parse(d)),
    ) &&
    typeof r.reason === 'string' &&
    typeof r.cadence === 'string' &&
    typeof r.version === 'string'
  );
}
