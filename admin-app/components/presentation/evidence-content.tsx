'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import type {
  ActivityResponse,
  ActivityVisual,
  EvidenceSlide,
  BranchNode,
} from '@/lib/lms/presentation';
import { FittedPanel, type PanelSection } from './fitted-panel';
import { TrainingPractice } from './training-practice';
import './evidence-content.css';

type Props = {
  slide: EvidenceSlide;
  response?: ActivityResponse;
  onChange: (response: ActivityResponse) => void;
  renderArtwork?: (key: string) => ReactNode;
};

function EvidenceVisual({
  visual,
  renderArtwork,
  children,
}: {
  visual: ActivityVisual;
  renderArtwork?: Props['renderArtwork'];
  children?: ReactNode;
}) {
  return (
    <div
      className="evidence-canvas"
      style={{ '--evidence-ratio': visual.aspectRatio ?? 1.5 } as CSSProperties}
    >
      <div className="evidence-drawing">
        <figure className="evidence-art" aria-label={visual.description}>
          {renderArtwork?.(visual.art) ?? <span>{visual.description}</span>}
        </figure>
        {children}
      </div>
    </div>
  );
}

export function EvidenceContent({
  slide,
  response = {},
  onChange,
  renderArtwork,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setCompact(element.clientWidth < 660 || element.clientHeight < 280),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      focusTarget.current?.focus({ preventScroll: true });
      pendingFocus.current = false;
    }
  }, [
    response.evidencePane,
    response.branch?.nodeId,
    response.branch?.attempt,
  ]);

  if (slide.template === 'branching-case') {
    const content = slide.content;
    const branch = response.branch ?? {
      nodeId: content.startNodeId,
      responses: {},
      path: [],
    };
    const node =
      content.nodes.find((item) => item.id === branch.nodeId) ??
      content.nodes[0];
    const current = branch.responses[node.id] ?? {};
    const submitted =
      node.kind === 'decision'
        ? node.options.find((item) => item.id === current.submitted)
        : undefined;
    function move(nodeId: string, reset = false) {
      pendingFocus.current = true;
      onChange({
        ...response,
        branch: reset
          ? {
              nodeId,
              responses: {},
              path: [],
              attempt: (branch.attempt ?? 0) + 1,
            }
          : {
              ...branch,
              nodeId,
              path: [
                ...branch.path,
                { nodeId: node.id, optionId: submitted!.id },
              ],
            },
      });
    }
    const pathSections: PanelSection[] = branch.path.map((step, index) => {
      const source = content.nodes.find(
        (item): item is Extract<BranchNode, { kind: 'decision' }> =>
          item.id === step.nodeId && item.kind === 'decision',
      )!;
      const option = source.options.find((item) => item.id === step.optionId)!;
      return {
        id: `path-${index}`,
        title: `${index + 1}. ${source.title}`,
        text: `${option.text} ${option.outcome}`,
      };
    });
    return (
      <div
        ref={root}
        className="training-evidence"
        data-evidence="branching-case"
        data-compact={compact}
        data-training-interactive
        data-node-id={node.id}
      >
        <nav className="evidence-toolbar" aria-label="Case controls">
          <span className="evidence-progress">
            {node.kind === 'outcome'
              ? 'Case debrief'
              : `Decision ${branch.path.length + 1}`}
          </span>
          <button type="button" onClick={() => move(content.startNodeId, true)}>
            Restart case
          </button>
          {submitted && (
            <button
              type="button"
              className="evidence-primary"
              onClick={() => move(submitted.nextNodeId)}
            >
              Continue case
            </button>
          )}
        </nav>
        <div
          ref={focusTarget}
          tabIndex={-1}
          className="evidence-body evidence-case"
          aria-label={node.title}
        >
          {node.kind === 'decision' ? (
            <TrainingPractice
              key={`${node.id}-${branch.attempt ?? 0}`}
              id={`${slide.id}-${node.id}`}
              content={node}
              response={current}
              onChange={(value) =>
                onChange({
                  ...response,
                  branch: {
                    ...branch,
                    responses: { ...branch.responses, [node.id]: value },
                  },
                })
              }
            />
          ) : (
            <FittedPanel
              label="Case debrief"
              sections={[
                { id: node.id, title: node.title, text: node.text },
                ...pathSections,
              ]}
            />
          )}
        </div>
        <output className="training-sr-only">{node.title}</output>
      </div>
    );
  }

  if (slide.template === 'before-after') {
    const pair =
      slide.content.pairs.find((item) => item.id === response.activeId) ??
      slide.content.pairs[0];
    const view = response.comparisonView ?? 'before';
    const sections: PanelSection[] = [
      { id: 'change', title: pair.label, text: pair.explanation },
      {
        id: 'before',
        title: 'Before — visual in words',
        text: pair.before.description,
      },
      {
        id: 'after',
        title: 'After — visual in words',
        text: pair.after.description,
      },
      { id: 'check', title: 'Verify the change', text: pair.check },
    ];
    return (
      <div
        ref={root}
        className="training-evidence"
        data-evidence="before-after"
        data-compact={compact}
        data-training-interactive
      >
        <nav className="evidence-toolbar" aria-label="Comparison controls">
          <label className="evidence-select">
            <span className="training-sr-only">Compare example</span>
            <select
              value={pair.id}
              onChange={(event) =>
                onChange({ ...response, activeId: event.target.value })
              }
            >
              {slide.content.pairs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {compact && view !== 'explanation' && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...response,
                  comparisonView: view === 'before' ? 'after' : 'before',
                })
              }
            >
              Show {view === 'before' ? 'after' : 'before'}
            </button>
          )}
          <button
            type="button"
            aria-pressed={view === 'explanation'}
            onClick={() =>
              onChange({
                ...response,
                comparisonView:
                  view === 'explanation' ? 'before' : 'explanation',
              })
            }
          >
            {view === 'explanation' ? 'View comparison' : 'Explain change'}
          </button>
        </nav>
        <div className="evidence-body">
          {view === 'explanation' ? (
            <FittedPanel label="Comparison explanation" sections={sections} />
          ) : (
            <div className="evidence-pair">
              {(['before', 'after'] as const)
                .filter((side) => !compact || side === view)
                .map((side) => (
                  <figure key={side} data-side={side}>
                    <figcaption>
                      {side === 'before' ? 'Before' : 'After'}
                      <span>{pair.label}</span>
                    </figcaption>
                    <EvidenceVisual
                      visual={pair[side]}
                      renderArtwork={renderArtwork}
                    />
                  </figure>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const content = slide.content;
  const pane = response.evidencePane ?? 'visual';
  const reviewed = Boolean(response.decision?.submitted);
  const annotation =
    content.annotations.find((item) => item.id === response.activeId) ??
    content.annotations[0];
  function open(pane: ActivityResponse['evidencePane']) {
    pendingFocus.current = true;
    onChange({ ...response, evidencePane: pane });
  }
  return (
    <div
      ref={root}
      className="training-evidence"
      data-evidence="inspection"
      data-compact={compact}
      data-training-interactive
    >
      <nav className="evidence-toolbar" aria-label="Inspection controls">
        {pane === 'decision' ? (
          <button type="button" onClick={() => open('visual')}>
            {reviewed ? 'Annotated scene' : 'Inspect scene'}
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={pane === 'text'}
              onClick={() => open(pane === 'text' ? 'visual' : 'text')}
            >
              {pane === 'text' ? 'View scene' : 'Text version'}
            </button>
            <button
              type="button"
              className="evidence-primary"
              onClick={() => open('decision')}
            >
              {reviewed ? 'Review answer' : 'Choose findings'}
            </button>
          </>
        )}
      </nav>
      <div
        ref={focusTarget}
        tabIndex={-1}
        className="evidence-body"
        aria-label={
          pane === 'decision' ? 'Inspection decision' : 'Inspection evidence'
        }
      >
        {pane === 'decision' ? (
          <TrainingPractice
            id={`${slide.id}-inspection`}
            content={content.decision}
            response={response.decision}
            onChange={(value) => onChange({ ...response, decision: value })}
          />
        ) : pane === 'text' ? (
          <FittedPanel
            label="Inspection text"
            sections={[
              {
                id: 'scene',
                title: 'What the scene shows',
                text: content.visual.description,
              },
              ...(reviewed
                ? [
                    annotation,
                    ...content.annotations.filter(
                      (item) => item.id !== annotation.id,
                    ),
                  ].map((item) => ({
                    id: item.id,
                    title: item.label,
                    text: item.text,
                  }))
                : []),
              {
                id: 'limit',
                title: 'Check beyond appearance',
                text: content.decision.situation,
              },
            ]}
          />
        ) : (
          <figure className="evidence-inspection">
            <EvidenceVisual
              visual={content.visual}
              renderArtwork={renderArtwork}
            >
              {reviewed &&
                content.annotations.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="evidence-pin"
                    aria-label={`Review ${item.label}`}
                    style={{
                      left: `clamp(24px, ${item.x}%, calc(100% - 24px))`,
                      top: `clamp(24px, ${item.y}%, calc(100% - 24px))`,
                    }}
                    onClick={() => {
                      pendingFocus.current = true;
                      onChange({
                        ...response,
                        activeId: item.id,
                        evidencePane: 'text',
                      });
                    }}
                  >
                    {index + 1}
                  </button>
                ))}
            </EvidenceVisual>
            <figcaption>
              {reviewed
                ? 'Review the numbered findings. Training illustration.'
                : 'Inspect before revealing the answer. Training illustration.'}
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
