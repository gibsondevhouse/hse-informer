import type { ReactNode } from 'react';
import { ArrowRight, Check, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroupItem } from '@/components/ui/radio-group';
import {
  breathingHazards,
  scenarioOptions,
  type PreviewAction,
  type PreviewState,
} from '@/lib/respiratory-preview';

/** Short reading blocks can be paged at the available viewport height. */
export function lessonBlocks(
  state: PreviewState,
  dispatch: (action: PreviewAction) => void,
): ReactNode[] {
  switch (state.step) {
    case 0:
      return [
        <div key="block-10" className="rp-welcome-title">
          <Wind size={28} />
          <span className="rp-kicker">Foundational safety training</span>
          <h1>Respiratory Protection</h1>
        </div>,
        <p key="block-11" className="rp-lead">
          Learn how your employer&apos;s respiratory-protection program applies to
          your task, and what to do when conditions change.
        </p>,
        <p key="block-12" className="rp-context">
          Chemical manufacturing teams · 7-module course in development
        </p>,
        <div key="block-13">
          <h2>Module 1: hazards and program scope</h2>
          <p>In this opening module, you will learn to:</p>
        </div>,
        <p key="block-14" className="rp-objective">
          <Check size={17} />
          Recognize breathing hazards in familiar chemical-plant tasks.
        </p>,
        <p key="block-15" className="rp-objective">
          <Check size={17} />
          Distinguish employer-required respirator use from voluntary use.
        </p>,
        <p key="block-16" className="rp-objective">
          <Check size={17} />
          Find the site program and follow its stop-work and reporting rules.
        </p>,
        <p key="block-18" className="rp-note">
          This preview has no site chemical inventory, exposure assessment,
          written program, respirator assignment, emergency contacts, or
          equipment. Your employer must supply and teach those worksite-specific
          details.
        </p>,
        <p key="block-17" className="rp-note">
          <strong>You’re viewing an early lesson draft.</strong>Only opening
          sections of Module 1 are available. Full instruction, demonstrations,
          narration, practical checks, and assessment remain in development.
        </p>,
      ];
    case 1:
      return [
        <h1 key="block-20">Start with the task and the site program.</h1>,
        <p key="block-21" className="rp-lead">
          Respiratory hazards depend on the material, process, task, controls,
          and conditions. Your employer evaluates those hazards and identifies
          the respirator, if any, for the work.
        </p>,
        <div key="block-22" className="rp-example">
          <h2>Production and packaging</h2>
          <p>
            Opening bags, charging a mixer, sampling, or filling containers can
            release dust, mist, vapor, or gas. The actual site assessment and
            work instructions determine the exposure and controls.
          </p>
        </div>,
        <p key="block-23">
          Engineering and work-practice controls are addressed first where
          feasible. A respirator is selected as part of the employer&apos;s program,
          not as a worker-selected substitute when a control fails.
        </p>,
        <div key="block-24" className="rp-example">
          <h2>Cleaning and maintenance</h2>
          <p>
            Spraying a cleaner, opening process equipment, or welding can create
            different breathing hazards. A different task may need different
            controls.
          </p>
        </div>,
        <div key="block-25" className="rp-example">
          <h2>Changeovers and abnormal conditions</h2>
          <p>
            A new material, a ventilation failure, or an unexpected release can
            change the hazard.
          </p>
        </div>,
        <p key="block-26">
          A familiar task, clear-looking air, or lack of immediate symptoms does
          not replace the current hazard assessment and site instructions.
        </p>,
        <p key="block-27" className="rp-note">
          <strong>Before work</strong>Know the task-specific hazards, required
          controls, assigned respirator (if applicable), and where the current
          written program and procedures are available.
        </p>,
        <p key="block-28">
          If the material, equipment, or conditions do not match the
          instructions, stop and get the issue resolved.
        </p>,
      ];
    case 2:
      return [
        <h1 key="block-31">Not every breathing hazard is a particle.</h1>,
        <p key="block-32" className="rp-lead">
          The form of the contaminant matters. Protection that filters particles
          does not automatically protect against gases or vapors.
        </p>,
        ...breathingHazards.flatMap((hazard) => [
          <div key={hazard.name} className="rp-hazard">
            <h2>
              {hazard.name} <span>{hazard.kind}</span>
            </h2>
            <p>{hazard.explanation}</p>
          </div>,
          <p key={`${hazard.name}-example`} className="rp-example-caption">
            <strong>{hazard.name} at work:</strong> {hazard.example}
          </p>,
        ]),
        <p key="block-34" className="rp-note">
          <strong>
            A particle filter does not protect against gases or vapors.
          </strong>
          A particulate-only respirator does not remove gases or vapors.
        </p>,
        <p key="block-35">
          The employer must evaluate the hazard and select suitable respiratory
          protection within its program. Do not substitute equipment yourself.
        </p>,
        <div key="block-36" className="rp-example">
          <h2>Required use and voluntary use are different</h2>
          <p>
            If the employer requires a respirator for a task or area, it is
            required use even when exposure measurements are below a limit. The
            applicable written program and its safeguards apply.
          </p>
          <p>
            When a worker chooses a filtering facepiece and neither the
            employer nor a standard requires it, Appendix D information applies.
            Voluntary use of other respirators also requires the employer to
            address medical ability and safe cleaning, storage, and maintenance.
          </p>
        </div>,
      ];
    case 3:
      return [
        <h1 key="block-38">Air can look normal and still be unsafe.</h1>,
        <p key="block-39" className="rp-lead">
          You cannot establish safe breathing conditions by looking around,
          taking a sniff, or waiting to see how you feel.
        </p>,
        <div key="block-40" className="rp-example">
          <h2>“I can’t see anything.”</h2>
          <p>
            Many particles are too small to see. Gases and vapors may also be
            invisible. Clear-looking air is not an exposure measurement.
          </p>
        </div>,
        <div key="block-41" className="rp-example">
          <h2>“There’s no unusual smell.”</h2>
          <p>
            Not all hazards have a useful warning odor. Your ability to notice a
            smell can also change. No smell does not establish that the air is
            safe.
          </p>
        </div>,
        <div key="block-42">
          <h2>A separate hazard: too little oxygen</h2>
          <p>
            Some processes can use up oxygen, and gases such as nitrogen can
            displace it.
          </p>
        </div>,
        <p key="block-43">
          An air-purifying respirator filters surrounding air; it does not
          supply oxygen.
        </p>,
        <p key="block-44" className="rp-warning">
          <strong>
            Do not enter an area with unknown or suspected oxygen-deficient
            conditions.
          </strong>
        </p>,
        <p key="block-45">
          OSHA treats oxygen-deficient atmospheres as IDLH, subject to a narrow
          exception. If conditions are unknown or suspected, stay out, keep
          clear, and follow the site’s reporting or emergency instructions. Do
          not enter to investigate or attempt an unplanned rescue.
        </p>,
        <p key="block-46" className="rp-note">
          Respirator selection and atmospheric evaluation are assigned
          responsibilities, not decisions to improvise during a task. Never
          use an air-purifying respirator for an unknown or IDLH atmosphere.
        </p>,
      ];
    case 4: {
      const selected = scenarioOptions.find(
        (option) => option.id === state.answer,
      );
      if (state.checked && selected)
        return [
          <h1 key="block-51">
            {state.answer === 'stop'
              ? 'That is the protective decision.'
              : 'Consider the changed conditions.'}
          </h1>,
          ...selected.feedback.split(/(?<=\.)\s+/).map((sentence) => (
            <p
              key={sentence}
              className={state.answer === 'stop' ? 'rp-success' : 'rp-warning'}
            >
              {sentence}
            </p>
          )),
          <p key="block-53">
            {state.answer === 'stop'
              ? 'Continue to the opening lesson recap.'
              : 'Choose another response, then check your answer again.'}
          </p>,
          <p key="block-54" className="rp-context">
            Practice only. This response is not recorded as a training
            assessment.
          </p>,
        ];
      return [
        <h1 key="block-57">The exhaust stops during bag charging.</h1>,
        <p key="block-58" className="rp-lead">
          You are adding powder to a mixer. Local exhaust ventilation stops, and
          a dust cloud escapes. A moment later, the cloud is less visible. You
          feel fine.
        </p>,
        <h2 key="block-59">What should you do next?</h2>,
        ...scenarioOptions.map((option, index) => (
          <label key={option.id} className="rp-option">
            <RadioGroupItem value={option.id} aria-label={option.text} />
            <span>
              <strong>{String.fromCharCode(65 + index)}.</strong> {option.text}
            </span>
          </label>
        )),
        <div key="block-61">
          <Button
            onClick={() => dispatch({ type: 'check' })}
            disabled={!state.answer}
          >
            Check answer <ArrowRight size={16} />
          </Button>
          <p className="rp-context rp-practice-note">
            Practice only. This response is not recorded as a training
            assessment.
          </p>
        </div>,
      ];
    }
    default:
      return [
        <h1 key="block-65">
          Recognize the hazard before relying on protection.
        </h1>,
        <p key="block-66" className="rp-lead">
          Know the task, the employer&apos;s program, and the site response before
          relying on respiratory protection.
        </p>,
        <p key="block-67" className="rp-recap">
          <strong>Know what the task can release.</strong>{' '}
          Dust, mist, and fume are particles. Gases and vapors need different
          consideration; the employer assesses the actual workplace hazard.
        </p>,
        <p key="block-68" className="rp-recap">
          <strong>Do not use your senses as a safety test.</strong>{' '}
          Clear air, no smell, and no immediate symptoms do not establish safe
          conditions.
        </p>,
        <p key="block-69" className="rp-recap">
          <strong>Know a critical protection limit.</strong>{' '}
          Air-purifying respirators do not supply oxygen. Stay out of unknown or
          suspected oxygen-deficient or IDLH atmospheres.
        </p>,
        <p key="block-70" className="rp-recap">
          <strong>Respond to a changed condition.</strong>{' '}
          Follow the site’s stop-work, reporting, and emergency instructions.
          Do not improvise a replacement for a failed control.
        </p>,
        <p key="block-73" className="rp-recap">
          <strong>Training is not authorization.</strong>{' '}
          Required users need training before use and at least annually.
          Medical evaluation, a tight-fitting respirator’s fit test, correct
          equipment issuance, and task authorization are separate
          employer-program checks.
        </p>,
        <div key="block-71" className="rp-note">
          <span className="rp-kicker">Next in development</span>
          <h2>Assigned respirators, selection, and limitations</h2>
          <p>
            How employer hazard assessment, respirator selection, fit, and
            limits connect to the task.
          </p>
        </div>,
        <p key="block-72" className="rp-note">
          <strong>End of this draft preview</strong>{' '}
          This has not completed the
          course, created a learning record, or established qualification. Six
          modules and the full assessment are still in development.
        </p>,
      ];
  }
}
