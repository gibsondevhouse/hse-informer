'use client';

import { useId, useState } from 'react';
import { BadgeCheck, ClipboardCheck, MessageSquareText, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type {
  AttestationBlock,
  ChecklistBlock,
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
