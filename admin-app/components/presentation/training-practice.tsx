'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import type { PracticeContent } from '@/lib/lms/presentation';
import { FittedPanel } from './fitted-panel';
import './training-practice.css';

/** Temporary viewing state. This has no grading or completion contract. */
export type PracticeResponse = { selected?: string; submitted?: string };

type PracticePhase = 'scenario' | 'answer' | 'feedback';

export function TrainingPractice({
  id,
  content,
  response = {},
  onChange,
}: {
  id: string;
  content: PracticeContent;
  response?: PracticeResponse;
  onChange: (response: PracticeResponse) => void;
}) {
  const [phase, setPhase] = useState<PracticePhase>(() =>
    response.submitted ? 'feedback' : response.selected ? 'answer' : 'scenario',
  );
  const firstOption = useRef<HTMLInputElement>(null);
  const feedback = useRef<HTMLOutputElement>(null);
  const scenarioAction = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<'choice' | 'feedback' | 'action' | null>(null);
  const selectedOption = content.options.find(
    (option) => option.id === response.selected,
  );
  const submittedOption = content.options.find(
    (option) => option.id === response.submitted,
  );

  useEffect(() => {
    const target =
      pendingFocus.current === 'choice'
        ? firstOption.current
        : pendingFocus.current === 'feedback'
          ? feedback.current
          : pendingFocus.current === 'action'
            ? scenarioAction.current
            : null;
    if (target) {
      target.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [phase, response.submitted]);

  function openPhase(next: PracticePhase) {
    pendingFocus.current =
      next === 'answer'
        ? 'choice'
        : next === 'feedback'
          ? 'feedback'
          : 'action';
    setPhase(next);
  }

  const isFeedback = phase === 'feedback' && Boolean(submittedOption);
  const practiceStep = phase === 'scenario' ? 1 : isFeedback ? 3 : 2;
  const phaseTitle =
    phase === 'scenario'
      ? 'Read the situation'
      : isFeedback
        ? 'Feedback'
        : 'Choose an answer';

  return (
    <form
      className="training-practice-flow"
      data-practice
      data-practice-phase={phase}
      onSubmit={(event) => {
        event.preventDefault();
        if (phase !== 'answer' || !selectedOption || response.submitted) return;
        pendingFocus.current = 'feedback';
        onChange({
          selected: selectedOption.id,
          submitted: selectedOption.id,
        });
        setPhase('feedback');
      }}
    >
      <header className="training-practice-flow-heading">
        <h2
          id={`${id}-practice-heading`}
          className={isFeedback ? 'training-feedback-title' : undefined}
        >
          {phaseTitle}
        </h2>
        <ol
          className="training-practice-phase-track"
          aria-label={`Practice step ${practiceStep} of 3`}
        >
          {['Read', 'Decide', 'Review'].map((label, index) => (
            <li
              key={label}
              aria-current={practiceStep === index + 1 ? 'step' : undefined}
              data-complete={practiceStep > index + 1 || undefined}
            >
              <span aria-hidden="true">{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </header>

      {phase === 'scenario' ? (
        <FittedPanel
          key="scenario"
          label="Practice situation"
          sections={[
            {
              id: 'situation',
              title: 'The situation',
              text: content.situation,
            },
            { id: 'prompt', title: 'Your decision', text: content.prompt },
          ]}
        />
      ) : isFeedback && submittedOption ? (
        <output
          ref={feedback}
          tabIndex={-1}
          className="training-practice-flow-feedback"
          aria-labelledby={`${id}-practice-heading`}
          data-correct={submittedOption.correct}
        >
          <FittedPanel
            key={`feedback-${submittedOption.id}`}
            label="Practice feedback"
            sections={[
              {
                id: 'reasoning',
                title: submittedOption.correct
                  ? 'Recommended action'
                  : 'Reconsider this response',
                text: submittedOption.outcome,
              },
              {
                id: 'submitted',
                title: 'Your response',
                text: submittedOption.text,
              },
            ]}
          />
        </output>
      ) : (
        <FittedPanel
          key={selectedOption?.id ?? 'choose'}
          label="Selected answer"
          sections={[
            selectedOption
              ? {
                  id: selectedOption.id,
                  title: `Answer ${String.fromCharCode(65 + content.options.indexOf(selectedOption))}`,
                  text: selectedOption.text,
                }
              : {
                  id: 'choose',
                  title: content.prompt,
                  text: 'Select a letter to read that answer, then check your response when you are ready.',
                },
            { id: 'prompt', title: 'Your decision', text: content.prompt },
            {
              id: 'situation',
              title: 'Review the situation',
              text: content.situation,
            },
          ]}
        />
      )}

      <div
        className="training-practice-flow-actions"
        data-answer-controls={phase === 'answer' || undefined}
      >
        {phase === 'scenario' ? (
          <button
            ref={scenarioAction}
            type="button"
            className="training-practice-action training-practice-action--primary"
            onClick={() => openPhase(submittedOption ? 'feedback' : 'answer')}
          >
            {submittedOption
              ? 'Review feedback'
              : selectedOption
                ? 'Review answers'
                : 'Choose answer'}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : isFeedback ? (
          <>
            <button
              type="button"
              className="training-practice-action"
              onClick={() => openPhase('scenario')}
            >
              <ArrowLeft size={17} aria-hidden="true" /> Scenario
            </button>
            <button
              type="button"
              className="training-practice-action training-practice-action--primary"
              onClick={() => {
                pendingFocus.current = 'choice';
                onChange({});
                setPhase('answer');
              }}
            >
              <RotateCcw size={17} aria-hidden="true" /> Try again
            </button>
          </>
        ) : (
          <>
            <fieldset aria-describedby={`${id}-answer-instructions`}>
              <legend className="training-sr-only">{content.prompt}</legend>
              <span
                id={`${id}-answer-instructions`}
                className="training-sr-only"
              >
                Select an answer to read its full response. Choose Check answer
                to submit. The decision and situation can be reviewed using the
                reading panel page controls.
              </span>
              <div className="training-practice-flow-choices">
                {content.options.map((option, index) => (
                  <label
                    key={option.id}
                    data-selected={response.selected === option.id}
                  >
                    <input
                      ref={index === 0 ? firstOption : undefined}
                      type="radio"
                      name={`${id}-response`}
                      value={option.id}
                      aria-label={`Answer ${String.fromCharCode(65 + index)}: ${option.text}`}
                      checked={response.selected === option.id}
                      onChange={() => onChange({ selected: option.id })}
                    />
                    <span aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="training-practice-action training-practice-action--primary"
              disabled={!selectedOption}
            >
              Check answer
            </button>
          </>
        )}
      </div>
    </form>
  );
}
