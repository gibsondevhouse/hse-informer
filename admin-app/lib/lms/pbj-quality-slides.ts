import { pbjCourse } from './pbj-course.ts';
import type { TemplateSlide } from './presentation';

/** Quality pilot: existing PBJ source material, ungraded and presentation-only. */
export const pbjQualitySlides: TemplateSlide[] = [
  {
    id: 'final-inspection',
    chapter: 'Quality & cleanup',
    details: { sources: pbjCourse.references },
    eyebrow: 'Inspect the evidence',
    title: 'Take one final look',
    lead: 'Appearance and recipient suitability both need a check.',
    layout: 'template',
    template: 'inspection',
    content: {
      activityId: 'finished-result-review',
      visual: {
        art: 'quality-inspect',
        description:
          'A training illustration shows two unequal sandwich portions on a plate. Fruit spread extends beyond the lower crust. No ingredient label or recipient information is shown.',
        aspectRatio: 1.5,
      },
      annotations: [
        {
          id: 'filling',
          label: 'Contained filling',
          text: 'Fruit spread extends outside the bread. Use a thinner layer and keep it within the crust.',
          x: 40,
          y: 74,
        },
        {
          id: 'halves',
          label: 'Even halves',
          text: 'The two portions differ in size. If a cut is requested, look for even halves and keep the filling inside.',
          x: 69,
          y: 40,
        },
        {
          id: 'recipient',
          label: 'Recipient match',
          text: 'Appearance cannot confirm ingredient suitability or exclude cross-contact. Confirm the recipient’s needs and the ingredients and handling used.',
          x: 85,
          y: 80,
        },
      ],
      decision: {
        situation:
          'Check coverage, layers, exterior, and the recipient match. Do not serve if you suspect allergen cross-contact; remake with the correct ingredients and a clean setup.',
        prompt: 'Which final review fits the evidence?',
        options: [
          {
            id: 'inspect-and-confirm',
            text: 'Notice the leaking filling and unequal portions, then confirm the ingredient and recipient match separately.',
            correct: true,
            outcome:
              'The illustration shows filling outside the crust and unequal portions. Check even coverage, balanced layers, and a clean, dry exterior as well. Appearance does not establish the recipient match.',
          },
          {
            id: 'appearance',
            text: 'The sandwich looks recognizable, so its appearance confirms that it is suitable for the recipient.',
            correct: false,
            outcome:
              'A recognizable sandwich can still have quality issues or an unsuitable ingredient. The picture shows leaking filling and unequal portions; ingredient suitability needs a separate check.',
          },
          {
            id: 'scrape',
            text: 'If the wrong bread was used, transfer the filling to different bread and serve it.',
            correct: false,
            outcome:
              'Do not scrape the filling onto new bread if the wrong bread was used or cross-contact is suspected. Remake the sandwich with the correct ingredients and a clean setup.',
          },
        ],
      },
    },
    caption:
      'Inspect the result. Do not serve if you suspect allergen cross-contact.',
    transcript: [
      'A training illustration shows two unequal sandwich portions on a plate. Fruit spread extends beyond the lower crust. No ingredient label or recipient information is shown.',
      'Check coverage, layers, exterior, and the recipient match. Do not serve if you suspect allergen cross-contact; remake with the correct ingredients and a clean setup.',
      'Which final review fits the evidence?',
      'Fruit spread extends outside the bread. Use a thinner layer and keep it within the crust.',
      'The two portions differ in size. If a cut is requested, look for even halves and keep the filling inside.',
      'Appearance cannot confirm ingredient suitability or exclude cross-contact. Confirm the recipient’s needs and the ingredients and handling used.',
      'Notice the leaking filling and unequal portions, then confirm the ingredient and recipient match separately. The illustration shows filling outside the crust and unequal portions. Check even coverage, balanced layers, and a clean, dry exterior as well. Appearance does not establish the recipient match.',
      'The sandwich looks recognizable, so its appearance confirms that it is suitable for the recipient. A recognizable sandwich can still have quality issues or an unsuitable ingredient. The picture shows leaking filling and unequal portions; ingredient suitability needs a separate check.',
      'If the wrong bread was used, transfer the filling to different bread and serve it. Do not scrape the filling onto new bread if the wrong bread was used or cross-contact is suspected. Remake the sandwich with the correct ingredients and a clean setup.',
    ],
    takeaway: 'Do not serve if you suspect allergen cross-contact.',
  },
  {
    id: 'troubleshooting',
    chapter: 'Quality & cleanup',
    details: { sources: pbjCourse.references },
    eyebrow: 'Compare the change',
    title: 'Read the result',
    lead: 'Compare a common problem with the technique to aim for.',
    layout: 'template',
    template: 'before-after',
    content: {
      activityId: 'technique-adjustments',
      pairs: [
        {
          id: 'pressure',
          label: 'Pressure & tearing',
          before: {
            art: 'quality-pressure-before',
            description:
              'The top bread slice has a jagged tear where spread was forced across it.',
            aspectRatio: 1.5,
          },
          after: {
            art: 'quality-pressure-after',
            description:
              'The bread is intact beneath a smooth layer of spread.',
            aspectRatio: 1.5,
          },
          explanation:
            'Torn bread often indicates too much pressure or a stiff spread. Use lighter strokes instead of forcing the spread across soft bread.',
          check: 'Use gentle strokes and check that the bread stays intact.',
        },
        {
          id: 'thickness',
          label: 'Layer thickness',
          before: {
            art: 'quality-thickness-before',
            description:
              'A thick fruit layer bulges past the lower crust and drips onto the plate.',
            aspectRatio: 1.5,
          },
          after: {
            art: 'quality-thickness-after',
            description: 'A thin fruit layer stays within the bread’s outline.',
            aspectRatio: 1.5,
          },
          explanation:
            'Leaking fruit spread usually calls for less spread, applied in a thinner layer within the crust.',
          check: 'Check the filling remains inside when the sandwich closes.',
        },
        {
          id: 'coverage',
          label: 'Coverage & texture',
          before: {
            art: 'quality-coverage-before',
            description:
              'Peanut butter sits in the middle of the slice, leaving broad bare edges.',
            aspectRatio: 1.5,
          },
          after: {
            art: 'quality-coverage-after',
            description:
              'An even peanut butter layer reaches the edges of the slice.',
            aspectRatio: 1.5,
          },
          explanation:
            'Uneven bites call for consistent coverage. For moisture that develops while a sandwich waits, consider the barrier method.',
          check:
            'Reach the edges evenly. If a jar has been cross-contaminated, stop using it and follow the applicable handling procedure.',
        },
      ],
    },
    caption:
      'Adjust pressure, layer thickness, and coverage to improve the result.',
    transcript: [
      'Pressure & tearing',
      'The top bread slice has a jagged tear where spread was forced across it.',
      'The bread is intact beneath a smooth layer of spread.',
      'Torn bread often indicates too much pressure or a stiff spread. Use lighter strokes instead of forcing the spread across soft bread.',
      'Use gentle strokes and check that the bread stays intact.',
      'Layer thickness',
      'A thick fruit layer bulges past the lower crust and drips onto the plate.',
      'A thin fruit layer stays within the bread’s outline.',
      'Leaking fruit spread usually calls for less spread, applied in a thinner layer within the crust.',
      'Check the filling remains inside when the sandwich closes.',
      'Coverage & texture',
      'Peanut butter sits in the middle of the slice, leaving broad bare edges.',
      'An even peanut butter layer reaches the edges of the slice.',
      'Uneven bites call for consistent coverage. For moisture that develops while a sandwich waits, consider the barrier method.',
      'Reach the edges evenly. If a jar has been cross-contaminated, stop using it and follow the applicable handling procedure.',
    ],
  },
  {
    id: 'serve-or-pack',
    chapter: 'Quality & cleanup',
    details: { sources: pbjCourse.references },
    eyebrow: 'Choose the finish',
    title: 'Serve now or prepare for later',
    lead: 'Choose the presentation to suit the plan.',
    layout: 'template',
    template: 'comparison-activity',
    content: {
      activityId: 'serving-plan',
      items: [
        {
          id: 'now',
          label: 'Serve now',
          text: 'Place the sandwich on a clean, dry plate. If cut, turn the cut faces upward so the layers are visible.',
          check: 'Confirm the recipient match before service.',
          visual: {
            art: 'quality-serve',
            description:
              'Two even sandwich halves sit on a clean plate with their cut faces visible.',
            aspectRatio: 1.5,
          },
        },
        {
          id: 'later',
          label: 'Pack for later',
          text: 'Wrap the sandwich. The barrier method can help preserve the bread’s texture while it waits.',
          check:
            'Follow ingredient labels and the applicable storage procedure.',
          visual: {
            art: 'quality-pack',
            description:
              'A sandwich is enclosed in a folded wrapper, ready for the applicable storage step.',
            aspectRatio: 1.5,
          },
        },
      ],
    },
    caption:
      'Plate for immediate service, or wrap and store according to the ingredients and procedure.',
    transcript: [
      'Place the sandwich on a clean, dry plate. If cut, turn the cut faces upward so the layers are visible.',
      'Confirm the recipient match before service.',
      'Two even sandwich halves sit on a clean plate with their cut faces visible.',
      'Wrap the sandwich. The barrier method can help preserve the bread’s texture while it waits.',
      'Follow ingredient labels and the applicable storage procedure.',
      'A sandwich is enclosed in a folded wrapper, ready for the applicable storage step.',
    ],
  },
  {
    id: 'variations',
    chapter: 'Quality & cleanup',
    details: { sources: pbjCourse.references },
    eyebrow: 'A branching practice case',
    title: 'A variation needs the same checks',
    lead: 'Your choices determine the next situation.',
    layout: 'template',
    template: 'branching-case',
    content: {
      activityId: 'substitution-case',
      startNodeId: 'substitute',
      nodes: [
        {
          id: 'substitute',
          kind: 'decision',
          title: 'A different bread',
          situation:
            'The usual bread is unavailable. Someone offers a gluten-free alternative. A recipient is waiting.',
          prompt: 'What should happen before using the alternative?',
          options: [
            {
              id: 'check',
              text: 'Read the label and confirm the recipient’s needs before using it.',
              correct: true,
              outcome:
                'A substitute is not automatically suitable for every allergy. Check the ingredient and recipient match first.',
              nextNodeId: 'timing',
            },
            {
              id: 'assume',
              text: 'Use it because gluten-free means it avoids the recipient’s other allergens too.',
              correct: false,
              outcome:
                'Gluten-free does not mean free of other allergens. The ingredient choice still needs a label and recipient check.',
              nextNodeId: 'mismatch',
            },
          ],
        },
        {
          id: 'mismatch',
          kind: 'decision',
          title: 'The mismatch is discovered',
          situation:
            'In this practice case, the alternative was used before checking. A subsequent label check shows it does not match the recipient’s needs.',
          prompt: 'How should you respond?',
          options: [
            {
              id: 'remake',
              text: 'Do not serve it. Remake with the correct ingredients and a clean setup.',
              correct: true,
              outcome:
                'Remaking with suitable ingredients and a clean setup addresses the mismatch. Scraping the filling onto different bread does not.',
              nextNodeId: 'timing',
            },
            {
              id: 'transfer',
              text: 'Scrape the filling onto the usual bread and keep the sandwich.',
              correct: false,
              outcome:
                'Do not transfer filling from an unsuitable sandwich onto new bread. Stop and remake with the correct ingredients and a clean setup.',
              nextNodeId: 'stop',
            },
          ],
        },
        {
          id: 'timing',
          kind: 'decision',
          title: 'The serving plan changes',
          situation:
            'The ingredient and recipient match is now confirmed. You plan to add fresh fruit, but the sandwich was originally intended for later service.',
          prompt: 'What needs to change?',
          options: [
            {
              id: 'prompt',
              text: 'Serve the fresh-fruit variation promptly, and follow the applicable storage guidance.',
              correct: true,
              outcome:
                'Added bananas or berries introduce moisture. The course calls for serving a fresh-fruit variation promptly.',
              nextNodeId: 'ready',
            },
            {
              id: 'unchanged',
              text: 'Add the fruit and keep the later-service plan unchanged.',
              correct: false,
              outcome:
                'Fresh fruit changes the moisture and serving considerations. Revisit the plan and serve this variation promptly.',
              nextNodeId: 'revise',
            },
          ],
        },
        {
          id: 'stop',
          kind: 'outcome',
          title: 'Stop and remake',
          text: 'The recipient mismatch remains unresolved. Do not serve this sandwich. Remake with correct ingredients and a clean setup. Review how the unchecked substitution led to this point.',
        },
        {
          id: 'ready',
          kind: 'outcome',
          title: 'A checked variation',
          text: 'You confirmed the ingredient match and adjusted the serving plan for fresh fruit. Check seed or soy spread labels against the recipient’s needs too. Different bread or a crunchy spread changes texture and spreading technique. Keep the same checks whenever ingredients change.',
        },
        {
          id: 'revise',
          kind: 'outcome',
          title: 'Revise the serving plan',
          text: 'The ingredient match was checked, but added fruit changes the moisture considerations. Serve the fresh-fruit variation promptly and follow the applicable storage instructions. Revisit the case to try another route.',
        },
      ],
    },
    caption:
      'Check the recipient and label whenever ingredients change. Serve fresh-fruit variations promptly.',
    transcript: [
      'A different bread',
      'The usual bread is unavailable. Someone offers a gluten-free alternative. A recipient is waiting.',
      'What should happen before using the alternative?',
      'Read the label and confirm the recipient’s needs before using it. A substitute is not automatically suitable for every allergy. Check the ingredient and recipient match first.',
      'Use it because gluten-free means it avoids the recipient’s other allergens too. Gluten-free does not mean free of other allergens. The ingredient choice still needs a label and recipient check.',
      'The mismatch is discovered',
      'In this practice case, the alternative was used before checking. A subsequent label check shows it does not match the recipient’s needs.',
      'How should you respond?',
      'Do not serve it. Remake with the correct ingredients and a clean setup. Remaking with suitable ingredients and a clean setup addresses the mismatch. Scraping the filling onto different bread does not.',
      'Scrape the filling onto the usual bread and keep the sandwich. Do not transfer filling from an unsuitable sandwich onto new bread. Stop and remake with the correct ingredients and a clean setup.',
      'The serving plan changes',
      'The ingredient and recipient match is now confirmed. You plan to add fresh fruit, but the sandwich was originally intended for later service.',
      'What needs to change?',
      'Serve the fresh-fruit variation promptly, and follow the applicable storage guidance. Added bananas or berries introduce moisture. The course calls for serving a fresh-fruit variation promptly.',
      'Add the fruit and keep the later-service plan unchanged. Fresh fruit changes the moisture and serving considerations. Revisit the plan and serve this variation promptly.',
      'Stop and remake',
      'The recipient mismatch remains unresolved. Do not serve this sandwich. Remake with correct ingredients and a clean setup. Review how the unchecked substitution led to this point.',
      'A checked variation',
      'You confirmed the ingredient match and adjusted the serving plan for fresh fruit. Check seed or soy spread labels against the recipient’s needs too. Different bread or a crunchy spread changes texture and spreading technique. Keep the same checks whenever ingredients change.',
      'Revise the serving plan',
      'The ingredient match was checked, but added fruit changes the moisture considerations. Serve the fresh-fruit variation promptly and follow the applicable storage instructions. Revisit the case to try another route.',
    ],
  },
  {
    id: 'store-ingredients',
    chapter: 'Quality & cleanup',
    details: { sources: pbjCourse.references },
    eyebrow: 'Reset · Ingredients',
    title: 'Close, label, return',
    lead: 'Put every ingredient back in its proper place.',
    layout: 'template',
    template: 'text-ledger',
    content: {
      sections: [
        {
          id: 'seal',
          title: 'Wipe & seal',
          text: 'Clean jar threads and lids, then close them securely.',
        },
        {
          id: 'label',
          title: 'Follow the label',
          text: 'Refrigerate opened products when their instructions require it.',
          more: [
            {
              title: 'Use the product’s instructions',
              text: 'Follow each product’s storage instructions and the applicable kitchen procedure. A familiar jar is not a reason to skip the label.',
            },
          ],
        },
        {
          id: 'organize',
          title: 'Keep storage organized',
          text: 'Return products to their designated area and mark opened jars according to procedure.',
          more: [
            {
              title: 'Use the designated area',
              text: 'Keep peanut products in the dedicated storage area where the kitchen procedure calls for one.',
            },
          ],
        },
      ],
    },
    caption:
      'Clean closures and label-led storage finish the ingredient part of the reset.',
    transcript: [
      'Clean jar threads and lids, then close them securely.',
      'Refrigerate opened products when their instructions require it.',
      'Follow each product’s storage instructions and the applicable kitchen procedure. A familiar jar is not a reason to skip the label.',
      'Return products to their designated area and mark opened jars according to procedure.',
      'Keep peanut products in the dedicated storage area where the kitchen procedure calls for one.',
    ],
  },
  {
    id: 'reset-station',
    chapter: 'Quality & cleanup',
    details: { sources: pbjCourse.references },
    eyebrow: 'Compare the reset',
    title: 'Leave the station ready',
    lead: 'Review the change, then verify the cleanup actions.',
    layout: 'template',
    template: 'before-after',
    content: {
      activityId: 'station-reset-comparison',
      pairs: [
        {
          id: 'tools',
          label: 'Tools',
          before: {
            art: 'quality-tools-before',
            description:
              'Used spreaders carry peanut butter and fruit-spread residue. A table knife lies flat and visible beside them.',
            aspectRatio: 1.5,
          },
          after: {
            art: 'quality-tools-after',
            description:
              'The spreaders and table knife are clean, separated, and laid out to dry.',
            aspectRatio: 1.5,
          },
          explanation:
            'Wash the spreaders and knife after use, rinse, and allow them to dry. Keep the blade visible and controlled.',
          check:
            'Check that the tools are clean and drying; do not hide a knife in soapy water.',
        },
        {
          id: 'board',
          label: 'Board & counter',
          before: {
            art: 'quality-board-before',
            description:
              'Crumbs and spread residue remain on the board and nearby counter.',
            aspectRatio: 1.5,
          },
          after: {
            art: 'quality-board-after',
            description:
              'The board and counter have no visible residue; the board is stored upright with both faces able to dry.',
            aspectRatio: 1.5,
          },
          explanation:
            'Clean and sanitize the board and counter following the sanitizer label. Store the board so both faces can dry.',
          check:
            'A clean appearance alone does not verify sanitizing. Follow the label’s concentration and contact time.',
        },
        {
          id: 'towels',
          label: 'Towels & hands',
          before: {
            art: 'quality-towels-before',
            description:
              'Used paper towels and a soiled reusable towel remain beside the station.',
            aspectRatio: 1.5,
          },
          after: {
            art: 'quality-towels-after',
            description:
              'Single-use towels are in the waste bin, the reusable towel is in the laundry, and handwashing finishes the reset.',
            aspectRatio: 1.5,
          },
          explanation:
            'Discard single-use towels and place soiled reusable towels in the laundry. Wash hands once more.',
          check: 'Leave the station ready for the next task.',
        },
      ],
    },
    caption:
      'Clean tools and surfaces, remove used towels, and finish by washing your hands.',
    transcript: [
      'Tools',
      'Used spreaders carry peanut butter and fruit-spread residue. A table knife lies flat and visible beside them.',
      'The spreaders and table knife are clean, separated, and laid out to dry.',
      'Wash the spreaders and knife after use, rinse, and allow them to dry. Keep the blade visible and controlled.',
      'Check that the tools are clean and drying; do not hide a knife in soapy water.',
      'Board & counter',
      'Crumbs and spread residue remain on the board and nearby counter.',
      'The board and counter have no visible residue; the board is stored upright with both faces able to dry.',
      'Clean and sanitize the board and counter following the sanitizer label. Store the board so both faces can dry.',
      'A clean appearance alone does not verify sanitizing. Follow the label’s concentration and contact time.',
      'Towels & hands',
      'Used paper towels and a soiled reusable towel remain beside the station.',
      'Single-use towels are in the waste bin, the reusable towel is in the laundry, and handwashing finishes the reset.',
      'Discard single-use towels and place soiled reusable towels in the laundry. Wash hands once more.',
      'Leave the station ready for the next task.',
    ],
  },
];
