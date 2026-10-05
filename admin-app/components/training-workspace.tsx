'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import './training-summary.css';
import { CompletionBreakdown } from '@/components/completion-breakdown';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Droplets,
  FlaskConical,
  Footprints,
  Forklift,
  GraduationCap,
  Info,
  Layers3,
  LockKeyhole,
  Pencil,
  Play,
  Plus,
  Sandwich,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  Users,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  courses,
  sites,
  learners,
  reasons,
  cadences,
  defaultCadence,
  seedAssignments,
  summarize,
  scopedAssignments,
  isOverdue,
  isDueSoon,
  eligibleLearners,
  formatDate,
  isAssignment,
  sortAssignments,
  assignmentStatus,
  assignmentStatuses,
  STORAGE_KEY,
  DEMO_DATE,
  type Assignment,
  type Course,
  type CourseId,
  type AssignmentSort,
  type AssignmentSortKey,
  type AssignmentStatusKey,
} from '@/lib/training';
import { estimatedMinutes, lessonOrder } from '@/lib/lms/engine';
import { pbjCourse } from '@/lib/lms/pbj-course';

const practiceLessons = lessonOrder(pbjCourse);
const courseIcons: Record<CourseId, LucideIcon> = {
  respiratory: Wind,
  loto: LockKeyhole,
  confined: Layers3,
  hygiene: FlaskConical,
  hazcom: BookOpen,
  electrical: Zap,
  heat: Thermometer,
  pit: Forklift,
  bbp: Droplets,
  walking: Footprints,
};
type View = 'programs' | 'assignments' | 'sites' | 'library';
type StatusFilter = 'all' | 'due' | 'open' | AssignmentStatusKey;

const assignmentSortLabels: Record<AssignmentSortKey, string> = {
  learner: 'Learner',
  site: 'Site',
  course: 'Course',
  reason: 'Assignment reason',
  status: 'Status',
  due: 'Due date',
};

function AssignmentSortHeader({
  fields,
  sort,
  onSort,
}: {
  fields: AssignmentSortKey[];
  sort: AssignmentSort;
  onSort: (key: AssignmentSortKey) => void;
}) {
  const active = fields.includes(sort.key);
  return (
    <TableHead
      scope="col"
      aria-sort={
        active
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
    >
      <div className="assignment-sort-heading">
        {fields.map((key, index) => {
          const selected = key === sort.key;
          const nextDirection =
            selected && sort.direction === 'asc' ? 'descending' : 'ascending';
          const Icon = selected
            ? sort.direction === 'asc'
              ? ArrowUp
              : ArrowDown
            : ArrowUpDown;
          return (
            <span key={key}>
              {index > 0 && (
                <span className="sort-heading-divider" aria-hidden="true">
                  /
                </span>
              )}
              <button
                type="button"
                className={`assignment-sort-button ${selected ? 'is-sorted' : ''}`}
                onClick={() => onSort(key)}
                aria-label={`Sort by ${assignmentSortLabels[key].toLowerCase()}, ${nextDirection}`}
                title={`Sort by ${assignmentSortLabels[key].toLowerCase()}, ${nextDirection}`}
              >
                {assignmentSortLabels[key]}
                <Icon size={13} aria-hidden="true" />
              </button>
            </span>
          );
        })}
      </div>
    </TableHead>
  );
}

function Picker({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={(value) => value && onChange(value)}>
      <SelectTrigger id={id} className="picker" aria-label={label}>
        <SelectValue>
          {options.find((o) => o.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CourseIcon({
  course,
  small = false,
}: {
  course: Course;
  small?: boolean;
}) {
  const Icon = courseIcons[course.id];
  return (
    <span className={`course-icon ${course.accent} ${small ? 'small' : ''}`}>
      <Icon aria-hidden="true" size={small ? 19 : 23} strokeWidth={1.7} />
    </span>
  );
}

function Navigation({
  view,
  navigate,
  onHelp,
}: {
  view: View;
  navigate: (view: View) => void;
  onHelp: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  const nav = (next: View) => {
    navigate(next);
    setOpenMobile(false);
  };
  return (
    <Sidebar className="app-sidebar" collapsible="offcanvas">
      <SidebarHeader className="brand">
        <span className="brand-mark">
          <ShieldCheck size={26} strokeWidth={1.8} />
        </span>
        <span>
          HSE <b>Informer</b>
          <small>ADMIN WORKSPACE</small>
        </span>
      </SidebarHeader>
      <SidebarContent>
        <div className="organization">
          <span className="org-icon">
            <Building2 size={19} />
          </span>
          <div>
            Demo organization<small>Manufacturing & operations</small>
          </div>
        </div>
        <nav aria-label="Administration" className="nav-section">
          <p>WORKSPACE</p>
          {(
            [
              {
                id: 'programs',
                icon: GraduationCap,
                title: 'Training programs',
              },
              { id: 'assignments', icon: ClipboardList, title: 'Assignments' },
              { id: 'sites', icon: Building2, title: 'Sites' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => nav(item.id)}
            >
              <item.icon size={19} />
              {item.title}
              {item.id === 'sites' && <span className="nav-count">3</span>}
            </button>
          ))}
          <p className="nav-heading">CONTENT</p>
          <button
            className={`nav-item ${view === 'library' ? 'active' : ''}`}
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => nav('library')}
          >
            <BookOpen size={19} />
            Course library<span className="nav-count">{courses.length}</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="mini-label">COURSE LIBRARY</span>
          <h3>One strong foundation.</h3>
          <p>
            {courses.length} course foundations.
            <br />
            Consistent training across every site.
          </p>
          <button onClick={() => nav('library')}>
            Explore the courses <ArrowRight size={15} />
          </button>
        </div>
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <button className="nav-item" onClick={onHelp}>
          <CircleHelp size={19} />
          About this preview
        </button>
        <div className="profile">
          <span className="avatar">SA</span>
          <div>
            Site administrator<small>Demo workspace</small>
          </div>
          <span className="profile-dot" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function TrainingWorkspace() {
  const [view, setView] = useState<View>('programs');
  const [assignmentPanel, setAssignmentPanel] = useState<
    'records' | 'completion'
  >('records');
  const [site, setSite] = useState('all');
  const [records, setRecords] = useState<Assignment[]>(seedAssignments);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [limit, setLimit] = useState(20);
  const [assignmentSort, setAssignmentSort] = useState<AssignmentSort>({
    key: 'due',
    direction: 'asc',
  });
  const [detail, setDetail] = useState<Course | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCourse, setAssignCourse] = useState(courses[0].id);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [editDue, setEditDue] = useState('');
  const [editError, setEditError] = useState('');
  const returnFocus = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const storageSnapshot = useRef<string | null>(null);

  useEffect(() => {
    function restore() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        storageSnapshot.current = saved;
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (
            Array.isArray(parsed) &&
            parsed.every(isAssignment) &&
            new Set(parsed.map((r) => r.id)).size === parsed.length
          )
            setRecords(parsed);
          else
            setNotice(
              'Saved preview data could not be read. Showing the original sample records.',
            );
        } else setRecords(seedAssignments);
      } catch {
        setNotice(
          'Browser storage is unavailable. You can explore the sample records, but changes may not save.',
        );
      }
      setLoaded(true);
    }
    const timer = window.setTimeout(restore, 0);
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) restore();
    };
    window.addEventListener('storage', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function persist(next: Assignment[]): boolean {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== storageSnapshot.current) {
        setNotice(
          'This workspace changed in another tab. Close this form and reload before saving to preserve the newer changes.',
        );
        return false;
      }
      const serialized = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, serialized);
      storageSnapshot.current = serialized;
      setRecords(next);
      return true;
    } catch {
      setNotice(
        'Your change was not saved. Browser storage is unavailable; please allow storage and try again.',
      );
      return false;
    }
  }
  const scoped = scopedAssignments(records, site);
  const stats = summarize(scoped);
  const scopeName =
    site === 'all' ? 'All sites' : sites.find((s) => s.id === site)!.name;
  const siteCount = site === 'all' ? sites.length : 1;
  const captureFocus = () => {
    returnFocus.current = document.activeElement as HTMLElement;
  };
  function navigate(next: View) {
    setView(next);
    setAssignmentPanel('records');
    setQuery('');
    setFilter('all');
    setCourseFilter('all');
    setLimit(20);
    requestAnimationFrame(() => headingRef.current?.focus());
  }
  function showAssignments(status: StatusFilter = 'all', courseId = 'all') {
    navigate('assignments');
    setFilter(status);
    setCourseFilter(courseId);
    setDetail(null);
  }
  function showCompletion() {
    navigate('assignments');
    setAssignmentPanel('completion');
  }
  function changeAssignmentSort(key: AssignmentSortKey) {
    setAssignmentSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setLimit(20);
  }
  function openCourse(course: Course) {
    captureFocus();
    setDetail(course);
    setDetailTab('overview');
  }
  function openAssign(courseId = courses[0].id, preserveFocus = false) {
    if (!preserveFocus) captureFocus();
    setAssignCourse(courseId);
    setAssignOpen(true);
  }
  const filteredCourses = courses.filter(
    (course) =>
      course.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'overdue' &&
          scoped.some((r) => r.courseId === course.id && isOverdue(r))) ||
        (filter === 'open' &&
          scoped.some(
            (r) =>
              r.courseId === course.id && r.status !== 'Knowledge Complete',
          ))),
  );
  const filteredRecords = sortAssignments(
    scoped.filter((record) => {
      const person = learners.find((p) => p.id === record.learnerId)!;
      const course = courses.find((c) => c.id === record.courseId)!;
      return (
        (courseFilter === 'all' || record.courseId === courseFilter) &&
        `${person.name} ${person.group} ${course.name}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === 'all' ||
          filter === assignmentStatus(record) ||
          (filter === 'due' && isDueSoon(record)) ||
          (filter === 'open' && record.status !== 'Knowledge Complete'))
      );
    }),
    assignmentSort,
  );

  return (
    <SidebarProvider style={{ '--sidebar-width': '208px' } as CSSProperties}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navigation
        view={view}
        navigate={navigate}
        onHelp={() => {
          captureFocus();
          setHelpOpen(true);
        }}
      />
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === 'programs'
                ? 'Training programs'
                : view === 'assignments'
                  ? 'Assignments'
                  : view === 'sites'
                    ? 'Sites'
                    : 'Course library'}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="scope-label">Viewing</span>
            <Building2 size={17} className="scope-building" />
            <Picker
              value={site}
              label="Site scope"
              onChange={(value) => {
                setSite(value);
                setLimit(20);
              }}
              options={[
                { value: 'all', label: 'All sites (3)' },
                ...sites.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> SITE ADMINISTRATION
              </div>
              <h1 ref={headingRef} tabIndex={-1}>
                {view === 'programs'
                  ? 'Training programs'
                  : view === 'assignments'
                    ? 'Training assignments'
                    : view === 'sites'
                      ? 'Your sites'
                      : 'Course library'}
              </h1>
              <p>
                {view === 'programs'
                  ? 'A clear view of your training. A stronger foundation for your people.'
                  : view === 'assignments'
                    ? 'Manage who needs training, why it is assigned, and when it is due.'
                    : view === 'sites'
                      ? 'See how foundational training is progressing at each location.'
                      : 'Ten course outlines for chemical manufacturing teams.'}
              </p>
            </div>
            <Button
              className="primary-button"
              onClick={() => openAssign()}
              disabled={!loaded}
            >
              <Plus size={18} /> Assign training
            </Button>
          </div>
          <div className="workspace-context">
            <span>
              <Building2 size={15} />
              {scopeName}
              <span className="context-divider" />
              {siteCount} {siteCount === 1 ? 'site' : 'sites'} in view
            </span>
            <span>
              <span className="demo-badge">SAMPLE DATA</span>
              <span className="snapshot">As of Sep 9, 2026</span>
            </span>
          </div>
          {notice && (
            <output className="notice">
              <Info size={19} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                <X size={18} />
              </button>
            </output>
          )}

          {view !== 'library' && (
            <section className="stats-grid" aria-label="Training summary">
              <button className="stat-card" onClick={() => showAssignments()}>
                <span className="stat-label">
                  Assigned learners
                  <Users size={19} />
                </span>
                <strong>
                  {stats.people}
                  <small>people</small>
                </strong>
              </button>
              <button
                className="stat-card"
                onClick={showCompletion}
                aria-pressed={
                  view === 'assignments' && assignmentPanel === 'completion'
                }
              >
                <span className="stat-label">
                  Knowledge completion
                  <CheckCircle2 size={19} />
                </span>
                <strong>
                  {stats.percent}
                  <small>%</small>
                </strong>
                <span className="stat-detail">
                  {stats.incompletePeople}{' '}
                  {stats.incompletePeople === 1 ? 'person' : 'people'} with
                  incomplete assignments
                </span>
                <div
                  className="stat-meter"
                  style={
                    { '--completion': `${stats.percent}%` } as CSSProperties
                  }
                />
              </button>
              <button
                className={`stat-card ${stats.overdue ? 'overdue-card' : ''}`}
                onClick={() => showAssignments('overdue')}
              >
                <span className="stat-label">
                  Overdue
                  <Clock3 size={19} />
                </span>
                <strong>
                  {stats.overdue}
                  <small>assignments</small>
                </strong>
                <span
                  className={`stat-detail ${stats.overdue ? 'danger-text' : ''}`}
                >
                  {stats.overdue
                    ? 'Needs your attention'
                    : 'No overdue assignments'}{' '}
                  <ArrowUpRight size={15} />
                </span>
              </button>
              <button
                className="stat-card"
                onClick={() => showAssignments('due')}
              >
                <span className="stat-label">
                  Due in the next 30 days
                  <CalendarDays size={19} />
                </span>
                <strong>
                  {stats.dueSoon}
                  <small>assignments</small>
                </strong>
                <span className="stat-detail">
                  Keep your team on track <ArrowRight size={15} />
                </span>
              </button>
            </section>
          )}

          {view === 'programs' && (
            <>
              <section
                className="panel programs-panel"
                aria-labelledby="programs-title"
              >
                <div className="panel-heading">
                  <div>
                    <h2 id="programs-title">
                      Your training programs{' '}
                      <span className="count-badge">{courses.length}</span>
                    </h2>
                    <p>Shared foundational courses, managed for your sites.</p>
                  </div>
                  <span className="foundation-badge">
                    <Layers3 size={14} /> Foundation library
                  </span>
                </div>
                <div className="table-toolbar">
                  <div className="search-field">
                    <Search size={17} />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      aria-label="Search programs"
                      placeholder="Search programs…"
                    />
                  </div>
                  <div className="filter-control">
                    <SlidersHorizontal size={16} />
                    <Picker
                      label="Filter programs"
                      value={filter}
                      onChange={(value) => setFilter(value as StatusFilter)}
                      options={[
                        { value: 'all', label: 'All programs' },
                        { value: 'overdue', label: 'Has overdue assignments' },
                        { value: 'open', label: 'Has open assignments' },
                      ]}
                    />
                  </div>
                </div>
                <Table className="program-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Knowledge completion</TableHead>
                      <TableHead>Upcoming / overdue</TableHead>
                      <TableHead>
                        <span className="sr-only">Program actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.map((course) => {
                      const summary = summarize(
                        scoped.filter((r) => r.courseId === course.id),
                      );
                      return (
                        <TableRow key={course.id}>
                          <TableCell>
                            <button
                              className="course-name"
                              onClick={() => openCourse(course)}
                            >
                              <CourseIcon course={course} />
                              <span>
                                <strong>{course.name}</strong>
                                <small>
                                  {course.lessons.length} {course.unitLabel ?? 'lessons'}<span>·</span>
                                  Foundational course
                                </small>
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <strong className="assigned-number">
                              {summary.people}
                            </strong>
                            <span className="cell-secondary">learners</span>
                          </TableCell>
                          <TableCell>
                            <div className="completion-cell">
                              <span>
                                <strong>{summary.percent}%</strong>
                                <small>
                                  {summary.complete} of {summary.total}
                                </small>
                              </span>
                              <Progress
                                value={summary.percent}
                                aria-label={`${course.name} knowledge completion`}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="deadline-cell">
                              {summary.overdue > 0 ? (
                                <button
                                  className="status-pill danger"
                                  onClick={() =>
                                    showAssignments('overdue', course.id)
                                  }
                                >
                                  <span />
                                  {summary.overdue} overdue
                                </button>
                              ) : (
                                <span className="status-pill neutral">
                                  <Check size={12} />
                                  No overdue
                                </span>
                              )}
                              <button
                                className="due-link"
                                onClick={() =>
                                  showAssignments('due', course.id)
                                }
                              >
                                {summary.dueSoon} due soon
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              className="manage-button"
                              onClick={() => openCourse(course)}
                              aria-label={`Manage ${course.name}`}
                            >
                              Manage
                              <ChevronRight size={15} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filteredCourses.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <EmptyState
                            title="No programs match"
                            description="Try a different course name or clear the filter."
                            onClear={() => {
                              setQuery('');
                              setFilter('all');
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="table-footnote">
                  <Info size={15} />
                  <span>
                    Knowledge completion is one step. Site instruction,
                    practical evaluation, and employer authorization remain
                    separate requirements.
                  </span>
                </div>
              </section>
              <div className="lower-grid">
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <h2>Needs attention</h2>
                    <span className="tiny-label">YOUR NEXT STEPS</span>
                  </div>
                  <button
                    className="attention-row"
                    onClick={() => showAssignments('overdue')}
                  >
                    <span className="attention-icon amber">
                      <Clock3 size={20} />
                    </span>
                    <span>
                      <strong>
                        {stats.overdue
                          ? `${stats.overdue} assignments are overdue`
                          : 'No overdue assignments'}
                      </strong>
                      <small>
                        {stats.overdue
                          ? 'Review learners and adjust due dates where needed.'
                          : 'Review upcoming training to stay ahead.'}
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="attention-row"
                    onClick={() => navigate('sites')}
                  >
                    <span className="attention-icon blue">
                      <Building2 size={20} />
                    </span>
                    <span>
                      <strong>Local instruction needs a plan</strong>
                      <small>
                        Review the site-specific requirements beyond these
                        courses.
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="attention-row"
                    onClick={() => openAssign()}
                  >
                    <span className="attention-icon teal">
                      <Users size={20} />
                    </span>
                    <span>
                      <strong>Plan your next training assignment</strong>
                      <small>
                        Choose sites, employee groups, and a due date.
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                </section>
                <section className="panel site-progress">
                  <div className="panel-heading">
                    <h2>Training by site</h2>
                    <button
                      className="text-action"
                      onClick={() => navigate('sites')}
                    >
                      View sites
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {sites
                    .filter((s) => site === 'all' || site === s.id)
                    .map((s) => {
                      const summary = summarize(
                        scopedAssignments(records, s.id),
                      );
                      return (
                        <button
                          key={s.id}
                          className="site-progress-row"
                          onClick={() => {
                            setSite(s.id);
                            navigate('programs');
                          }}
                        >
                          <span className="site-code">{s.code}</span>
                          <span className="site-progress-info">
                            <strong>{s.name}</strong>
                            <small>
                              {summary.people} learners · {summary.overdue}{' '}
                              overdue
                            </small>
                          </span>
                          <span className="site-progress-bar">
                            <strong>{summary.percent}%</strong>
                            <Progress
                              value={summary.percent}
                              aria-label={`${s.name} knowledge completion`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  <div className="site-progress-footer">
                    <span className="legend-dot" /> Knowledge completion across
                    assigned courses
                  </div>
                </section>
              </div>
            </>
          )}

          {view === 'assignments' && assignmentPanel === 'completion' && (
            <CompletionBreakdown
              records={scoped}
              onSelect={showAssignments}
              onBack={() => showAssignments()}
            />
          )}

          {view === 'assignments' && assignmentPanel === 'records' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Assignment records{' '}
                    <span className="count-badge">{scoped.length}</span>
                  </h2>
                  <p>
                    Sample learning records. Select a due date to update it.
                  </p>
                </div>
              </div>
              <div className="table-toolbar assignment-toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <Input
                    aria-label="Search assignments"
                    placeholder="Search people or courses…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setLimit(20);
                    }}
                  />
                </div>
                <Picker
                  label="Filter by course"
                  value={courseFilter}
                  onChange={(v) => {
                    setCourseFilter(v);
                    setLimit(20);
                  }}
                  options={[
                    { value: 'all', label: 'All courses' },
                    ...courses.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <Picker
                  label="Filter assignment status"
                  value={filter}
                  onChange={(v) => {
                    setFilter(v as StatusFilter);
                    setLimit(20);
                  }}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    ...assignmentStatuses.map((status) => ({
                      value: status.key,
                      label: status.label,
                    })),
                    { value: 'due', label: 'Due in 30 days' },
                    { value: 'open', label: 'Open assignments' },
                  ]}
                />
              </div>
              <Table className="assignment-table">
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <AssignmentSortHeader
                      fields={['learner', 'site']}
                      sort={assignmentSort}
                      onSort={changeAssignmentSort}
                    />
                    <AssignmentSortHeader
                      fields={['course', 'reason']}
                      sort={assignmentSort}
                      onSort={changeAssignmentSort}
                    />
                    <AssignmentSortHeader
                      fields={['status']}
                      sort={assignmentSort}
                      onSort={changeAssignmentSort}
                    />
                    <AssignmentSortHeader
                      fields={['due']}
                      sort={assignmentSort}
                      onSort={changeAssignmentSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.slice(0, limit).map((record) => {
                    const person = learners.find(
                      (p) => p.id === record.learnerId,
                    )!;
                    const course = courses.find(
                      (c) => c.id === record.courseId,
                    )!;
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <strong>{person.name}</strong>
                          <span className="cell-secondary">
                            {sites.find((s) => s.id === person.siteId)!.name} ·{' '}
                            {person.group}
                          </span>
                        </TableCell>
                        <TableCell>
                          <strong>{course.name}</strong>
                          <span className="cell-secondary">
                            {record.reason}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`status-pill ${record.status === 'Knowledge Complete' ? 'success' : isOverdue(record) ? 'danger' : 'neutral'}`}
                          >
                            {record.status === 'Knowledge Complete' && (
                              <Check size={13} />
                            )}
                            {isOverdue(record) ? 'Overdue' : record.status}
                          </span>
                          {isOverdue(record) && (
                            <span className="cell-secondary">
                              {record.status}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            className="edit-date"
                            onClick={() => {
                              captureFocus();
                              setEditing(record);
                              setEditDue(record.due);
                              setEditError('');
                            }}
                            aria-label={`Edit due date for ${person.name}, ${course.name}`}
                          >
                            {formatDate(record.due)}
                            <Pencil size={13} />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredRecords.length && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <EmptyState
                          title="No assignments found"
                          description="Try another site, course, or status."
                          onClear={() => {
                            setQuery('');
                            setFilter('all');
                            setCourseFilter('all');
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="records-footer">
                <span className="sr-only" aria-live="polite">
                  Sorted by{' '}
                  {assignmentSortLabels[assignmentSort.key].toLowerCase()},{' '}
                  {assignmentSort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'}
                  .
                </span>
                <span>
                  Showing {Math.min(limit, filteredRecords.length)} of{' '}
                  {filteredRecords.length} assignments
                </span>
                {filteredRecords.length > limit && (
                  <Button
                    variant="outline"
                    onClick={() => setLimit(limit + 20)}
                  >
                    Show 20 more
                  </Button>
                )}
              </div>
            </section>
          )}

          {view === 'sites' && (
            <>
              <div className="sites-grid">
                {sites
                  .filter((s) => site === 'all' || site === s.id)
                  .map((s) => {
                    const summary = summarize(scopedAssignments(records, s.id));
                    return (
                      <section className="panel site-card" key={s.id}>
                        <div className="site-card-top">
                          <span className="site-code">{s.code}</span>
                          <span className="status-pill neutral">
                            Sample site
                          </span>
                        </div>
                        <h2>{s.name}</h2>
                        <p>{s.location}</p>
                        <div className="site-card-metrics">
                          <span>
                            <strong>{summary.people}</strong>learners
                          </span>
                          <span>
                            <strong>{summary.total}</strong>assignments
                          </span>
                          <span>
                            <strong className="danger-text">
                              {summary.overdue}
                            </strong>
                            overdue
                          </span>
                        </div>
                        <div className="site-card-completion">
                          <span>
                            Knowledge completion
                            <strong>{summary.percent}%</strong>
                          </span>
                          <Progress
                            value={summary.percent}
                            aria-label={`${s.name} knowledge completion`}
                          />
                        </div>
                        <div className="local-status">
                          <Info size={17} />
                          <span>
                            Local instruction<strong>Not connected</strong>
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSite(s.id);
                            navigate('programs');
                          }}
                        >
                          Manage site training
                          <ArrowRight size={16} />
                        </Button>
                      </section>
                    );
                  })}
              </div>
              <section className="local-explainer">
                <ShieldCheck size={24} />
                <div>
                  <h2>Build on the foundation with local instruction</h2>
                  <p>
                    These courses establish shared knowledge. Each employer
                    still needs to determine the applicable site procedures,
                    equipment instruction, practical evaluations, and
                    authorizations. Local training records are not connected in
                    this preview.
                  </p>
                </div>
              </section>
            </>
          )}

          {view === 'library' && (
            <>
              <div className="library-note">
                <BookOpen size={21} />
                <span>
                  <strong>{courses.length} course foundations</strong>Assign by
                  actual job, hazard, and site applicability. Syllabi and
                  regulatory summaries are planning material.
                </span>
              </div>
              <div className="library-grid">
                {courses.map((course) => (
                  <section className="panel library-card" key={course.id}>
                    <CourseIcon course={course} />
                    <span className="mini-label">
                      {course.lessons.length} {course.unitLabel ?? 'LESSONS'} · FOUNDATION
                    </span>
                    <h2>{course.name}</h2>
                    <p>{course.purpose}</p>
                    <div>
                      <span className="status-pill neutral">
                        {course.regulatory?.legalStatus ??
                          'Under domain review'}
                      </span>
                      <button
                        className="text-action"
                        onClick={() => openCourse(course)}
                      >
                        View course
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </section>
                ))}
                <section
                  className="panel library-card library-card-practice"
                  aria-labelledby="practice-course-title"
                >
                  <span className="course-icon practice">
                    <Sandwich aria-hidden="true" size={23} strokeWidth={1.7} />
                  </span>
                  <span className="mini-label">
                    {practiceLessons.length} LESSONS · {pbjCourse.modules.length}{' '}
                    MODULES · PRACTICE
                  </span>
                  <h2 id="practice-course-title">{pbjCourse.title}</h2>
                  <p>
                    {pbjCourse.code}: an everyday task taught in full so the
                    learner experience, knowledge checks, activities, and final
                    assessment can be tried end to end. About{' '}
                    {estimatedMinutes(pbjCourse)} minutes.
                  </p>
                  <div>
                    <span className="status-pill neutral">
                      Practice course · not assignable
                    </span>
                    <Link
                      className="text-action"
                      href="/training/pb-and-j"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${pbjCourse.title} (opens in a new tab)`}
                    >
                      Open course
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </section>
              </div>
              <p className="library-footer">
                Course scripts, media, assessments, and approved release
                versions will be added as course packages are developed. The
                practice course is fictional, is not part of the assignable
                library, and keeps its progress in this browser only.
              </p>
            </>
          )}

          <footer className="page-footer">
            <span>
              <ShieldCheck size={15} />
              HSE Informer<span>·</span>Training with purpose.
            </span>
            <button
              onClick={() => {
                captureFocus();
                setHelpOpen(true);
              }}
            >
              Preview workspace · Changes stay in this browser
              <Info size={14} />
            </button>
          </footer>
        </main>
      </div>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="program-sheet" finalFocus={returnFocus}>
          {detail && (
            <>
              <SheetHeader className="program-sheet-header">
                <CourseIcon course={detail} />
                <span className="mini-label">
                  FOUNDATIONAL TRAINING · {scopeName}
                </span>
                <div className="program-title-row">
                  <SheetTitle>{detail.name}</SheetTitle>
                  {detail.previewPath ? (
                    <Button
                      className="preview-training-button"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link
                          href={detail.previewPath}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                      aria-label={`Preview ${detail.name} training (opens in a new tab)`}
                    >
                      <Play size={15} /> Preview training
                    </Button>
                  ) : (
                    <span className="preview-unavailable">
                      Preview in development
                    </span>
                  )}
                </div>
                <SheetDescription>{detail.purpose}</SheetDescription>
              </SheetHeader>
              <Tabs
                value={detailTab}
                onValueChange={(v) => setDetailTab(String(v))}
                className="sheet-tabs"
              >
                <TabsList variant="line">
                  <TabsTrigger value="overview">Program overview</TabsTrigger>
                  <TabsTrigger value="syllabus">Course syllabus</TabsTrigger>
                  <TabsTrigger value="regulatory">Regulatory basis</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <div className="sheet-section">
                    <h3>
                      Training at{' '}
                      {scopeName.toLowerCase() === 'all sites'
                        ? 'all sites'
                        : scopeName}
                    </h3>
                    <div className="detail-stats">
                      {(() => {
                        const summary = summarize(
                          scoped.filter((r) => r.courseId === detail.id),
                        );
                        return (
                          <>
                            <span>
                              <strong>{summary.people}</strong>Assigned learners
                            </span>
                            <span>
                              <strong>{summary.percent}%</strong>Knowledge
                              complete
                            </span>
                            <span>
                              <strong>{summary.overdue}</strong>Overdue
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => showAssignments('all', detail.id)}
                    >
                      View assignment records
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                  <div className="sheet-section">
                    <h3>Beyond the foundational course</h3>
                    <p>
                      Plan and document the instruction that depends on your
                      site, equipment, and assigned duties.
                    </p>
                    {detail.local.map((item) => (
                      <div className="local-requirement" key={item}>
                        <span className="hollow-dot" />
                        {item}
                      </div>
                    ))}
                    {detail.authorizationPrerequisites && (
                      <div className="authorization-prerequisites">
                        <h3>Before required respirator use</h3>
                        <p>
                          These are employer-program checks, separate from
                          online course progress.
                        </p>
                        {detail.authorizationPrerequisites.map((item) => (
                          <div className="local-requirement" key={item}>
                            <span className="hollow-dot" />
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="inline-info">
                      <Info size={18} />
                      <span>
                        Local instruction and qualification records are not
                        connected. Knowledge completion does not grant
                        authorization.
                      </span>
                    </div>
                  </div>
                  <div className="sheet-section">
                    <h3>Assignment purpose</h3>
                    <p>
                      Use this same foundation for onboarding, recurring
                      training, or retraining. Record the reason for each
                      assignment; a due date does not establish a regulatory
                      renewal interval.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="syllabus">
                  <div className="sheet-section">
                    <h3>
                      {detail.lessons.length} {detail.unitLabel ?? 'lessons'} ·
                      Master syllabus
                    </h3>
                    <p>
                      Each lesson teaches hazards, protective measures,
                      responsibilities, and practical decisions.
                    </p>
                    <ol className="syllabus-list">
                      {detail.lessons.map((lesson, i) => (
                        <li key={lesson}>
                          <span>{String(i + 1).padStart(2, '0')}</span>
                          {lesson}
                        </li>
                      ))}
                    </ol>
                    <div className="inline-info">
                      <Info size={18} />
                      <span>
                        Outline only. Instructional content and approved course
                        versions are still in development.
                      </span>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="regulatory">
                  <div className="sheet-section regulatory-basis">
                    <h3>Regulatory basis</h3>
                    {detail.regulatory ? (
                      <>
                        <span className="status-pill neutral">
                          {detail.regulatory.legalStatus}
                        </span>
                        <dl>
                          <div>
                            <dt>Authority and paragraphs</dt>
                            <dd>
                              {detail.regulatory.authority} ·{' '}
                              {detail.regulatory.paragraphs.join(', ')}
                            </dd>
                          </div>
                          <div>
                            <dt>Applies when</dt>
                            <dd>{detail.regulatory.appliesWhen}</dd>
                          </div>
                          <div>
                            <dt>Retraining triggers</dt>
                            <dd>
                              {detail.regulatory.retrainingTriggers.join('; ')}
                            </dd>
                          </div>
                          <div>
                            <dt>Recurrence</dt>
                            <dd>{detail.regulatory.recurrence.summary}</dd>
                          </div>
                          {detail.regulatory.competency && (
                            <div>
                              <dt>Competency verification</dt>
                              <dd>{detail.regulatory.competency}</dd>
                            </div>
                          )}
                          <div>
                            <dt>Required records</dt>
                            <dd>{detail.regulatory.records.join('; ')}</dd>
                          </div>
                        </dl>
                        {detail.regulatory.notes?.map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                        <h4>References</h4>
                        <ul>
                          {detail.regulatory.references.map((reference) => (
                            <li key={reference.href}>
                              <a
                                href={reference.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {reference.label}{' '}
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <span className="status-pill neutral">
                          Under domain review
                        </span>
                        <p>{detail.reviewNote}</p>
                      </>
                    )}
                    <div className="inline-info">
                      <Info size={18} />
                      <span>
                        Planning summary — the applicable regulation and written
                        site program are the source of truth.
                      </span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="sheet-bottom">
                <Button
                  className="primary-button"
                  onClick={() => {
                    const id = detail.id;
                    setDetail(null);
                    setTimeout(() => openAssign(id, true), 220);
                  }}
                >
                  <Plus size={17} />
                  Assign this course
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AssignmentDialog
        key={`${assignOpen}-${assignCourse}-${site}`}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        initialCourse={assignCourse}
        initialSite={site}
        records={records}
        finalFocus={returnFocus}
        onSave={(next, count) => {
          if (!persist([...records, ...next])) return false;
          setNotice(
            `${count} preview assignment${count === 1 ? '' : 's'} saved in this browser. No learners were notified.`,
          );
          return true;
        }}
      />

      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="edit-dialog" finalFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>Update due date</DialogTitle>
            <DialogDescription>
              {editing &&
                `${learners.find((p) => p.id === editing.learnerId)!.name} · ${courses.find((c) => c.id === editing.courseId)!.name}`}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing || !editDue) return;
              if (
                persist(
                  records.map((r) =>
                    r.id === editing.id ? { ...r, due: editDue } : r,
                  ),
                )
              ) {
                setEditing(null);
                setNotice(
                  'The preview due date was updated in this browser. No notification was sent.',
                );
              } else
                setEditError(
                  'Not saved. Check browser storage or reload if another tab changed these records.',
                );
            }}
          >
            <label className="field-label" htmlFor="edit-due">
              Due date
            </label>
            <Input
              id="edit-due"
              type="date"
              required
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
            />
            <p className="form-hint">
              This changes the assignment deadline only.
            </p>
            {editError && (
              <p role="alert" className="form-error">
                {editError}
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save due date</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="help-dialog" finalFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>About this workspace</DialogTitle>
            <DialogDescription>
              A working preview of the HSE Informer admin experience.
            </DialogDescription>
          </DialogHeader>
          <p>
            The three sites, employees, and learning records are fictional. The
            fixed snapshot date is September 9, 2026.
          </p>
          <p>
            You can explore programs, filter assignments, change due dates, and
            create preview assignments. Changes are saved only in this browser;
            they are not shared with other administrators or delivered to
            learners.
          </p>
          <p>
            The ten syllabi include five mapped additions. Approved course
            content, real site records, sign-in roles, and qualification
            evidence still need to be connected.
          </p>
          <Button onClick={() => setHelpOpen(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function EmptyState({
  title,
  description,
  onClear,
}: {
  title: string;
  description: string;
  onClear: () => void;
}) {
  return (
    <div className="empty-state">
      <Search size={24} />
      <h3>{title}</h3>
      <p>{description}</p>
      <Button variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

function AssignmentDialog({
  open,
  onOpenChange,
  initialCourse,
  initialSite,
  records,
  onSave,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCourse: string;
  initialSite: string;
  records: Assignment[];
  onSave: (records: Assignment[], count: number) => boolean;
  finalFocus: React.RefObject<HTMLElement | null>;
}) {
  const [step, setStep] = useState(1);
  const [courseId, setCourseId] = useState(initialCourse);
  const [selectedSites, setSelectedSites] = useState(
    initialSite === 'all' ? sites.map((s) => s.id) : [initialSite],
  );
  const [group, setGroup] = useState('All employees');
  const [reason, setReason] = useState<string>(reasons[0]);
  const [cadence, setCadence] = useState<string>(() =>
    defaultCadence(courses.find((c) => c.id === initialCourse) ?? courses[0]),
  );
  const [due, setDue] = useState('2026-09-30');
  const [error, setError] = useState('');
  const eligible = eligibleLearners(records, courseId, selectedSites, group);
  const audience = learners.filter(
    (p) =>
      selectedSites.includes(p.siteId) &&
      (group === 'All employees' || p.group === group),
  );
  const course = courses.find((c) => c.id === courseId)!;
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="assignment-dialog" finalFocus={finalFocus}>
        <DialogHeader>
          <span className="mini-label">
            {step === 1 ? '01 · ASSIGNMENT DETAILS' : '02 · REVIEW ASSIGNMENT'}
          </span>
          <DialogTitle>Assign training</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Choose the course and the people who need it.'
              : 'Review this preview assignment before saving.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            if (
              !selectedSites.length ||
              !eligible.length ||
              !due ||
              due < DEMO_DATE
            ) {
              setError(
                'Select at least one site with eligible learners and a due date on or after September 9, 2026.',
              );
              return;
            }
            if (step === 1) {
              setStep(2);
              requestAnimationFrame(() => stepHeading.current?.focus());
              return;
            }
            if (submitting.current) return;
            submitting.current = true;
            const batch = crypto.randomUUID();
            const next = eligible.map((person) => ({
              id: `${batch}-${person.id}`,
              learnerId: person.id,
              courseId,
              due,
              assigned: DEMO_DATE,
              status: 'Not started' as const,
              reason,
              cadence,
              version: 'Foundation preview',
            }));
            if (onSave(next, next.length)) onOpenChange(false);
            else {
              setError(
                'Not saved. Check browser storage or reload if another tab changed these records.',
              );
              submitting.current = false;
            }
          }}
        >
          {step === 1 ? (
            <div className="form-fields">
              <div>
                <label htmlFor="assign-course" className="field-label">
                  Course
                </label>
                <Picker
                  id="assign-course"
                  label="Course to assign"
                  value={courseId}
                  onChange={(id) => {
                    setCourseId(id);
                    setCadence(
                      defaultCadence(courses.find((c) => c.id === id)!),
                    );
                  }}
                  options={courses.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <fieldset>
                <legend className="field-label">Sites</legend>
                <div className="site-checkboxes">
                  {sites.map((site) => (
                    <label key={site.id}>
                      <Checkbox
                        checked={selectedSites.includes(site.id)}
                        onCheckedChange={(checked) =>
                          setSelectedSites(
                            checked
                              ? [...selectedSites, site.id]
                              : selectedSites.filter((id) => id !== site.id),
                          )
                        }
                      />
                      <span>
                        {site.name}
                        <small>12 sample employees</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="form-two">
                <div>
                  <label htmlFor="assign-group" className="field-label">
                    Employee group
                  </label>
                  <Picker
                    id="assign-group"
                    label="Employee group"
                    value={group}
                    onChange={setGroup}
                    options={[
                      'All employees',
                      'Production',
                      'Maintenance',
                      'Warehouse',
                    ].map((v) => ({ value: v, label: v }))}
                  />
                </div>
                <div>
                  <label htmlFor="assign-due" className="field-label">
                    Due date
                  </label>
                  <Input
                    id="assign-due"
                    type="date"
                    min={DEMO_DATE}
                    value={due}
                    required
                    onChange={(e) => setDue(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="assign-reason" className="field-label">
                  Assignment reason
                </label>
                <Picker
                  id="assign-reason"
                  label="Assignment reason"
                  value={reason}
                  onChange={setReason}
                  options={reasons.map((v) => ({ value: v, label: v }))}
                />
              </div>
              <div>
                <label htmlFor="assign-cadence" className="field-label">
                  Planned recurrence
                </label>
                <Picker
                  id="assign-cadence"
                  label="Planned recurrence"
                  value={cadence}
                  onChange={setCadence}
                  options={cadences.map((v) => ({ value: v, label: v }))}
                />
                <p className="form-hint">
                  Suggested from the regulatory basis. This preview does not
                  automatically schedule repeat assignments.
                </p>
              </div>
              <div className="audience-summary">
                <Users size={20} />
                <span>
                  <strong>
                    {eligible.length} learners will receive this preview
                    assignment
                  </strong>
                  <small>
                    {audience.length - eligible.length} excluded because they
                    already have an open assignment for this course.
                  </small>
                </span>
              </div>
            </div>
          ) : (
            <div className="review-content">
              <h3 ref={stepHeading} tabIndex={-1}>
                Ready to assign to {eligible.length} learners
              </h3>
              <div className="review-course">
                <CourseIcon course={course} />
                <span>
                  <strong>{course.name}</strong>
                  <small>
                    Foundation preview · {course.lessons.length}{' '}
                    {course.unitLabel ?? 'lessons'}
                  </small>
                </span>
              </div>
              <dl className="review-details">
                <div>
                  <dt>Sites</dt>
                  <dd>
                    {sites
                      .filter((s) => selectedSites.includes(s.id))
                      .map((s) => s.name)
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Employee group</dt>
                  <dd>{group}</dd>
                </div>
                <div>
                  <dt>Assignment reason</dt>
                  <dd>{reason}</dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>{formatDate(due)}</dd>
                </div>
                <div>
                  <dt>Planned recurrence</dt>
                  <dd>{cadence}</dd>
                </div>
              </dl>
              <details className="recipient-details">
                <summary>Review {eligible.length} recipients</summary>
                <ul>
                  {eligible.map((p) => (
                    <li key={p.id}>
                      {p.name}
                      <span>{sites.find((s) => s.id === p.siteId)!.name}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="inline-info">
                <Info size={19} />
                <span>
                  This creates sample records in this browser. No learner is
                  notified. Knowledge completion never grants task
                  authorization.
                </span>
              </div>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              type="button"
              onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
            >
              {step === 2 ? 'Back' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              className="primary-button"
              disabled={eligible.length === 0 || selectedSites.length === 0}
            >
              {step === 1
                ? 'Review assignment'
                : `Save ${eligible.length} preview assignments`}
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
