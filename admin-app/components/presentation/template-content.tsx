'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { InteractiveContent } from './interactive-content';
import { EvidenceContent } from './evidence-content';
import { TextContent } from './text-content';
import {
  isInteractiveSlide,
  isTextSlide,
  isEvidenceSlide,
} from '@/lib/lms/presentation';
import type { ActivityResponse, OverviewSlide } from '@/lib/lms/presentation';
import { FittedPanel, type PanelSection } from './fitted-panel';
import { TrainingPractice } from './training-practice';
import type { PracticeResponse } from './training-practice';
export type { PracticeResponse } from './training-practice';
import './training-practice.css';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  FileText,
  Info,
  Layers3,
  ListChecks,
  Route,
  Target,
  Users,
} from 'lucide-react';
import type {
  DiagramContent,
  ObjectivesContent,
  PresentationCallout,
  PresentationCourse,
  PresentationReference,
  PresentationSlide,
  PresentationTerm,
  ProcedureContent,
  SummaryContent,
  TableContent,
  TemplateSlide,
} from '@/lib/lms/presentation';

/** Temporary viewing state. This has no grading or completion contract. */

type TemplateContentProps = {
  slide: TemplateSlide;
  activity?: ActivityResponse;
  onActivityChange: (response: ActivityResponse) => void;
  renderArtwork?: (key: string) => ReactNode;
  course: PresentationCourse;
  onNavigate: (slideId: string) => void;
  practice?: PracticeResponse;
  onPracticeChange: (response: PracticeResponse) => void;
};

const number = (value: number) => String(value).padStart(2, '0');

export function TrainingCallout({ callout }: { callout: PresentationCallout }) {
  const caution = callout.variant === 'warning' || callout.variant === 'danger';
  const Icon = caution ? CircleAlert : Info;
  return (
    <aside className="training-callout" data-variant={callout.variant}>
      <Icon size={20} aria-hidden="true" />
      <div>
        {callout.title && <h3>{callout.title}</h3>}
        <p>{callout.text}</p>
      </div>
    </aside>
  );
}

export function TrainingObjectives({
  content,
}: {
  content: ObjectivesContent;
}) {
  return (
    <div className="training-objectives">
      {content.groups.map((group, index) => (
        <section className="training-objective-group" key={group.title}>
          <span className="training-number" aria-hidden="true">
            {number(index + 1)}
          </span>
          <h2>{group.title}</h2>
          <ul className="training-check-list">
            {group.items.map((item) => (
              <li key={item}>
                <Check size={17} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TrainingDiagram({ content }: { content: DiagramContent }) {
  return (
    <figure className="training-diagram">
      <ol className="training-pathway" aria-label="Ordered pathway">
        {content.nodes.map((node, index) => (
          <li key={node.id}>
            <div className="training-pathway-node">
              <span className="training-number" aria-hidden="true">
                {number(index + 1)}
              </span>
              <h2>{node.title}</h2>
              <p>{node.text}</p>
            </div>
            {index < content.nodes.length - 1 && (
              <ArrowRight
                className="training-pathway-arrow"
                size={24}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
      <figcaption>
        {content.caption && (
          <p className="training-figure-caption">{content.caption}</p>
        )}
        <div className="training-figure-description">
          <span className="training-label">Pathway in words</span>
          <p>{content.description}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function TrainingTable({ content }: { content: TableContent }) {
  return (
    <div className="training-table">
      <table>
        <caption>{content.caption}</caption>
        <thead>
          <tr>
            {content.columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={index}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrainingProcedure({ content }: { content: ProcedureContent }) {
  return (
    <div className="training-procedure">
      <ol className="training-steps">
        {content.steps.map((step, index) => (
          <li key={step.title}>
            <span className="training-step-number" aria-hidden="true">
              {number(index + 1)}
            </span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
              {step.caution && (
                <div className="training-step-note" data-variant="caution">
                  <CircleAlert size={17} aria-hidden="true" />
                  <p>
                    <strong>Caution:</strong> {step.caution}
                  </p>
                </div>
              )}
              {step.verification && (
                <div className="training-step-note" data-variant="verification">
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <p>
                    <strong>Verify:</strong> {step.verification}
                  </p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {content.callout && <TrainingCallout callout={content.callout} />}
    </div>
  );
}

export function TrainingDefinitions({ terms }: { terms: PresentationTerm[] }) {
  return (
    <dl className="training-definitions">
      {terms.map((item) => (
        <div key={item.term}>
          <dt>{item.term}</dt>
          <dd>
            <p>{item.definition}</p>
            {item.example && (
              <p className="training-definition-example">
                <strong>Example:</strong> {item.example}
              </p>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TrainingReferences({
  references,
}: {
  references: PresentationReference[];
}) {
  return (
    <ul className="training-references">
      {references.map((reference) => (
        <li key={`${reference.label}-${reference.href}`}>
          <a href={reference.href} target="_blank" rel="noopener noreferrer">
            <BookOpen size={17} aria-hidden="true" />
            <span>
              {reference.label}
              <span className="training-sr-only"> (opens in a new tab)</span>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function TrainingSummary({ content }: { content: SummaryContent }) {
  return (
    <div className="training-summary">
      <section className="training-standard">
        <h2>The finished standard</h2>
        <dl>
          {content.standard.map((item) => (
            <div key={item.title}>
              <dt>{item.title}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="training-takeaways">
        <h2>Take into practice</h2>
        <ul className="training-check-list">
          {content.takeaways.map((item) => (
            <li key={item}>
              <Check size={17} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="training-summary-references">
        <h2>References and job aid</h2>
        <TrainingReferences references={content.references} />
        {content.jobAid && (
          <a
            className="training-job-aid"
            href={content.jobAid.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText size={20} aria-hidden="true" />
            <span>
              {content.jobAid.label}
              <span className="training-sr-only"> (opens in a new tab)</span>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        )}
      </section>
    </div>
  );
}

export function SlideDetails({ slide }: { slide: PresentationSlide }) {
  const details = slide.details;
  if (!details) return null;
  return (
    <div className="training-details">
      {Boolean(details.explanation?.length) && (
        <section aria-labelledby={`${slide.id}-explanation-title`}>
          <h3 id={`${slide.id}-explanation-title`}>Explanation</h3>
          {details.explanation?.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      )}
      {Boolean(details.terms?.length) && (
        <section aria-labelledby={`${slide.id}-terms-title`}>
          <h3 id={`${slide.id}-terms-title`}>Terms</h3>
          <TrainingDefinitions terms={details.terms ?? []} />
        </section>
      )}
      {Boolean(details.sources?.length) && (
        <section aria-labelledby={`${slide.id}-sources-title`}>
          <h3 id={`${slide.id}-sources-title`}>Sources</h3>
          <TrainingReferences references={details.sources ?? []} />
        </section>
      )}
    </div>
  );
}

type LearningTopic = {
  id: string;
  label: string;
  sections: PanelSection[];
  destination?: string;
};

function topicsFor(
  slide: OverviewSlide,
  course: PresentationCourse,
): LearningTopic[] {
  let topics: LearningTopic[] = [];
  const section = (
    id: string,
    title: string,
    text: string,
    tone?: PanelSection['tone'],
  ): PanelSection => ({
    id,
    title,
    text,
    tone,
  });
  switch (slide.template) {
    case 'introduction':
      topics = [
        {
          id: 'purpose',
          label: 'Purpose',
          sections: [section('purpose', 'Purpose', slide.content.purpose)],
        },
        {
          id: 'audience',
          label: 'Who this is for',
          sections: [
            section('audience', 'Who this is for', slide.content.audience),
          ],
        },
        {
          id: 'structure',
          label: 'Course structure',
          sections: [
            section('structure', 'How you will learn', slide.content.structure),
            section(
              'format',
              'At your own pace',
              `${new Set(course.slides.map((item) => item.chapter)).size} chapters · ${course.slides.length} slides · Self-paced`,
            ),
          ],
        },
      ];
      break;
    case 'objectives':
      topics = slide.content.groups.map((group, i) => ({
        id: `objective-${i}`,
        label: group.title,
        sections: group.items.map((text, j) =>
          section(
            `objective-${i}-${j}`,
            j === 0 ? group.title : 'Also be able to',
            text,
          ),
        ),
      }));
      break;
    case 'roadmap':
      topics = slide.content.chapters.map((chapter, i) => ({
        id: `chapter-${i}`,
        label: chapter.title,
        sections: [section(`chapter-${i}`, chapter.title, chapter.description)],
        destination: chapter.targetSlideId,
      }));
      break;
    case 'diagram':
      topics = slide.content.nodes.map((node) => ({
        id: node.id,
        label: node.title,
        sections: [section(node.id, node.title, node.text)],
      }));
      topics.push({
        id: 'whole-pathway',
        label: 'The whole pathway',
        sections: [
          section('pathway', 'Pathway in words', slide.content.description),
          ...(slide.content.caption
            ? [
                section(
                  'caption',
                  'Read the connections',
                  slide.content.caption,
                ),
              ]
            : []),
        ],
      });
      break;
    case 'table':
      topics = slide.content.rows.map((row, i) => ({
        id: `row-${i}`,
        label: slide.content.rowLabels?.[i] || `Situation ${i + 1}`,
        sections: row.map((text, j) =>
          section(`cell-${i}-${j}`, slide.content.columns[j], text),
        ),
      }));
      break;
    case 'procedure':
      topics = slide.content.steps.map((step, i) => ({
        id: `step-${i}`,
        label: step.title,
        sections: [
          section(`method-${i}`, 'Method', step.text),
          ...(step.caution
            ? [section(`caution-${i}`, 'Caution', step.caution, 'caution')]
            : []),
          ...(step.verification
            ? [
                section(
                  `verify-${i}`,
                  'Verify before continuing',
                  step.verification,
                  'verification',
                ),
              ]
            : []),
        ],
      }));
      if (slide.content.callout)
        topics.push({
          id: 'caution',
          label: slide.content.callout.title || 'Caution',
          sections: [
            section(
              'caution',
              slide.content.callout.title || 'Caution',
              slide.content.callout.text,
              'caution',
            ),
          ],
        });
      break;
    case 'summary':
      topics = [
        {
          id: 'standard',
          label: 'Finished standard',
          sections: slide.content.standard.map((item, i) =>
            section(`standard-${i}`, item.title, item.text),
          ),
        },
        {
          id: 'takeaways',
          label: 'Key takeaways',
          sections: slide.content.takeaways.map((text, i) =>
            section(`takeaway-${i}`, `Takeaway ${i + 1}`, text),
          ),
        },
        {
          id: 'references',
          label: 'References and job aid',
          sections: [
            ...slide.content.references,
            ...(slide.content.jobAid ? [slide.content.jobAid] : []),
          ].map((reference, i) => ({
            id: `reference-${i}`,
            text: '',
            href: reference.href,
            linkLabel: reference.label,
          })),
        },
      ];
      break;
  }
  if (slide.template !== 'practice')
    topics.push({
      id: 'context',
      label: 'Slide overview',
      sections: [
        section('context', 'In this slide', slide.lead),
        ...(slide.template === 'table'
          ? [section('table-caption', 'Comparison', slide.content.caption)]
          : []),
        ...(slide.takeaway
          ? [section('remember', 'Remember', slide.takeaway)]
          : []),
      ],
    });
  return topics;
}

type InformationSlide = Exclude<OverviewSlide, { template: 'practice' }>;

const explorerPresentations = {
  introduction: {
    layout: 'briefing',
    maxPrimaryTopics: 3,
    instruction: 'Start with the essentials',
  },
  objectives: {
    layout: 'outcomes',
    maxPrimaryTopics: 3,
    instruction: 'Explore each learning outcome',
  },
  roadmap: {
    layout: 'journey',
    maxPrimaryTopics: 6,
    instruction: 'Choose a chapter. Explore at your pace.',
  },
  diagram: {
    layout: 'pathway',
    maxPrimaryTopics: 3,
    instruction: 'Follow the connections. Select a stage.',
  },
  table: {
    layout: 'comparison',
    maxPrimaryTopics: 5,
    instruction: 'Click each to learn more',
  },
  procedure: {
    layout: 'sequence',
    maxPrimaryTopics: 3,
    instruction: 'Select a step to review the method and checks',
  },
  summary: {
    layout: 'recap',
    maxPrimaryTopics: 3,
    instruction: 'Review the standard. Keep the resources.',
  },
} as const;

function primaryTopicCount(slide: InformationSlide) {
  switch (slide.template) {
    case 'introduction':
      return 3;
    case 'objectives':
      return slide.content.groups.length;
    case 'roadmap':
      return slide.content.chapters.length;
    case 'diagram':
      return slide.content.nodes.length;
    case 'table':
      return slide.content.rows.length;
    case 'procedure':
      return slide.content.steps.length;
    case 'summary':
      return 3;
  }
}

function topicIcon(slide: InformationSlide, topic: LearningTopic) {
  if (topic.id === 'context') return Info;
  if (topic.id === 'caution') return CircleAlert;
  switch (slide.template) {
    case 'introduction':
      return topic.id === 'purpose'
        ? Target
        : topic.id === 'audience'
          ? Users
          : BookOpen;
    case 'objectives':
      return CheckCircle2;
    case 'roadmap':
      return Route;
    case 'diagram':
      return topic.id === 'whole-pathway' ? Route : CircleDot;
    case 'table':
      return Layers3;
    case 'procedure':
      return ListChecks;
    case 'summary':
      return topic.id === 'standard'
        ? CheckCircle2
        : topic.id === 'references'
          ? BookOpen
          : ListChecks;
  }
}

function TopicExplorer({
  slide,
  course,
  onNavigate,
}: { slide: InformationSlide } & Pick<
  TemplateContentProps,
  'course' | 'onNavigate'
>) {
  const topics = useMemo(() => topicsFor(slide, course), [slide, course]);
  const [selected, setSelected] = useState(topics[0]?.id);
  const topic = topics.find((item) => item.id === selected) || topics[0];
  const presentation = explorerPresentations[slide.template];
  const primaryCount = primaryTopicCount(slide);
  return (
    <div
      className="training-explorer"
      data-explorer-layout={presentation.layout}
      data-primary-topics={primaryCount}
      data-compact-topics={primaryCount > presentation.maxPrimaryTopics}
      data-many-topics={topics.length > 5}
      data-training-interactive
    >
      <nav className="training-topic-menu" aria-label="Explore this slide">
        <div className="training-explorer-intro">
          {slide.template === 'introduction' && (
            <div className="training-explorer-stat">
              <strong>{course.code}</strong>
              <span>
                {new Set(course.slides.map((item) => item.chapter)).size}{' '}
                chapters · {course.slides.length} slides
              </span>
            </div>
          )}
          <p className="training-explorer-kicker">{presentation.instruction}</p>
        </div>
        <fieldset
          className="training-topic-buttons"
          aria-label={
            slide.template === 'diagram'
              ? 'Ordered transfer pathway and supporting detail'
              : 'Slide topics'
          }
        >
          {topics.map((item, i) => {
            const Icon = topicIcon(slide, item);
            return (
              <button
                key={item.id}
                type="button"
                data-topic-kind={i < primaryCount ? 'primary' : 'support'}
                aria-pressed={item.id === topic.id}
                onClick={() => setSelected(item.id)}
              >
                <span className="training-topic-number" aria-hidden="true">
                  {number(i + 1)}
                </span>
                <Icon
                  className="training-topic-icon"
                  size={22}
                  aria-hidden="true"
                />
                <strong className="training-topic-label">{item.label}</strong>
                <ArrowRight
                  className="training-topic-arrow"
                  size={16}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </fieldset>
        <select
          aria-label="Explore topic"
          value={topic.id}
          onChange={(event) => setSelected(event.target.value)}
        >
          {topics.map((item, i) => (
            <option key={item.id} value={item.id}>
              {number(i + 1)} · {item.label}
            </option>
          ))}
        </select>
        {topic.destination && (
          <button
            type="button"
            className="training-button training-open-chapter"
            aria-label={`Open ${topic.label} chapter`}
            onClick={() => onNavigate(topic.destination!)}
          >
            Open chapter <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        )}
      </nav>
      <div className="training-topic-content" key={topic.id}>
        <FittedPanel sections={topic.sections} label={topic.label} />
      </div>
    </div>
  );
}

export function TemplateContent({
  slide,
  course,
  onNavigate,
  practice,
  onPracticeChange,
  activity,
  onActivityChange,
  renderArtwork,
}: TemplateContentProps) {
  return (
    <section
      className="training-template"
      data-template={slide.template}
      aria-label={`${slide.title} — slide content`}
    >
      <header className="training-slide-heading">
        <span className="training-label">{slide.eyebrow}</span>
        <h1 id="pbj-slide-title">{slide.title}</h1>
        <p className="training-lead">{slide.lead}</p>
      </header>
      {isEvidenceSlide(slide) ? (
        <EvidenceContent
          slide={slide}
          response={activity}
          onChange={onActivityChange}
          renderArtwork={renderArtwork}
        />
      ) : isTextSlide(slide) ? (
        <TextContent slide={slide} />
      ) : isInteractiveSlide(slide) ? (
        <InteractiveContent
          slide={slide}
          response={activity}
          onChange={onActivityChange}
          renderArtwork={renderArtwork}
        />
      ) : slide.template === 'practice' ? (
        <TrainingPractice
          id={slide.id}
          content={slide.content}
          response={practice}
          onChange={onPracticeChange}
        />
      ) : (
        <TopicExplorer slide={slide} course={course} onNavigate={onNavigate} />
      )}
    </section>
  );
}
