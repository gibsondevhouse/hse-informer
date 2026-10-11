'use client';

import { useEffect, useId, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Layers,
  Lightbulb,
  MessageSquareText,
  PenLine,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type {
  AttestationBlock,
  ChecklistBlock,
  OptionSelectBlock,
  ReflectionBlock,
  SurveyBlock,
} from '@/lib/lms/schema';
import type { BlockEnv } from './env';

export function Checklist({
  block,
  env,
}: {
  block: ChecklistBlock;
  env: BlockEnv;
}) {
  const checked = env.checklists[block.id] ?? [];
  const groupId = useId();
  return (
    <fieldset className="lms-activity lms-checklist">
      <legend>
        <ClipboardCheck size={18} aria-hidden="true" />
        {block.title}
        <span className="lms-muted">
          {checked.length} of {block.items.length}
          {block.required ? ' · required' : ''}
        </span>
      </legend>
      <ul>
        {block.items.map((item, index) => {
          const id = `${groupId}-${index}`;
          return (
            <li key={item}>
              <Checkbox
                id={id}
                aria-labelledby={`${id}-label`}
                checked={checked.includes(index)}
                onCheckedChange={() => env.onToggleChecklist(block.id, index)}
              />
              <label id={`${id}-label`} htmlFor={id}>
                {item}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function Reflection({
  block,
  env,
}: {
  block: ReflectionBlock;
  env: BlockEnv;
}) {
  const id = useId();
  const text = env.reflections[block.id] ?? '';
  const minLength = block.minLength ?? 0;
  const remaining = Math.max(0, minLength - text.trim().length);
  return (
    <div className="lms-activity lms-reflection">
      <label htmlFor={id}>
        <PenLine size={18} aria-hidden="true" />
        {block.prompt}
      </label>
      <Textarea
        id={id}
        value={text}
        placeholder={block.placeholder}
        rows={4}
        aria-describedby={`${id}-hint`}
        onChange={(event) => env.onSetReflection(block.id, event.target.value)}
      />
      <p id={`${id}-hint`} className="lms-muted">
        {block.required
          ? remaining > 0
            ? `Required · ${remaining} more character${remaining === 1 ? '' : 's'} to go`
            : 'Required · complete'
          : 'Optional · saved in this browser only'}
      </p>
    </div>
  );
}

export function Survey({ block, env }: { block: SurveyBlock; env: BlockEnv }) {
  const id = useId();
  const value = env.surveys[block.id] ?? '';
  return (
    <fieldset className="lms-activity lms-survey">
      <legend>
        <MessageSquareText size={18} aria-hidden="true" />
        {block.prompt}
      </legend>
      <RadioGroup
        className="lms-survey-scale"
        value={value}
        onValueChange={(next) => env.onSetSurvey(block.id, String(next))}
      >
        {block.scale.map((point) => (
          <label className="lms-survey-point" key={point.id}>
            <RadioGroupItem
              value={point.id}
              id={`${id}-${point.id}`}
              aria-label={point.label}
            />
            <span>{point.label}</span>
          </label>
        ))}
      </RadioGroup>
      <p className="lms-muted">Optional · not graded</p>
    </fieldset>
  );
}

export function AttestationView({
  block,
  env,
}: {
  block: AttestationBlock;
  env: BlockEnv;
}) {
  const id = useId();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  const signed = env.attestations[block.id];
  const canRecord = agreed && (!block.requiresName || name.trim().length > 0);
  return (
    <div className="lms-activity lms-attestation">
      <div className="lms-attestation-heading">
        <BadgeCheck size={18} aria-hidden="true" />
        <h3>Acknowledgement{block.required === false ? ' (optional)' : ''}</h3>
      </div>
      <p className="lms-attestation-statement">{block.statement}</p>
      {signed ? (
        <output className="lms-attestation-signed">
          Acknowledged{signed.name ? ` by ${signed.name}` : ''} on{' '}
          {new Date(signed.at).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          . Stored in this browser only; this is not a training record.
        </output>
      ) : (
        <div className="lms-attestation-form">
          <div className="lms-attestation-agree">
            <Checkbox
              id={`${id}-agree`}
              aria-labelledby={`${id}-agree-label`}
              checked={agreed}
              onCheckedChange={(next) => setAgreed(Boolean(next))}
            />
            <label id={`${id}-agree-label`} htmlFor={`${id}-agree`}>
              I confirm the statement above.
            </label>
          </div>
          {block.requiresName && (
            <div className="lms-attestation-name">
              <label htmlFor={`${id}-name`}>Your name</label>
              <Input
                id={`${id}-name`}
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <Button
            variant="outline"
            disabled={!canRecord}
            onClick={() => env.onAttest(block.id, name)}
          >
            Record acknowledgement
          </Button>
        </div>
      )}
    </div>
  );
}

const EMPTY_VISITED: string[] = [];

export function OptionSelectView({
  block,
  env,
}: {
  block: OptionSelectBlock;
  env: BlockEnv;
}) {
  const visited = env.optionSelects[block.id];
  const firstId = block.options[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(firstId);
  const onSelectOption = env.onSelectOption;
  const hasVisitedFirst = Boolean(visited?.includes(firstId));

  useEffect(() => {
    if (firstId && !hasVisitedFirst) {
      onSelectOption(block.id, firstId);
    }
  }, [block.id, firstId, hasVisitedFirst, onSelectOption]);

  const visitedList = env.optionSelects[block.id] ?? EMPTY_VISITED;

  const activeOption =
    block.options.find((opt) => opt.id === selectedId) ?? block.options[0];
  const allVisited =
    block.options.length > 0 &&
    block.options.every((opt) => visitedList.includes(opt.id));

  function handleSelect(id: string) {
    setSelectedId(id);
    env.onSelectOption(block.id, id);
  }

  return (
    <div
      className="lms-activity lms-option-select"
      aria-label={block.title ?? 'Option selection'}
    >
      <div className="lms-option-select-header">
        <div className="lms-option-select-title-group">
          <Layers size={18} aria-hidden="true" className="lms-option-icon" />
          <h3>{block.title ?? 'Select each option to continue'}</h3>
        </div>
        <div
          className={`lms-option-pill ${allVisited ? 'is-complete' : 'is-pending'}`}
          aria-live="polite"
        >
          {allVisited ? (
            <>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>All options explored</span>
            </>
          ) : (
            <>
              <Circle size={13} aria-hidden="true" />
              <span>
                {visitedList.length} of {block.options.length} explored
                {block.required !== false ? ' · required' : ''}
              </span>
            </>
          )}
        </div>
      </div>
      {block.instruction && (
        <p className="lms-option-instruction">{block.instruction}</p>
      )}

      {/* Interactive Option Cards */}
      <div
        className="lms-option-cards"
        role="tablist"
        aria-label={block.title ?? 'Options'}
      >
        {block.options.map((option, idx) => {
          const isSelected = option.id === activeOption?.id;
          const isVisited = visitedList.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`lms-option-card ${isSelected ? 'is-selected' : ''} ${isVisited ? 'is-visited' : ''}`}
              onClick={() => handleSelect(option.id)}
            >
              <div className="lms-option-card-indicator">
                {isVisited ? (
                  <Check size={13} aria-hidden="true" className="lms-check-icon" />
                ) : (
                  <span className="lms-number-badge">{idx + 1}</span>
                )}
              </div>
              <div className="lms-option-card-content">
                <span className="lms-option-card-title">{option.title}</span>
                {option.subtitle && (
                  <span className="lms-option-card-subtitle">
                    {option.subtitle}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Every panel participates in sizing; only the selected panel is exposed. */}
      <div className="lms-option-detail-stack">
        {block.options.map((option) => {
          const selected = option.id === activeOption?.id;
          return (
            <div
              key={option.id}
              className="lms-option-detail"
              role={selected ? 'tabpanel' : undefined}
              aria-hidden={!selected}
              data-selected={selected}
            >
              <div className="lms-option-detail-header">
                <h4>{option.title}</h4>
                {option.subtitle && (
                  <span className="lms-option-detail-subtitle">
                    {option.subtitle}
                  </span>
                )}
                {option.badge && (
                  <span className="lms-option-card-badge">{option.badge}</span>
                )}
              </div>
              <p className="lms-option-detail-text">{option.content}</p>
              {option.bullets && option.bullets.length > 0 && (
                <ul className="lms-option-detail-bullets">
                  {option.bullets.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              )}
              {option.caution && (
                <div className="lms-option-detail-caution">
                  <TriangleAlert size={15} aria-hidden="true" />
                  <span>{option.caution}</span>
                </div>
              )}
              {option.tip && (
                <div className="lms-option-detail-tip">
                  <Lightbulb size={15} aria-hidden="true" />
                  <span>{option.tip}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
