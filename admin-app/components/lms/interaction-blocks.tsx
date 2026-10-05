'use client';

import { useEffect, useId, useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleHelp,
  CircleX,
  Info,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  gradeInteraction,
  isAnswered,
  seededShuffle,
} from '@/lib/lms/engine';
import type {
  FillBlankBlock,
  InteractionBlock,
  InteractionType,
  LearnerResponse,
  MatchingBlock,
  MultipleChoiceBlock,
  MultipleResponseBlock,
  NumericBlock,
  ScenarioBlock,
  SequencingBlock,
  SortingBlock,
  TrueFalseBlock,
} from '@/lib/lms/schema';
import { hashId, type BlockEnv } from './env';

export const interactionLabels: Record<InteractionType, string> = {
  multipleChoice: 'Multiple choice',
  multipleResponse: 'Select all that apply',
  trueFalse: 'True or false',
  fillBlank: 'Fill in the blank',
  numeric: 'Numeric answer',
  matching: 'Matching',
  sequencing: 'Put in order',
  sorting: 'Sort into categories',
  scenario: 'Scenario',
};

type BodyProps<B extends InteractionBlock> = {
  block: B;
  response: LearnerResponse | undefined;
  disabled: boolean;
  reveal: boolean;
  promptId: string;
  onChange: (response: LearnerResponse) => void;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isStringRecord = (value: unknown): value is Record<string, string> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function Interaction({
  block,
  env,
  position,
}: {
  block: InteractionBlock;
  env: BlockEnv;
  position?: { index: number; total: number };
}) {
  const promptId = useId();
  const response = env.responses[block.id];
  const answered = isAnswered(block, response);
  const checked =
    env.mode === 'review' ||
    (env.mode === 'lesson' && env.checked.includes(block.id));
  const grade = checked ? gradeInteraction(block, response) : null;
  const bodyProps = {
    response,
    disabled: checked,
    reveal: checked,
    promptId,
    onChange: (next: LearnerResponse) => env.onAnswer(block.id, next),
  };
  const state = !grade
    ? 'open'
    : grade.correct
      ? 'correct'
      : grade.score > 0
        ? 'partial'
        : 'incorrect';
  return (
    <section
      className={`lms-interaction lms-interaction-${block.type}`}
      data-state={state}
      aria-labelledby={promptId}
    >
      <div className="lms-interaction-heading">
        <span className="lms-interaction-label">
          <CircleHelp size={15} aria-hidden="true" />
          <span>
            {position
              ? `Question ${position.index} of ${position.total}`
              : 'Knowledge check'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="lms-interaction-type">
            {interactionLabels[block.type]}
            {block.required === false && env.mode === 'lesson' ? ' · Optional' : ''}
          </span>
        </span>
        <p className="lms-prompt" id={promptId}>
          {block.prompt}
        </p>
      </div>
      <Body block={block} {...bodyProps} />
      {env.mode === 'lesson' && (
        <div className="lms-interaction-actions">
          {checked ? (
            <Button variant="outline" onClick={() => env.onRetry(block.id)}>
              <RotateCcw size={15} aria-hidden="true" />
              Try again
            </Button>
          ) : (
            <Button variant="outline" disabled={!answered} onClick={() => env.onCheck(block.id)}>
              Check answer
            </Button>
          )}
          {!checked && !answered && (
            <span className="lms-muted">Answer to enable checking.</span>
          )}
        </div>
      )}
      {env.mode === 'exam' && (
        <p className="lms-muted lms-exam-status">
          {answered ? 'Answered' : 'Not answered yet'}
        </p>
      )}
      <output className="lms-feedback">
        {grade && (
          <>
            <span className="lms-feedback-title">
              {grade.correct ? (
                <CircleCheck size={18} aria-hidden="true" />
              ) : grade.score > 0 ? (
                <Info size={18} aria-hidden="true" />
              ) : (
                <CircleX size={18} aria-hidden="true" />
              )}
              <strong>
                {grade.correct
                  ? 'Correct'
                  : grade.score > 0
                    ? `Partially correct · ${Math.round(grade.score * 100)}%`
                    : env.mode === 'review' && !answered
                      ? 'Not answered'
                      : 'Not quite'}
              </strong>
            </span>
            <p>{grade.feedback}</p>
          </>
        )}
      </output>
    </section>
  );
}

function Body({ block, ...props }: BodyProps<InteractionBlock>) {
  switch (block.type) {
    case 'multipleChoice':
      return <MultipleChoice block={block} {...props} />;
    case 'multipleResponse':
      return <MultipleResponse block={block} {...props} />;
    case 'trueFalse':
      return <TrueFalse block={block} {...props} />;
    case 'fillBlank':
      return <FillBlank block={block} {...props} />;
    case 'numeric':
      return <Numeric block={block} {...props} />;
    case 'matching':
      return <Matching block={block} {...props} />;
    case 'sequencing':
      return <Sequencing block={block} {...props} />;
    case 'sorting':
      return <Sorting block={block} {...props} />;
    case 'scenario':
      return <Scenario block={block} {...props} />;
  }
}

function optionClass(
  reveal: boolean,
  isCorrect: boolean,
  isSelected: boolean,
) {
  if (!reveal) return 'lms-option';
  if (isCorrect) return 'lms-option is-correct';
  if (isSelected) return 'lms-option is-incorrect';
  return 'lms-option';
}

const optionKey = (index: number) => String.fromCharCode(65 + index);

function OptionKey({ label }: { label: string }) {
  return (
    <span className="lms-option-key" aria-hidden="true">
      {label}
    </span>
  );
}

function MultipleChoice({
  block,
  response,
  disabled,
  reveal,
  promptId,
  onChange,
}: BodyProps<MultipleChoiceBlock>) {
  const value = typeof response === 'string' ? response : '';
  return (
    <RadioGroup
      className="lms-options"
      value={value}
      disabled={disabled}
      aria-labelledby={promptId}
      onValueChange={(next) => onChange(String(next))}
    >
      {block.options.map((option, index) => (
        <label
          key={option.id}
          className={optionClass(
            reveal,
            option.id === block.answer,
            option.id === value,
          )}
        >
          <RadioGroupItem value={option.id} />
          <OptionKey label={optionKey(index)} />
          <span className="lms-option-text">{option.text}</span>
          {reveal && option.id === block.answer && (
            <span className="lms-option-tag">Correct answer</span>
          )}
        </label>
      ))}
    </RadioGroup>
  );
}

function MultipleResponse({
  block,
  response,
  disabled,
  reveal,
  promptId,
  onChange,
}: BodyProps<MultipleResponseBlock>) {
  const selected = isStringArray(response) ? response : [];
  return (
    <fieldset className="lms-options lms-fieldset" aria-labelledby={promptId}>
      {block.options.map((option, index) => {
        const isSelected = selected.includes(option.id);
        return (
          <label
            key={option.id}
            className={optionClass(
              reveal,
              block.answers.includes(option.id),
              isSelected,
            )}
          >
            <Checkbox
              checked={isSelected}
              disabled={disabled}
              aria-label={option.text}
              onCheckedChange={(next) =>
                onChange(
                  next
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
            />
            <OptionKey label={optionKey(index)} />
            <span className="lms-option-text">{option.text}</span>
            {reveal && block.answers.includes(option.id) && (
              <span className="lms-option-tag">Correct</span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

function TrueFalse({
  block,
  response,
  disabled,
  reveal,
  promptId,
  onChange,
}: BodyProps<TrueFalseBlock>) {
  const value = typeof response === 'boolean' ? String(response) : '';
  return (
    <RadioGroup
      className="lms-options lms-options-inline"
      value={value}
      disabled={disabled}
      aria-labelledby={promptId}
      onValueChange={(next) => onChange(next === 'true')}
    >
      {[true, false].map((option) => (
        <label
          key={String(option)}
          className={optionClass(
            reveal,
            option === block.answer,
            String(option) === value,
          )}
        >
          <RadioGroupItem value={String(option)} />
          <OptionKey label={option ? 'T' : 'F'} />
          <span className="lms-option-text">{option ? 'True' : 'False'}</span>
          {reveal && option === block.answer && (
            <span className="lms-option-tag">Correct answer</span>
          )}
        </label>
      ))}
    </RadioGroup>
  );
}

function FillBlank({
  block,
  response,
  disabled,
  reveal,
  onChange,
}: BodyProps<FillBlankBlock>) {
  const id = useId();
  const [before, after = ''] = block.text.split('___');
  const value = typeof response === 'string' ? response : '';
  return (
    <p className="lms-fill-blank">
      <span>{before}</span>
      <label htmlFor={id} className="sr-only">
        Your answer
      </label>
      <Input
        id={id}
        className="lms-blank-input"
        value={value}
        disabled={disabled}
        autoComplete="off"
        size={Math.max(8, ...block.accepted.map((item) => item.length + 2))}
        onChange={(event) => onChange(event.target.value)}
      />
      <span>{after}</span>
      {reveal && (
        <span className="lms-option-tag">
          Accepted: {block.accepted.join(', ')}
        </span>
      )}
    </p>
  );
}

function Numeric({
  block,
  response,
  disabled,
  onChange,
  promptId,
}: BodyProps<NumericBlock>) {
  const id = useId();
  const value = typeof response === 'number' ? String(response) : '';
  return (
    <div className="lms-numeric">
      <label htmlFor={id} className="sr-only">
        Numeric answer
      </label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        className="lms-numeric-input"
        value={value}
        disabled={disabled}
        aria-describedby={promptId}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(event.target.value === '' || !Number.isFinite(next) ? '' : next);
        }}
      />
      {block.unit && <span className="lms-unit">{block.unit}</span>}
    </div>
  );
}

function Matching({
  block,
  response,
  disabled,
  reveal,
  onChange,
}: BodyProps<MatchingBlock>) {
  const id = useId();
  const current = isStringRecord(response) ? response : {};
  const choices = useMemo(
    () => seededShuffle(block.pairs, hashId(block.id)),
    [block],
  );
  return (
    <ol className="lms-matching">
      {block.pairs.map((pair) => {
        const chosen = current[pair.id] ?? '';
        const isCorrect = chosen === pair.id;
        return (
          <li
            key={pair.id}
            className={reveal ? (isCorrect ? 'is-correct' : 'is-incorrect') : ''}
          >
            <label htmlFor={`${id}-${pair.id}`}>{pair.left}</label>
            <NativeSelect
              className="lms-select"
              id={`${id}-${pair.id}`}
              value={chosen}
              disabled={disabled}
              onChange={(event) => {
                const next = { ...current };
                if (event.target.value) next[pair.id] = event.target.value;
                else delete next[pair.id];
                onChange(next);
              }}
            >
              <NativeSelectOption value="">Choose a match…</NativeSelectOption>
              {choices.map((choice) => (
                <NativeSelectOption value={choice.id} key={choice.id}>
                  {choice.right}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {reveal && !isCorrect && (
              <span className="lms-option-tag">Correct: {pair.right}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Sequencing({
  block,
  response,
  disabled,
  reveal,
  onChange,
}: BodyProps<SequencingBlock>) {
  const initial = useMemo(() => {
    const shuffled = seededShuffle(block.items, hashId(block.id));
    const unchanged = shuffled.every((item, index) => item.id === block.items[index].id);
    return unchanged ? [...shuffled.slice(1), shuffled[0]] : shuffled;
  }, [block]);
  const valid =
    isStringArray(response) &&
    response.length === block.items.length &&
    response.every((id) => block.items.some((item) => item.id === id));
  const order = valid
    ? response.map((id) => block.items.find((item) => item.id === id)!)
    : initial;
  useEffect(() => {
    if (!valid && !disabled) onChange(initial.map((item) => item.id));
  }, [valid, disabled, initial, onChange]);
  const move = (from: number, to: number) => {
    const next = order.map((item) => item.id);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  return (
    <ol className="lms-sequencing" aria-label="Current order">
      {order.map((item, index) => {
        const correctIndex = block.items.findIndex((candidate) => candidate.id === item.id);
        return (
          <li
            key={item.id}
            className={
              reveal ? (correctIndex === index ? 'is-correct' : 'is-incorrect') : ''
            }
          >
            <span className="lms-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="lms-sequencing-text">
              {item.text}
              {reveal && correctIndex !== index && (
                <span className="lms-option-tag">
                  Correct position: {correctIndex + 1}
                </span>
              )}
            </span>
            <span className="lms-sequencing-controls">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={disabled || index === 0}
                aria-label={`Move “${item.text}” up`}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp size={14} aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={disabled || index === order.length - 1}
                aria-label={`Move “${item.text}” down`}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown size={14} aria-hidden="true" />
              </Button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Sorting({
  block,
  response,
  disabled,
  reveal,
  onChange,
}: BodyProps<SortingBlock>) {
  const id = useId();
  const current = isStringRecord(response) ? response : {};
  const items = useMemo(
    () => seededShuffle(block.items, hashId(block.id)),
    [block],
  );
  return (
    <div className="lms-sorting">
      <ul className="lms-sorting-items">
        {items.map((item) => {
          const chosen = current[item.id] ?? '';
          const isCorrect = chosen === item.category;
          return (
            <li
              key={item.id}
              className={reveal ? (isCorrect ? 'is-correct' : 'is-incorrect') : ''}
            >
              <label htmlFor={`${id}-${item.id}`}>{item.text}</label>
              <NativeSelect
                className="lms-select"
                id={`${id}-${item.id}`}
                value={chosen}
                disabled={disabled}
                onChange={(event) => {
                  const next = { ...current };
                  if (event.target.value) next[item.id] = event.target.value;
                  else delete next[item.id];
                  onChange(next);
                }}
              >
                <NativeSelectOption value="">Choose a category…</NativeSelectOption>
                {block.categories.map((category) => (
                  <NativeSelectOption value={category.id} key={category.id}>
                    {category.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {reveal && !isCorrect && (
                <span className="lms-option-tag">
                  Correct:{' '}
                  {block.categories.find((category) => category.id === item.category)?.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="lms-sorting-summary" aria-label="Items by category">
        {block.categories.map((category) => {
          const assigned = items.filter((item) => current[item.id] === category.id);
          return (
            <div className="lms-sorting-bucket" key={category.id}>
              <strong>{category.label}</strong>
              {assigned.length ? (
                <ul>
                  {assigned.map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="lms-muted">Nothing assigned yet</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Scenario({
  block,
  response,
  disabled,
  reveal,
  promptId,
  onChange,
}: BodyProps<ScenarioBlock>) {
  const value = typeof response === 'string' ? response : '';
  return (
    <div className="lms-scenario">
      <p className="lms-scenario-situation">{block.situation}</p>
      <RadioGroup
        className="lms-options"
        value={value}
        disabled={disabled}
        aria-labelledby={promptId}
        onValueChange={(next) => onChange(String(next))}
      >
        {block.options.map((option, index) => (
          <label
            key={option.id}
            className={optionClass(reveal, option.correct, option.id === value)}
          >
            <RadioGroupItem value={option.id} />
            <OptionKey label={optionKey(index)} />
            <span className="lms-option-text">
              {option.text}
              {reveal && option.id !== value && (
                <span className="lms-scenario-outcome">{option.outcome}</span>
              )}
            </span>
            {reveal && option.correct && (
              <span className="lms-option-tag">Best response</span>
            )}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
