export const DEMO_DATE = '2026-09-09';
export const STORAGE_KEY = 'hse-informer-admin-preview-v1';
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
  'Onboarding',
  'Company recurring policy',
  'Required recurring training',
  'Change in work or hazards',
  'Knowledge or performance gap',
] as const;
export type Course = {
  id: string;
  name: string;
  code: string;
  accent: string;
  previewPath?: string;
  purpose: string;
  lessons: string[];
  local: string[];
};
export const courses: Course[] = [
  {
    id: 'respiratory',
    name: 'Respiratory Protection',
    code: 'RP',
    accent: 'blue',
    previewPath: '/training/respiratory-protection',
    purpose:
      'Respiratory hazards, how respirators protect, and responsibilities within a respiratory protection program.',
    lessons: [
      'What can harm your breathing',
      'How the workplace controls exposure',
      'How the respiratory protection program works',
      'What different respirators do',
      'Filters, cartridges, and protection limits',
      'Medical evaluation, fit testing, and seal checks',
      'Inspecting and wearing a respirator',
      'Cleaning, storage, and replacement',
      'Recognizing trouble and responding',
    ],
    local: [
      'Assigned respirators and task-specific hazards',
      'Cartridge schedules, cleaning, and storage',
      'Medical evaluation, fit testing, and local contacts',
    ],
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
      reason: i % 2 ? 'Onboarding' : 'Company recurring policy',
      cadence: 'One-time assignment',
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
const courseById = new Map(courses.map((course) => [course.id, course]));
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
