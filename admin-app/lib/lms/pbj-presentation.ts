import { pbjQualitySlides } from './pbj-quality-slides.ts';
import { pbjCourse } from './pbj-course.ts';
import type {
  PresentationCourse,
  PresentationSlide,
  TemplateSlide,
} from './presentation';

/** Compatibility alias for existing presentation consumers. */
export type PBJSlide = PresentationSlide;

const sources = pbjCourse.references;
const handwashingSource = sources[0];
const allergenSource = sources[1];
const foodCodeSource = sources[2];
const jobAid = {
  label: 'PBJ standard method · printable job aid',
  href: '/training/pb-and-j/job-aid',
};

/**
 * Presentation-only adaptation of pbjCourse (1.0.0-preview).
 * Sources are the course's existing CDC handwashing, FDA food allergies, and
 * FDA Food Code references. This preview has no graded completion contract.
 */
const overviewSlides: TemplateSlide[] = [
  {
    id: 'welcome',
    chapter: 'Overview',
    eyebrow: 'PBJ-101 · Course introduction',
    title: 'Peanut Butter and Jelly Sandwich Preparation',
    lead: 'One simple task. A method worth getting right.',
    layout: 'template',
    template: 'introduction',
    content: {
      purpose:
        'Prepare a consistent sandwich while checking ingredients, managing transfer between foods, and leaving the station ready for its next use.',
      audience:
        'Anyone learning or reviewing the method for preparing a sandwich for another person.',
      structure:
        'Begin with the whole task, then explore ingredients, safety and hygiene, workspace and tools, the seven-step procedure, and quality and cleanup.',
    },
    takeaway: 'Check. Prepare. Assemble. Inspect. Reset.',
    caption:
      'Follow a clear method, from the first ingredient check to the final cleanup.',
    transcript: [
      'Welcome to Peanut Butter and Jelly Sandwich Preparation. This presentation walks through one familiar task with care: choosing ingredients, preparing the station, assembling the sandwich, and leaving the workspace ready for its next use.',
      'Move through the slides at your own pace. The overview introduces the whole task; later chapters explain each part. This is a course design preview, with ungraded practice and no formal training record.',
    ],
    details: {
      explanation: [
        'Read the main slide for the immediate message. Open Slide details when you want a fuller explanation, a definition, or a source. The transcript provides the slide narrative separately.',
        'Use the outline or slide browser to revisit a topic. Practice responses are available during this presentation session and are cleared when the presentation is reloaded.',
      ],
      sources,
    },
  },
  {
    id: 'course-outcome',
    chapter: 'Overview',
    eyebrow: 'Learning objectives',
    title: 'A simple task, done with care',
    lead: 'Explain the decisions, follow the method, and verify the result.',
    layout: 'template',
    template: 'objectives',
    content: {
      groups: [
        {
          title: 'Preparation',
          items: [
            'Confirm the recipient’s needs and check every ingredient label.',
            'Identify where hands, tools, and surfaces could transfer residue.',
          ],
        },
        {
          title: 'Execution',
          items: [
            'Arrange a clean station with a dedicated utensil for each jar.',
            'Follow the seven-step assembly method using controlled, even layers.',
          ],
        },
        {
          title: 'Verification',
          items: [
            'Inspect the finished sandwich and confirm the recipient match.',
            'Explain how to store ingredients and reset the station.',
          ],
        },
      ],
    },
    caption:
      'Prepare thoughtfully, work consistently, and finish with a deliberate check.',
    transcript: [
      'By the end of the course, you should be able to explain the preparation decisions, carry out a repeatable assembly method, and verify the result.',
      'Preparation includes recipient and ingredient checks. Execution includes a clean station, separate utensils, and the seven-step method. Verification includes the sandwich, the recipient match, and the station reset.',
    ],
    details: {
      explanation: [
        'The objectives describe actions you can explain or demonstrate. Reviewing a slide alone does not demonstrate performance; use the procedure and job aid to support practice.',
      ],
      terms: [
        {
          term: 'Verification',
          definition:
            'A deliberate check that the completed task meets the intended standard.',
          example:
            'Before serving, inspect the sandwich and confirm the ingredients match the recipient.',
        },
      ],
    },
  },
  {
    id: 'learning-path',
    chapter: 'Overview',
    eyebrow: 'Your learning roadmap',
    title: 'See the whole task, then explore each part',
    lead: 'Choose a chapter to jump directly to its first slide.',
    layout: 'template',
    template: 'roadmap',
    content: {
      chapters: [
        {
          title: 'Overview',
          description:
            'Understand the outcome, transfer pathway, controls, and method.',
          targetSlideId: 'welcome',
        },
        {
          title: 'Ingredients',
          description:
            'Choose bread and spreads, read labels, and resolve uncertainty.',
          targetSlideId: 'ingredient-families',
        },
        {
          title: 'Safety & hygiene',
          description:
            'Consider the recipient, prevent cross-contact, and wash hands.',
          targetSlideId: 'know-the-recipient',
        },
        {
          title: 'Workspace & tools',
          description:
            'Prepare the surface, arrange the station, and select tools.',
          targetSlideId: 'station-layout',
        },
        {
          title: 'Procedure',
          description:
            'Follow the seven-step assembly method and adjust technique.',
          targetSlideId: 'step-1-inspect',
        },
        {
          title: 'Quality & cleanup',
          description: 'Inspect, serve or pack, store ingredients, and reset.',
          targetSlideId: 'final-inspection',
        },
      ],
    },
    caption:
      'Overview, ingredients, safety and hygiene, workspace and tools, procedure, and quality.',
    transcript: [
      'Begin with an overview of the whole task. The ingredients chapter covers product selection and the label check. Safety and hygiene explains cross-contact and handwashing.',
      'Workspace and tools prepares the station. Procedure follows the seven-step method. Quality and cleanup closes the task with inspection, serving, storage, and reset. Each chapter is open for direct navigation.',
    ],
  },
  {
    id: 'transfer-pathway',
    chapter: 'Overview',
    eyebrow: 'System diagram · Follow the transfer',
    title: 'An ingredient can travel beyond its jar',
    lead: 'Follow the pathway to see where preparation decisions matter.',
    layout: 'template',
    template: 'diagram',
    content: {
      nodes: [
        {
          id: 'ingredient',
          title: 'Ingredient',
          text: 'Peanut butter or another ingredient leaves its container.',
        },
        {
          id: 'contact',
          title: 'Utensil or surface',
          text: 'Residue can remain on a spreader, board, hands, or towel.',
        },
        {
          id: 'recipient',
          title: 'Food and recipient',
          text: 'Contact can carry that residue to another food served to someone else.',
        },
      ],
      description:
        'Ingredient residue can move from its container to a utensil or surface, then from that contact point to another food and the person who eats it. Each arrow represents a possible transfer, not an unavoidable event.',
      caption:
        'Transfer pathway: ingredient → utensil or surface → food and recipient.',
    },
    takeaway: 'Control the contact points throughout the task.',
    caption:
      'A spreader, board, hand, or towel can connect one ingredient to another food.',
    transcript: [
      'Start at the ingredient. When a spreader touches peanut butter, it can carry residue to the next thing it touches. A board, hand, or towel can also become a contact point.',
      'The pathway ends at another food and its recipient. Keeping ingredients, utensils, and the preparation area under control reduces opportunities for this transfer.',
    ],
    details: {
      explanation: [
        'A spreader moved from the peanut butter jar into the fruit spread connects the two products. Returning a utensil to a jar after it touches bread can introduce ingredients from the bread.',
        'Use the pathway to ask where contact occurs. The next slide pairs those opportunities with the habits taught in this course.',
      ],
      terms: [
        {
          term: 'Cross-contact',
          definition:
            'The unintended transfer of an allergen from one food or surface to another.',
          example: 'A peanut butter spreader is put into the fruit spread jar.',
        },
        {
          term: 'Dedicated utensil',
          definition:
            'A utensil assigned to one ingredient container during preparation.',
          example: 'Keep a separate clean spreader beside each jar.',
        },
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'transfer-controls',
    chapter: 'Overview',
    eyebrow: 'Controls comparison',
    title: 'Pair each opportunity with a preventive action',
    lead: 'Use the check that fits the point of contact.',
    layout: 'template',
    template: 'table',
    content: {
      caption:
        'Transfer opportunities and the preparation actions used in this course',
      rowLabels: [
        'Unclear requirements',
        'Shared spreaders',
        'Return dipping',
        'Hands and surfaces',
        'Recipient mismatch',
      ],
      columns: [
        'Transfer opportunity',
        'Preventive action',
        'Check before continuing',
      ],
      rows: [
        [
          'A label or recipient requirement is unclear.',
          'Pause preparation and confirm suitability; choose a clearly labeled product.',
          'The actual label can be read and matches the recipient’s needs.',
        ],
        [
          'A spreader moves between jars.',
          'Set out a separate clean utensil for each jar.',
          'Each utensil remains with its assigned jar.',
        ],
        [
          'A used spreader returns to a jar after touching bread.',
          'Use another clean utensil when more spread is needed.',
          'The utensil entering the jar has not touched bread or another spread.',
        ],
        [
          'Hands, boards, or towels carry residue between tasks.',
          'Wash hands and prepare clean tools and surfaces before resuming.',
          'The station is ready for the next food and recipient.',
        ],
        [
          'The finished sandwich does not match the recipient.',
          'Do not serve it; remake it with the correct ingredients and a clean setup.',
          'The ingredients and handling match the intended recipient.',
        ],
      ],
    },
    takeaway: 'Check the ingredient, the contact point, and the recipient.',
    caption:
      'Readable labels, separate utensils, clean hands and surfaces, and a final recipient check work together.',
    transcript: [
      'Different points in the task call for different checks. Confirm unclear labels before beginning. Keep each jar with its own clean utensil and avoid returning a utensil after it touches bread.',
      'Wash hands and restore tools and surfaces after contact that could transfer residue. Before serving, confirm that both the ingredients and their handling match the recipient.',
    ],
    details: {
      explanation: [
        'The table is a planning aid for the habits taught in the later chapters. Apply the action before continuing past its contact point.',
        'A neat appearance cannot confirm that ingredients match the recipient. Include the label check and handling history in the final decision.',
      ],
      terms: [
        {
          term: 'Preventive action',
          definition:
            'An action taken before proceeding to reduce an identified opportunity for an unwanted result.',
          example: 'Set out separate spreaders before either jar is opened.',
        },
      ],
      sources: [allergenSource, handwashingSource, foodCodeSource],
    },
  },
  {
    id: 'overview-method',
    chapter: 'Overview',
    eyebrow: 'Procedure overview',
    title: 'Prepare. Assemble. Inspect and reset.',
    lead: 'Keep the sequence visible and verify each stage before moving on.',
    layout: 'template',
    template: 'procedure',
    content: {
      steps: [
        {
          title: 'Prepare',
          text: 'Confirm the recipient and labels. Wash hands, prepare the surface, and arrange the bread, jars, separate spreaders, and serving materials.',
          caution:
            'Pause if an ingredient, label, or recipient requirement is unclear.',
          verification:
            'Readable labels, suitable ingredients, clean hands, a stable board, and dedicated utensils are ready.',
        },
        {
          title: 'Assemble',
          text: 'Lay out the slices, spread each ingredient with its own utensil, align and close the sandwich, and cut if requested. Use light pressure and controlled layers.',
          caution:
            'Do not move utensils between jars or return them after they touch bread.',
          verification:
            'Layers are even, the exterior is tidy, and the filling stays inside.',
        },
        {
          title: 'Inspect and reset',
          text: 'Check the finished sandwich and recipient match. Plate or wrap, store ingredients according to their labels, and clean the tools and station.',
          verification:
            'The intended recipient receives the checked sandwich and the station is ready for the next task.',
        },
      ],
      callout: {
        variant: 'warning',
        title: 'Stop at uncertainty',
        text: 'Do not guess about ingredients or serve a sandwich when you suspect allergen cross-contact.',
      },
    },
    caption:
      'Prepare the task, assemble in sequence, then verify the result and reset the station.',
    transcript: [
      'This overview groups the seven-step method into three stages. Preparation confirms the recipient and ingredients and gets the clean station ready.',
      'Assembly follows the planned sequence with separate utensils and controlled layers. Inspection checks both the finished appearance and the recipient match. The task ends only after ingredients are stored and tools and surfaces are reset.',
    ],
    details: {
      explanation: [
        'The procedure chapter expands this overview into seven steps: gather and inspect, lay out the bread, spread the peanut butter, spread the fruit spread, close, cut if requested, and plate or wrap and reset.',
      ],
      terms: [
        {
          term: 'Reset',
          definition:
            'Returning tools, ingredients, and the work area to the condition needed for the next task.',
        },
      ],
      sources: [handwashingSource, allergenSource, foodCodeSource],
    },
  },
  {
    id: 'overview-label-practice',
    chapter: 'Overview',
    eyebrow: 'Practice scenario · Ungraded',
    title: 'The jar is familiar. The label is unclear.',
    lead: 'Choose a response, then check the reasoning.',
    layout: 'template',
    template: 'practice',
    content: {
      situation:
        'You are preparing a sandwich for someone with a stated ingredient restriction. The label on a familiar spread jar is partly unreadable, and you cannot confirm the ingredient list. You have not started spreading.',
      prompt: 'What should you do before beginning?',
      options: [
        {
          id: 'guess',
          text: 'Use the familiar jar because it was suitable last time.',
          outcome:
            'A familiar product still needs a fresh label check. Recipes and suppliers can change, so pause until you can confirm the actual product and recipient match.',
          correct: false,
        },
        {
          id: 'taste',
          text: 'Taste a small amount to identify the ingredients.',
          outcome:
            'Tasting cannot confirm ingredients or allergens. Set the uncertain product aside according to procedure and use a clearly labeled product whose suitability you can confirm.',
          correct: false,
        },
        {
          id: 'pause',
          text: 'Pause, set the jar aside according to procedure, and confirm a clearly labeled product matches the recipient.',
          outcome:
            'Correct. Resolve the label and recipient match before preparation. The pause prevents an uncertain product from entering the sandwich or contacting other ingredients.',
          correct: true,
        },
      ],
    },
    caption:
      'Choose a response and submit it to see feedback. You can retry this ungraded practice.',
    transcript: [
      'Imagine that a familiar spread has a partly unreadable label. You need to match the ingredients to the recipient’s stated restriction, and assembly has not started.',
      'Select what you would do before beginning, then submit your answer to reveal the reasoning. This is ungraded practice; you can retry and revisit your response during the current presentation session.',
    ],
    details: {
      explanation: [
        'The decision happens before an uncertain ingredient touches bread, utensils, or other foods. The ingredients chapter explains label checks and the pause used to resolve uncertainty.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'finished-standard',
    chapter: 'Overview',
    eyebrow: 'Summary and references',
    title: 'What good looks like',
    lead: 'Even layers. A clean exterior. Careful handling.',
    layout: 'template',
    template: 'summary',
    content: {
      standard: [
        {
          title: 'Consistent inside',
          text: 'Spreads reach the crust with balanced layers and no overloaded areas.',
        },
        {
          title: 'Tidy outside',
          text: 'The exterior stays dry; any cut leaves even halves and filling inside.',
        },
        {
          title: 'Handled with care',
          text: 'Ingredients match the recipient, with clean hands and separate tools.',
        },
      ],
      takeaways: [
        'Resolve uncertainty before beginning.',
        'Keep each jar with its own clean utensil.',
        'Inspect the recipient match as well as the appearance.',
        'Finish by storing ingredients and resetting the station.',
      ],
      references: sources,
      jobAid,
    },
    takeaway: 'Check. Prepare. Assemble. Inspect. Reset.',
    caption:
      'Inspect coverage, balance, the exterior, the cut, and how the food was handled.',
    transcript: [
      'The finished standard has five parts: edge-to-edge coverage, balanced spread amounts, a dry exterior, a clean cut if requested, and careful handling. Appearance is only part of the check; the ingredients and preparation must also match the recipient.',
      'Keep the key habits in mind as you enter the remaining chapters. The course references and printable job aid are available here for review.',
    ],
    details: {
      explanation: [
        'These references are the same sources listed in the existing PBJ course. The job aid summarizes the seven steps, quality criteria, and cross-contact rules for review at the station.',
      ],
      sources,
    },
  },
];

export const pbjSlides: PBJSlide[] = [
  ...overviewSlides,
  {
    id: 'ingredient-families',
    chapter: 'Ingredients',
    eyebrow: 'Start with the ingredients',
    title: 'Three ingredients, many choices',
    lead: 'Every variation changes the texture or the label check.',
    layout: 'template',
    template: 'visual-exploration',
    content: {
      activityId: 'ingredient-map',
      visual: {
        art: 'learn-ingredients',
        description:
          'Bread supports the sandwich. Peanut butter forms the thicker layer; fruit spread adds a thinner, moist layer. All three require a label and recipient check.',
      },
      targets: [
        {
          id: 'bread',
          label: 'Bread',
          text: 'Bread gives the sandwich its structure. Choose matching slices and handle soft bread with light pressure.',
          check: 'Check the actual label against the recipient’s requirements.',
          x: 23,
          y: 90,
        },
        {
          id: 'peanut',
          label: 'Peanut butter',
          text: 'Smooth and crunchy textures need different spreading pressure. Peanut butter makes the thicker layer.',
          check:
            'Peanuts are a major allergen. Confirm suitability before preparation.',
          x: 54,
          y: 90,
        },
        {
          id: 'fruit',
          label: 'Fruit spread',
          text: 'Jelly, jam, and preserves add sweetness and moisture. Keep this layer thin and even.',
          check:
            'Read the label and storage instructions, including those for an alternative spread.',
          x: 81,
          y: 90,
        },
      ],
    },
    caption:
      'Choose bread, peanut butter, and fruit spread with the recipient in mind.',
    transcript: [
      'A PBJ sandwich begins with bread, peanut butter, and fruit spread. Their texture affects the method, and their ingredients affect suitability for the recipient.',
      'Keep the labels available while preparing the sandwich. Familiar packaging is not a substitute for checking the actual product.',
      'Bread: Bread gives the sandwich its structure. Choose matching slices and handle soft bread with light pressure. Check the actual label against the recipient’s requirements.',
      'Peanut butter: Smooth and crunchy textures need different spreading pressure. Peanut butter makes the thicker layer. Peanuts are a major allergen. Confirm suitability before preparation.',
      'Fruit spread: Jelly, jam, and preserves add sweetness and moisture. Keep this layer thin and even. Read the label and storage instructions, including those for an alternative spread.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'choose-bread',
    chapter: 'Ingredients',
    eyebrow: 'Ingredient 01 · Bread',
    title: 'Choose a matching pair',
    lead: 'Two similar slices make a more consistent sandwich.',
    layout: 'template',
    template: 'comparison-activity',
    content: {
      activityId: 'bread-comparison',
      items: [
        {
          id: 'matching',
          label: 'Matching pair',
          text: 'These sample slices come from the same loaf and align at the crust. Their label has been checked against the recipient’s needs.',
          check: 'Use light pressure to keep soft slices intact.',
          visual: {
            art: 'learn-bread-match',
            description:
              'Two similar bread slices are aligned along one baseline. This is an illustrative pair with a completed label check.',
          },
        },
        {
          id: 'uneven',
          label: 'Uneven pair',
          text: 'These sample slices differ in size and shape. The product information for the smaller slice is unclear.',
          check:
            'Choose a matching pair with readable ingredient information before spreading.',
          visual: {
            art: 'learn-bread-uneven',
            description:
              'A full slice and a smaller slice do not align. The smaller slice has unclear product information. This is a training example.',
          },
        },
      ],
      decision: {
        situation:
          'You have inspected two illustrative pairs. One has matching slices and a checked label; the other has uneven slices and unclear product information.',
        prompt: 'Which preparation choice fits the method?',
        options: [
          {
            id: 'matching',
            text: 'Use the matching pair after confirming its label meets the recipient’s needs.',
            correct: true,
            outcome:
              'Matching slices support a consistent sandwich. The label and recipient check must also be complete. Use light spreading pressure.',
          },
          {
            id: 'shape-only',
            text: 'Use whichever pair looks best; shape is enough.',
            correct: false,
            outcome:
              'Appearance does not establish suitability. Check the actual ingredients and recipient requirements as well as the slice shape.',
          },
          {
            id: 'unknown',
            text: 'Use the uneven pair and press it flat.',
            correct: false,
            outcome:
              'Pressing changes the texture and does not resolve missing product information. Choose matching, suitable slices before assembly.',
          },
        ],
      },
    },
    caption:
      'Match the slices and check the bread label before opening the spreads.',
    transcript: [
      'Choose two matching slices and check the bread label. Wheat is common in sandwich bread, and some products also contain milk, eggs, soy, or sesame.',
      'The bread should suit the recipient. During assembly, use light pressure so the slices retain their shape.',
      'Matching pair: These sample slices come from the same loaf and align at the crust. Their label has been checked against the recipient’s needs. Use light pressure to keep soft slices intact.',
      'Uneven pair: These sample slices differ in size and shape. The product information for the smaller slice is unclear. Choose a matching pair with readable ingredient information before spreading.',
      'You have inspected two illustrative pairs. One has matching slices and a checked label; the other has uneven slices and unclear product information. Which preparation choice fits the method?',
      'Use the matching pair after confirming its label meets the recipient’s needs. Matching slices support a consistent sandwich. The label and recipient check must also be complete. Use light spreading pressure.',
      'Use whichever pair looks best; shape is enough. Appearance does not establish suitability. Check the actual ingredients and recipient requirements as well as the slice shape.',
      'Use the uneven pair and press it flat. Pressing changes the texture and does not resolve missing product information. Choose matching, suitable slices before assembly.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'choose-spreads',
    chapter: 'Ingredients',
    eyebrow: 'Ingredients 02–03 · Spreads',
    title: 'Let texture guide your technique',
    lead: 'Use controlled layers, whatever the spread.',
    layout: 'template',
    template: 'comparison-activity',
    content: {
      activityId: 'texture-comparison',
      items: [
        {
          id: 'smooth',
          label: 'Smooth',
          text: 'A uniform texture spreads easily on soft bread. Keep the peanut butter layer controlled.',
          check:
            'If natural peanut butter has separated, stir it until uniform before use.',
          visual: {
            art: 'learn-spread-smooth',
            description:
              'An even peanut butter layer covers a bread slice, leaving a small edge.',
          },
        },
        {
          id: 'crunchy',
          label: 'Crunchy',
          text: 'Peanut pieces add texture. Use light pressure so pieces do not tear soft bread.',
          check: 'Spread gently and keep the layer even.',
          visual: {
            art: 'learn-spread-crunchy',
            description:
              'Small peanut pieces are distributed through the peanut butter layer.',
          },
        },
        {
          id: 'jelly',
          label: 'Jelly',
          text: 'Jelly uses strained fruit juice and has a smooth texture.',
          check: 'Keep the fruit layer thin and even.',
          visual: {
            art: 'learn-spread-jelly',
            description: 'A smooth fruit spread layer covers the bread.',
          },
        },
        {
          id: 'jam',
          label: 'Jam',
          text: 'Jam contains crushed fruit. Distribute it gently over the bread.',
          check: 'Check for thicker spots before closing the sandwich.',
          visual: {
            art: 'learn-spread-jam',
            description:
              'Small fruit pieces are distributed across a thin fruit layer.',
          },
        },
        {
          id: 'preserves',
          label: 'Preserves',
          text: 'Preserves contain larger fruit pieces. Move them gently to distribute the layer.',
          check: 'Follow the label for storage after opening.',
          visual: {
            art: 'learn-spread-preserves',
            description:
              'Larger fruit pieces sit within the fruit layer and need gentle spreading.',
          },
        },
      ],
    },
    caption:
      'Peanut butter provides the thicker layer; fruit spread should stay thin and even.',
    transcript: [
      'Smooth peanut butter is easier to spread on soft bread. Crunchy varieties need lighter pressure. Stir separated natural peanut butter until uniform before using it.',
      'Jelly is made with strained fruit juice, jam with crushed fruit, and preserves with larger fruit pieces. Keep the fruit layer thin and even, and follow the product label for storage.',
      'Smooth: A uniform texture spreads easily on soft bread. Keep the peanut butter layer controlled. If natural peanut butter has separated, stir it until uniform before use.',
      'Crunchy: Peanut pieces add texture. Use light pressure so pieces do not tear soft bread. Spread gently and keep the layer even.',
      'Jelly: Jelly uses strained fruit juice and has a smooth texture. Keep the fruit layer thin and even.',
      'Jam: Jam contains crushed fruit. Distribute it gently over the bread. Check for thicker spots before closing the sandwich.',
      'Preserves: Preserves contain larger fruit pieces. Move them gently to distribute the layer. Follow the label for storage after opening.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'read-labels',
    chapter: 'Ingredients',
    eyebrow: 'Before opening a jar',
    title: 'Read every label, every time',
    lead: 'Recipes and suppliers can change.',
    layout: 'template',
    template: 'visual-exploration',
    content: {
      activityId: 'label-inspection',
      visual: {
        art: 'learn-label',
        description:
          'Illustrative sample bread label, not a complete product label: ingredients include wheat flour, water, and yeast; contains wheat; date and storage fields direct you to check the actual package.',
      },
      targets: [
        {
          id: 'ingredients',
          label: 'Ingredients',
          text: 'The sample lists wheat flour, water, and yeast. This abbreviated training label demonstrates where ingredient information appears.',
          check:
            'Read the full actual product label. Do not infer suitability from this example.',
          x: 27,
          y: 37,
        },
        {
          id: 'allergens',
          label: 'Allergen information',
          text: 'The sample says “Contains: wheat.” Bread products may also contain milk, eggs, soy, or sesame.',
          check:
            'Compare all ingredient and allergen information with the recipient’s needs.',
          x: 69,
          y: 54,
        },
        {
          id: 'date',
          label: 'Date',
          text: 'Find and check the date on the actual product. This illustration does not provide a usable product date.',
          check: 'Pause if required product information is missing or unclear.',
          x: 27,
          y: 69,
        },
        {
          id: 'storage',
          label: 'Storage',
          text: 'Read the actual instructions for use and storage. A product may need refrigeration after opening.',
          check: 'Repeat these checks for a new supplier or substitute.',
          x: 69,
          y: 83,
        },
      ],
    },
    caption:
      'Use the actual label to confirm ingredients, dates, and storage instructions.',
    transcript: [
      'Read the ingredient and allergen information on every product. Check the date and any instructions for use or storage, including refrigeration after opening when required.',
      'Repeat the check when a supplier changes or an alternative is used. A substitute is not automatically suitable for a person with an allergy.',
      'Ingredients: The sample lists wheat flour, water, and yeast. This abbreviated training label demonstrates where ingredient information appears. Read the full actual product label. Do not infer suitability from this example.',
      'Allergen information: The sample says “Contains: wheat.” Bread products may also contain milk, eggs, soy, or sesame. Compare all ingredient and allergen information with the recipient’s needs.',
      'Date: Find and check the date on the actual product. This illustration does not provide a usable product date. Pause if required product information is missing or unclear.',
      'Storage: Read the actual instructions for use and storage. A product may need refrigeration after opening. Repeat these checks for a new supplier or substitute.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'resolve-uncertainty',
    chapter: 'Ingredients',
    eyebrow: 'A deliberate pause',
    title: 'Uncertain? Resolve it first.',
    lead: 'A readable label and a clear recipient match come first.',
    layout: 'template',
    template: 'guided-decision',
    content: {
      activityId: 'unclear-label',
      visual: {
        art: 'learn-uncertain',
        description:
          'A spread jar has an unreadable label. Pause before it contacts any food or utensil.',
      },
      decision: {
        situation:
          'You recognize a familiar fruit spread jar, but its ingredient label cannot be read. Preparation has not started.',
        prompt: 'What do you do next?',
        options: [
          {
            id: 'pause',
            text: 'Set the jar aside according to procedure and choose a clearly labeled, suitable product.',
            correct: true,
            outcome:
              'Resolve uncertainty before preparation. Check the replacement label and confirm the recipient match before use.',
          },
          {
            id: 'taste',
            text: 'Taste a little to identify what is in the jar.',
            correct: false,
            outcome:
              'Tasting cannot establish ingredients or allergens. Set the jar aside according to procedure and use clear product information.',
          },
          {
            id: 'familiar',
            text: 'Use it because the packaging looks familiar.',
            correct: false,
            outcome:
              'Recipes and suppliers can change. Familiar packaging does not replace reading the actual label.',
          },
        ],
      },
    },
    caption:
      'Stop when an ingredient, label, or recipient requirement is unclear.',
    transcript: [
      'If a label cannot be read, set the product aside according to the applicable procedure and choose a product with clear information. Tasting cannot confirm its ingredients or allergens.',
      'Resolve an uncertain recipient requirement before preparing or serving the sandwich. This pause is part of the method.',
      'You recognize a familiar fruit spread jar, but its ingredient label cannot be read. Preparation has not started. What do you do next?',
      'Set the jar aside according to procedure and choose a clearly labeled, suitable product. Resolve uncertainty before preparation. Check the replacement label and confirm the recipient match before use.',
      'Taste a little to identify what is in the jar. Tasting cannot establish ingredients or allergens. Set the jar aside according to procedure and use clear product information.',
      'Use it because the packaging looks familiar. Recipes and suppliers can change. Familiar packaging does not replace reading the actual label.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'know-the-recipient',
    chapter: 'Safety & hygiene',
    eyebrow: 'Care begins with the person',
    title: 'Know who will eat it',
    lead: 'Ingredient choices must match the recipient.',
    layout: 'template',
    template: 'guided-decision',
    content: {
      activityId: 'recipient-path',
      visual: {
        art: 'learn-recipient',
        description:
          'Recipient requirements guide product checks, then utensil and surface preparation. Uncertainty at any stage means pause and resolve it.',
      },
      stages: [
        {
          id: 'confirm',
          label: 'Confirm the person',
          text: 'Before choosing ingredients, confirm who will eat the sandwich and their dietary requirements.',
          check: 'If a requirement is unclear, pause and confirm it.',
        },
        {
          id: 'products',
          label: 'Check each product',
          text: 'Compare bread and both spreads with the recipient’s requirements. Peanuts are a major allergen; substitutes need their own label check.',
          check: 'Check every actual product, including bread.',
        },
        {
          id: 'setup',
          label: 'Prepare the setup',
          text: 'Consider the utensils and surfaces as well as the ingredients. Residue can travel through shared tools.',
          check:
            'Use clean, separate utensils and reset the preparation area for the task.',
        },
      ],
    },
    caption:
      'The recipient’s needs guide the ingredients and the preparation setup.',
    transcript: [
      'Peanuts are a major allergen. Bread and alternative spreads may introduce other allergens, so the whole ingredient list matters.',
      'Confirm the recipient’s requirements before starting. Then consider the tools and surfaces as well as the products themselves.',
      'Confirm the person: Before choosing ingredients, confirm who will eat the sandwich and their dietary requirements. If a requirement is unclear, pause and confirm it.',
      'Check each product: Compare bread and both spreads with the recipient’s requirements. Peanuts are a major allergen; substitutes need their own label check. Check every actual product, including bread.',
      'Prepare the setup: Consider the utensils and surfaces as well as the ingredients. Residue can travel through shared tools. Use clean, separate utensils and reset the preparation area for the task.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
    },
  },
  {
    id: 'cross-contact',
    chapter: 'Safety & hygiene',
    eyebrow: 'Understand the transfer',
    title: 'Cross-contact can travel',
    lead: 'A small transfer can connect separate foods.',
    layout: 'template',
    template: 'visual-exploration',
    content: {
      activityId: 'transfer-trace',
      visual: {
        art: 'learn-transfer',
        description:
          'Peanut butter can move to a spreader, from the spreader to another food, and then to the recipient. A returned spreader can also move bread ingredients into a jar. Hands and surfaces can provide other routes.',
      },
      targets: [
        {
          id: 'source',
          label: 'Source ingredient',
          text: 'An ingredient starts in its own jar. Moving its spreader to another jar can introduce that ingredient into a separate food.',
          check: 'Keep each clean utensil assigned to its jar.',
          x: 14,
          y: 90,
        },
        {
          id: 'contact',
          label: 'Contact point',
          text: 'A spreader carries residue. Once it touches bread or another spread, returning it to a jar can transfer those ingredients.',
          check: 'Use another clean utensil when more spread is needed.',
          x: 40,
          y: 90,
        },
        {
          id: 'food',
          label: 'Another food',
          text: 'The transferred ingredient may now be in bread or another spread. Boards, hands, and towels can also move residue.',
          check: 'Keep tools and the preparation area under control.',
          x: 66,
          y: 90,
        },
        {
          id: 'recipient',
          label: 'Recipient',
          text: 'Food can carry the transferred ingredient to the recipient. Suitability depends on the whole preparation, not just the original jar.',
          check:
            'Confirm recipient requirements and interrupt transfer routes before preparing food.',
          x: 89,
          y: 90,
        },
      ],
    },
    caption:
      'Cross-contact is the unintended transfer of an allergen between foods or surfaces.',
    transcript: [
      'Cross-contact means an allergen is unintentionally transferred from one food or surface to another. A spreader moved between jars is one example. A utensil returned to a jar after touching bread is another.',
      'Hands, boards, and towels can also move residue. Separate utensils and a clean setup reduce these opportunities for transfer.',
      'Source ingredient: An ingredient starts in its own jar. Moving its spreader to another jar can introduce that ingredient into a separate food. Keep each clean utensil assigned to its jar.',
      'Contact point: A spreader carries residue. Once it touches bread or another spread, returning it to a jar can transfer those ingredients. Use another clean utensil when more spread is needed.',
      'Another food: The transferred ingredient may now be in bread or another spread. Boards, hands, and towels can also move residue. Keep tools and the preparation area under control.',
      'Recipient: Food can carry the transferred ingredient to the recipient. Suitability depends on the whole preparation, not just the original jar. Confirm recipient requirements and interrupt transfer routes before preparing food.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [allergenSource],
      terms: [
        {
          term: 'Cross-contact',
          definition:
            'The unintended transfer of an allergen between foods or surfaces.',
        },
      ],
    },
  },
  {
    id: 'dedicated-utensils',
    chapter: 'Safety & hygiene',
    eyebrow: 'The essential habit',
    title: 'One jar. One spreader.',
    lead: 'Keep each spread and its utensil together.',
    layout: 'template',
    template: 'classification',
    content: {
      activityId: 'utensil-events',
      categories: [
        {
          id: 'safe',
          label: 'Safe',
        },
        {
          id: 'risk',
          label: 'Risk',
        },
      ],
      items: [
        {
          id: 'separate',
          label: 'Start with two',
          text: 'Two clean spreaders are set beside their own jars.',
          category: 'safe',
          explanation:
            'Separate clean utensils keep the two jars apart. Maintain that boundary throughout preparation.',
        },
        {
          id: 'shared',
          label: 'Move between jars',
          text: 'The peanut butter spreader is used to scoop fruit spread.',
          category: 'risk',
          explanation:
            'The shared spreader can move peanut butter into the fruit spread. Keep one clean utensil assigned to each jar.',
        },
        {
          id: 'return',
          label: 'Return after bread',
          text: 'A spreader touches bread, then returns to its original jar.',
          category: 'risk',
          explanation:
            'Bread ingredients can travel back into the jar. Use another clean utensil if more spread is needed.',
        },
        {
          id: 'replacement',
          label: 'Take a clean tool',
          text: 'More spread is needed after spreading on bread, so another clean utensil is used.',
          category: 'safe',
          explanation:
            'A clean replacement prevents return dipping after contact with bread or another spread.',
        },
      ],
    },
    caption: 'Dedicated utensils protect both jars throughout preparation.',
    transcript: [
      'Use a separate clean utensil for each jar. Labeled handles can make the intended use clear, and placing each spreader beside its jar helps maintain the boundary.',
      'Once a utensil has touched bread or another spread, do not return it to the jar. Use another clean utensil if more spread is needed.',
      'Start with two: Two clean spreaders are set beside their own jars. Separate clean utensils keep the two jars apart. Maintain that boundary throughout preparation.',
      'Move between jars: The peanut butter spreader is used to scoop fruit spread. The shared spreader can move peanut butter into the fruit spread. Keep one clean utensil assigned to each jar.',
      'Return after bread: A spreader touches bread, then returns to its original jar. Bread ingredients can travel back into the jar. Use another clean utensil if more spread is needed.',
      'Take a clean tool: More spread is needed after spreading on bread, so another clean utensil is used. A clean replacement prevents return dipping after contact with bread or another spread.',
    ],
    details: {
      explanation: [
        'Assign every event, then choose Check all. Review each event to read its explanation. The activity is ungraded and can be retried.',
      ],
      sources: [allergenSource],
      terms: [
        {
          term: 'Cross-contact',
          definition:
            'The unintended transfer of an allergen between foods or surfaces.',
        },
      ],
    },
  },
  {
    id: 'handwashing-start',
    chapter: 'Safety & hygiene',
    eyebrow: 'Handwashing · Steps 1–3',
    title: 'Wet. Lather. Scrub.',
    lead: 'Give every part of your hands attention.',
    layout: 'template',
    template: 'procedure-sequence',
    content: {
      activityId: 'wash-start',
      startNumber: 1,
      steps: [
        {
          id: 'wet',
          label: 'Wet',
          text: 'Wet hands with clean running water. Turn off the tap and apply soap.',
          check: 'Begin before handling food.',
          visual: {
            art: 'learn-wet',
            description: 'Running water wets the hands before soap is applied.',
          },
        },
        {
          id: 'lather',
          label: 'Lather',
          text: 'Rub hands together with soap. Include the backs of hands, between fingers, and under nails.',
          check: 'Give the whole hand attention.',
          visual: {
            art: 'learn-lather',
            description:
              'Soap lather covers the hands and fingers. Include backs, finger spaces, and under nails.',
          },
        },
        {
          id: 'scrub',
          label: 'Scrub',
          text: 'Scrub for at least 20 seconds. Give attention to thumbs and fingertips as you work over the whole hand.',
          check:
            'The 20-second illustration is a reminder, not a required on-screen timer.',
          visual: {
            art: 'learn-scrub',
            description:
              'Lathered hands are shown beside a 20-second reminder. Scrub every part of the hands for at least 20 seconds.',
          },
        },
      ],
    },
    caption:
      'Begin with clean running water and soap, then scrub for at least 20 seconds.',
    transcript: [
      'Wet your hands with clean running water. Turn off the tap and apply soap. Rub your hands together to create lather, including the backs of your hands, the spaces between your fingers, and under your nails.',
      'Scrub for at least 20 seconds. Give attention to thumbs and fingertips as you work over the whole hand.',
      'Wet: Wet hands with clean running water. Turn off the tap and apply soap. Begin before handling food.',
      'Lather: Rub hands together with soap. Include the backs of hands, between fingers, and under nails. Give the whole hand attention.',
      'Scrub: Scrub for at least 20 seconds. Give attention to thumbs and fingertips as you work over the whole hand. The 20-second illustration is a reminder, not a required on-screen timer.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [handwashingSource],
    },
  },
  {
    id: 'handwashing-finish',
    chapter: 'Safety & hygiene',
    eyebrow: 'Handwashing · Steps 4–5',
    title: 'Rinse. Dry. Begin clean.',
    lead: 'Finish the sequence before returning to food.',
    layout: 'template',
    template: 'procedure-sequence',
    content: {
      activityId: 'wash-finish',
      startNumber: 4,
      steps: [
        {
          id: 'rinse',
          label: 'Rinse',
          text: 'Rinse hands thoroughly under clean running water.',
          check: 'Finish this step before drying.',
          visual: {
            art: 'learn-rinse',
            description: 'Clean running water rinses lather from the hands.',
          },
        },
        {
          id: 'dry',
          label: 'Dry',
          text: 'Dry hands with a clean towel or an air dryer.',
          check: 'Finish the sequence before returning to food.',
          visual: {
            art: 'learn-dry',
            description:
              'A clean towel dries the rinsed hands. An air dryer is another option.',
          },
        },
        {
          id: 'pause',
          marker: 'Pause',
          label: 'If unavailable',
          text: 'Pause preparation until washing with soap and water is available.',
          check:
            'For this task, hand sanitizer does not replace washing with soap and water.',
          visual: {
            art: 'learn-pause',
            description:
              'A pause symbol indicates that food preparation waits until handwashing is available.',
          },
        },
      ],
    },
    caption:
      'Rinse and dry completely. Use soap and water before preparing food.',
    transcript: [
      'Rinse your hands thoroughly under clean running water, then dry them with a clean towel or an air dryer.',
      'For this task, hand sanitizer does not replace washing with soap and water. If handwashing is unavailable, pause food preparation until it is available.',
      'Rinse: Rinse hands thoroughly under clean running water. Finish this step before drying.',
      'Dry: Dry hands with a clean towel or an air dryer. Finish the sequence before returning to food.',
      'If unavailable: Pause preparation until washing with soap and water is available. For this task, hand sanitizer does not replace washing with soap and water.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [handwashingSource],
    },
  },
  {
    id: 'wash-again',
    chapter: 'Safety & hygiene',
    eyebrow: 'Keep the clean sequence',
    title: 'Know when to wash again',
    lead: 'Preparation includes the interruptions.',
    layout: 'template',
    template: 'guided-decision',
    content: {
      activityId: 'interruption-decision',
      visual: {
        art: 'learn-interrupt',
        description:
          'A phone interrupts food preparation. Before returning to the sandwich, decide how to restore clean hands and the preparation setup.',
      },
      decision: {
        situation:
          'During preparation you handle your phone. Your next sandwich is for a person with an allergy.',
        prompt: 'What should happen before preparation resumes?',
        options: [
          {
            id: 'reset',
            text: 'Wash hands and reset the tools and surfaces for the next recipient.',
            correct: true,
            outcome:
              'Wash after touching the phone and before preparing food for a person with an allergy. Reset tools and surfaces for that preparation too.',
          },
          {
            id: 'continue',
            text: 'Continue because the hands still look clean.',
            correct: false,
            outcome:
              'Appearance does not establish clean hands. Rewash after contact such as touching a phone, face, hair, or trash.',
          },
          {
            id: 'wipe',
            text: 'Wipe hands on a towel and keep the same tools.',
            correct: false,
            outcome:
              'A quick wipe does not replace washing. Wash with soap and water, and reset the tools and surfaces for the next preparation.',
          },
        ],
      },
    },
    caption:
      'Rewash after interruptions or contact that could transfer residue to the food.',
    transcript: [
      'Clean hands are needed throughout the task. Wash after touching garbage, a trash lid, your face, hair, or phone, and after blowing your nose, coughing, or sneezing.',
      'Wash before switching to food for a person with an allergy. Reset the surfaces and tools for that preparation too.',
      'During preparation you handle your phone. Your next sandwich is for a person with an allergy. What should happen before preparation resumes?',
      'Wash hands and reset the tools and surfaces for the next recipient. Wash after touching the phone and before preparing food for a person with an allergy. Reset tools and surfaces for that preparation too.',
      'Continue because the hands still look clean. Appearance does not establish clean hands. Rewash after contact such as touching a phone, face, hair, or trash.',
      'Wipe hands on a towel and keep the same tools. A quick wipe does not replace washing. Wash with soap and water, and reset the tools and surfaces for the next preparation.',
    ],
    details: {
      explanation: [
        'Explore the illustration or use the topic selector for the same information. Decisions are ungraded and can be retried. Check the actual products and follow the applicable preparation procedure.',
      ],
      sources: [handwashingSource],
    },
  },
  {
    id: 'station-layout',
    chapter: 'Workspace & tools',
    eyebrow: 'Build the station',
    title: 'Set up once. Work cleanly.',
    lead: 'Give each part of the task a clear place.',
    layout: 'template',
    template: 'text-brief',
    content: {
      sections: [
        {
          id: 'station-layout-1',
          title: 'Start at the center',
          text: 'A clean, stable board gives both slices room to lie flat.',
          marker: '01',
          more: [
            {
              title: 'Give the task room',
              text: 'Allow room for two bread slices and the spreading motion. Keep the cutting knife flat and away from the counter edge.',
            },
          ],
        },
        {
          id: 'station-layout-2',
          title: 'A place for each jar',
          text: 'Put each jar beside its own spreader. Keep lids ready to close.',
          marker: '02',
        },
        {
          id: 'station-layout-3',
          title: 'Ready to finish',
          text: 'Keep a clean plate or wrapper and a table knife within reach.',
          marker: '03',
        },
      ],
    },
    caption:
      'Arrange the board, ingredients, dedicated tools, and serving materials before starting.',
    transcript: [
      'Start at the center: A clean, stable board gives both slices room to lie flat.',
      'A place for each jar: Put each jar beside its own spreader. Keep lids ready to close.',
      'Ready to finish: Keep a clean plate or wrapper and a table knife within reach.',
      'Give the task room: Allow room for two bread slices and the spreading motion. Keep the cutting knife flat and away from the counter edge.',
    ],
  },
  {
    id: 'surface-readiness',
    chapter: 'Workspace & tools',
    eyebrow: 'Prepare the surface',
    title: 'Clean, sanitize, inspect',
    lead: 'Each action has a different purpose.',
    layout: 'template',
    template: 'text-ledger',
    content: {
      sections: [
        {
          id: 'surface-readiness-1',
          title: 'Clean',
          text: 'Remove food and visible residue with detergent and water.',
          marker: '01',
          more: [
            {
              title: 'Remove residue first',
              text: 'Clean the preparation surface and board before sanitizing. Reset the area between sandwiches for different people.',
            },
          ],
        },
        {
          id: 'surface-readiness-2',
          title: 'Sanitize',
          text: 'Follow the food-safe sanitizer’s label for concentration and contact time.',
          marker: '02',
          more: [
            {
              title: 'Follow the product label',
              text: 'Use a food-safe sanitizer at its labeled concentration and contact time. Allow the surface to air-dry as directed.',
            },
          ],
        },
        {
          id: 'surface-readiness-3',
          title: 'Inspect',
          text: 'Replace a board that is cracked or cannot be cleaned.',
          marker: '03',
          more: [
            {
              title: 'Check condition and stability',
              text: 'Look for cracks or deep scoring that prevents effective cleaning. Keep the board flat on a dry, stable surface.',
            },
          ],
        },
      ],
    },
    caption:
      'Prepare a clean, sanitized, stable surface before laying out the bread.',
    transcript: [
      'Clean: Remove food and visible residue with detergent and water.',
      'Sanitize: Follow the food-safe sanitizer’s label for concentration and contact time.',
      'Inspect: Replace a board that is cracked or cannot be cleaned.',
      'Remove residue first: Clean the preparation surface and board before sanitizing. Reset the area between sandwiches for different people.',
      'Follow the product label: Use a food-safe sanitizer at its labeled concentration and contact time. Allow the surface to air-dry as directed.',
      'Check condition and stability: Look for cracks or deep scoring that prevents effective cleaning. Keep the board flat on a dry, stable surface.',
    ],
    details: { sources: [foodCodeSource] },
  },
  {
    id: 'tool-handling',
    chapter: 'Workspace & tools',
    eyebrow: 'Choose and handle tools',
    title: 'Keep the blade under control',
    lead: 'Use a spreader for spreading and a table knife for the cut.',
    layout: 'template',
    template: 'text-contrast',
    content: {
      sections: [
        {
          id: 'tool-handling-1',
          title: 'During the cut',
          text: 'Keep the sandwich on a stable board. Move the blade away from your fingers.',
          marker: 'In use',
          more: [
            {
              title: 'Keep control',
              text: 'Use a spreader for spreading and a table knife for the optional cut. Never hold the sandwich in your palm while cutting.',
            },
            {
              title: 'If you cut yourself',
              text: 'Stop, step away from the food, and follow the applicable first-aid procedure. Discard food that may have been contaminated and clean the affected area before resuming.',
            },
          ],
        },
        {
          id: 'tool-handling-2',
          title: 'Between uses',
          text: 'Set the knife down flat, away from the counter edge. Keep it visible during cleanup.',
          marker: 'At rest',
          more: [
            {
              title: 'Keep the knife visible',
              text: 'Never leave a knife hidden in soapy water.',
            },
          ],
        },
      ],
    },
    takeaway: 'Never hold the sandwich in your palm while cutting.',
    caption:
      'Keep the sandwich on the board and the blade away from your fingers.',
    transcript: [
      'During the cut: Keep the sandwich on a stable board. Move the blade away from your fingers.',
      'Between uses: Set the knife down flat, away from the counter edge. Keep it visible during cleanup.',
      'Keep control: Use a spreader for spreading and a table knife for the optional cut. Never hold the sandwich in your palm while cutting.',
      'If you cut yourself: Stop, step away from the food, and follow the applicable first-aid procedure. Discard food that may have been contaminated and clean the affected area before resuming.',
      'Keep the knife visible: Never leave a knife hidden in soapy water.',
    ],
  },
  {
    id: 'tool-care',
    chapter: 'Workspace & tools',
    eyebrow: 'Look after the setup',
    title: 'Clean tools stay ready',
    lead: 'Care for the surfaces that touch the food.',
    layout: 'template',
    template: 'text-ledger',
    content: {
      sections: [
        {
          id: 'tool-care-1',
          title: 'Utensils',
          text: 'Wash, rinse, and dry after use. Replace cracked handles.',
          marker: '01',
        },
        {
          id: 'tool-care-2',
          title: 'Boards',
          text: 'Clean and sanitize. Store so both sides can dry.',
          marker: '02',
        },
        {
          id: 'tool-care-3',
          title: 'Towels & jars',
          text: 'Separate hand towels from spill cleanup. Wipe and seal jar lids.',
          marker: '03',
          more: [
            {
              title: 'Separate towel uses',
              text: 'Use clean hand towels for hands and disposable towels for food spills in this practice setup.',
            },
            {
              title: 'Close and store',
              text: 'Wipe jar threads and lids before closing. Follow the product’s storage instructions.',
            },
          ],
        },
      ],
    },
    caption: 'Inspect tools, separate towel uses, and keep jar closures clean.',
    transcript: [
      'Utensils: Wash, rinse, and dry after use. Replace cracked handles.',
      'Boards: Clean and sanitize. Store so both sides can dry.',
      'Towels & jars: Separate hand towels from spill cleanup. Wipe and seal jar lids.',
      'Separate towel uses: Use clean hand towels for hands and disposable towels for food spills in this practice setup.',
      'Close and store: Wipe jar threads and lids before closing. Follow the product’s storage instructions.',
    ],
    details: { sources: [foodCodeSource] },
  },
  {
    id: 'step-1-inspect',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 01 of 07',
    title: 'Gather and inspect',
    lead: 'Make the final check before assembly.',
    layout: 'template',
    template: 'text-brief',
    content: {
      sections: [
        {
          id: 'step-1-inspect-1',
          title: 'Resolve concerns first',
          text: 'Check every ingredient against the recipient’s needs before assembly.',
          marker: '01',
          more: [
            {
              title: 'Pause on an ingredient concern',
              text: 'Check labels and dates. If a label shows an allergen the recipient must avoid, stop and resolve the ingredient choice before beginning.',
            },
          ],
        },
        {
          id: 'step-1-inspect-2',
          title: 'Hands & station',
          text: 'Wash hands. Verify the work surface and tools are ready.',
          marker: '02',
        },
        {
          id: 'step-1-inspect-3',
          title: 'Dedicated tools',
          text: 'Keep a clean spreader beside each jar.',
          marker: '03',
        },
      ],
    },
    takeaway: 'Resolve any ingredient concern before moving on.',
    caption:
      'Step one: check hands, station, labels, dates, and dedicated utensils.',
    transcript: [
      'Resolve concerns first: Check every ingredient against the recipient’s needs before assembly.',
      'Hands & station: Wash hands. Verify the work surface and tools are ready.',
      'Dedicated tools: Keep a clean spreader beside each jar.',
      'Pause on an ingredient concern: Check labels and dates. If a label shows an allergen the recipient must avoid, stop and resolve the ingredient choice before beginning.',
    ],
  },
  {
    id: 'step-2-bread',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 02 of 07',
    title: 'Lay out the bread',
    lead: 'Start with two matching slices, side by side.',
    layout: 'template',
    template: 'text-focus',
    content: {
      sections: [
        {
          id: 'step-2-bread-1',
          title: 'Two matching slices.',
          text: 'Place them flat, side by side, with crust edges aligned.',
          marker: '02',
        },
        {
          id: 'step-2-bread-2',
          title: 'Leave working room',
          text: 'Spread without reaching across a jar or blade.',
          more: [
            {
              title: 'Set the direction',
              text: 'The left slice will receive peanut butter and the right slice fruit spread. Leave enough working room for controlled strokes.',
            },
          ],
        },
      ],
    },
    caption:
      'Step two: position matching slices on the board before applying either spread.',
    transcript: [
      'Two matching slices.: Place them flat, side by side, with crust edges aligned.',
      'Leave working room: Spread without reaching across a jar or blade.',
      'Set the direction: The left slice will receive peanut butter and the right slice fruit spread. Leave enough working room for controlled strokes.',
    ],
  },
  {
    id: 'step-3-peanut-butter',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 03 of 07',
    title: 'Spread from the center out',
    lead: 'Light pressure keeps the bread intact.',
    layout: 'template',
    template: 'text-sequence',
    content: {
      sections: [
        {
          id: 'step-3-peanut-butter-1',
          title: 'Start centrally',
          text: 'Place about two tablespoons of peanut butter in the center.',
          marker: '01',
          more: [
            {
              title: 'Adjust to the bread',
              text: 'Use the dedicated peanut butter spreader on the left slice. Adjust the amount for the bread size.',
            },
          ],
        },
        {
          id: 'step-3-peanut-butter-2',
          title: 'Work outward',
          text: 'Use gentle, overlapping strokes toward every edge.',
          marker: '02',
        },
        {
          id: 'step-3-peanut-butter-3',
          title: 'Keep it even',
          text: 'Rotate the slice to reach the corners. Keep the bread intact.',
          marker: '03',
          more: [
            {
              title: 'Use light pressure',
              text: 'Rotate the slice instead of stretching across it. Keep the layer even without tearing the bread.',
            },
          ],
        },
      ],
    },
    caption:
      'Step three: use the peanut butter spreader and work gently from the center to the crust.',
    transcript: [
      'Start centrally: Place about two tablespoons of peanut butter in the center.',
      'Work outward: Use gentle, overlapping strokes toward every edge.',
      'Keep it even: Rotate the slice to reach the corners. Keep the bread intact.',
      'Adjust to the bread: Use the dedicated peanut butter spreader on the left slice. Adjust the amount for the bread size.',
      'Use light pressure: Rotate the slice instead of stretching across it. Keep the layer even without tearing the bread.',
    ],
  },
  {
    id: 'step-4-fruit-spread',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 04 of 07',
    title: 'Add a thin fruit layer',
    lead: 'A little spread, distributed evenly.',
    layout: 'template',
    template: 'text-focus',
    content: {
      sections: [
        {
          id: 'step-4-fruit-spread-1',
          title: 'A thin, even layer.',
          text: 'Begin with about one tablespoon on the right slice.',
          marker: '04',
          more: [
            {
              title: 'Keep the filling inside',
              text: 'Spread evenly up to the crust without pushing filling past it. Closing the sandwich should not force filling out of the sides.',
            },
          ],
        },
        {
          id: 'step-4-fruit-spread-2',
          title: 'Switch utensils',
          text: 'Use the second clean spreader for the fruit spread.',
        },
      ],
    },
    caption:
      'Step four: use the second spreader to apply a thinner fruit layer to the other slice.',
    transcript: [
      'A thin, even layer.: Begin with about one tablespoon on the right slice.',
      'Switch utensils: Use the second clean spreader for the fruit spread.',
      'Keep the filling inside: Spread evenly up to the crust without pushing filling past it. Closing the sandwich should not force filling out of the sides.',
    ],
  },
  {
    id: 'step-5-close',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 05 of 07',
    title: 'Align and close gently',
    lead: 'Bring the layers together without squeezing them out.',
    layout: 'template',
    template: 'text-sequence',
    content: {
      sections: [
        {
          id: 'step-5-close-1',
          title: 'Turn',
          text: 'Lift the fruit-spread slice. Turn its filling toward the peanut butter.',
          marker: '01',
        },
        {
          id: 'step-5-close-2',
          title: 'Align',
          text: 'Bring the crust edges together evenly.',
          marker: '02',
        },
        {
          id: 'step-5-close-3',
          title: 'Press lightly',
          text: 'Use gentle pressure across the surface.',
          marker: '03',
          more: [
            {
              title: 'Check the contact',
              text: 'The layers should meet without flattening the bread or forcing filling beyond the crust.',
            },
          ],
        },
      ],
    },
    caption:
      'Step five: align the slices, filling sides together, and press lightly.',
    transcript: [
      'Turn: Lift the fruit-spread slice. Turn its filling toward the peanut butter.',
      'Align: Bring the crust edges together evenly.',
      'Press lightly: Use gentle pressure across the surface.',
      'Check the contact: The layers should meet without flattening the bread or forcing filling beyond the crust.',
    ],
  },
  {
    id: 'step-6-cut',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 06 of 07',
    title: 'Cut only if requested',
    lead: 'A clean cut keeps the layers in place.',
    layout: 'template',
    template: 'text-contrast',
    content: {
      sections: [
        {
          id: 'step-6-cut-1',
          title: 'Only if requested',
          text: 'Leave the sandwich flat on the board. Use a table knife for a straight or diagonal cut.',
          marker: 'Decide',
          more: [
            {
              title: 'Use a controlled cut',
              text: 'Use a gentle sawing motion with the blade away from your fingers. Avoid compressing the bread. Keep the blade clean between sandwiches.',
            },
          ],
        },
        {
          id: 'step-6-cut-2',
          title: 'Check the result',
          text: 'Look for even halves and filling that stays inside.',
          marker: 'Verify',
        },
      ],
    },
    caption:
      'Step six: make an optional straight or diagonal cut on the board.',
    transcript: [
      'Only if requested: Leave the sandwich flat on the board. Use a table knife for a straight or diagonal cut.',
      'Check the result: Look for even halves and filling that stays inside.',
      'Use a controlled cut: Use a gentle sawing motion with the blade away from your fingers. Avoid compressing the bread. Keep the blade clean between sandwiches.',
    ],
  },
  {
    id: 'step-7-serve-reset',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 07 of 07',
    title: 'Plate or wrap, then reset',
    lead: 'The method ends with a ready station.',
    layout: 'template',
    template: 'text-ledger',
    content: {
      sections: [
        {
          id: 'step-7-serve-reset-1',
          title: 'Inspect',
          text: 'Check coverage, exterior, cut, and recipient match.',
          marker: '01',
        },
        {
          id: 'step-7-serve-reset-2',
          title: 'Serve or pack',
          text: 'Plate for immediate service or wrap for later.',
          marker: '02',
          more: [
            {
              title: 'Choose the finish',
              text: 'For immediate service, place the halves cut-side up on a clean plate. For later service, wrap the sandwich.',
            },
          ],
        },
        {
          id: 'step-7-serve-reset-3',
          title: 'Reset',
          text: 'Seal and store jars. Clean the tools and station.',
          marker: '03',
          more: [
            {
              title: 'Leave a ready station',
              text: 'Return the lids and store ingredients according to their labels. The next chapter covers finishing decisions in more detail.',
            },
          ],
        },
      ],
    },
    caption: 'Step seven: inspect, plate or wrap, and restore the workspace.',
    transcript: [
      'Inspect: Check coverage, exterior, cut, and recipient match.',
      'Serve or pack: Plate for immediate service or wrap for later.',
      'Reset: Seal and store jars. Clean the tools and station.',
      'Choose the finish: For immediate service, place the halves cut-side up on a clean plate. For later service, wrap the sandwich.',
      'Leave a ready station: Return the lids and store ingredients according to their labels. The next chapter covers finishing decisions in more detail.',
    ],
    details: { sources: [foodCodeSource] },
  },
  {
    id: 'barrier-method',
    chapter: 'Procedure',
    eyebrow: 'Technique for later service',
    title: 'Protect the bread from moisture',
    lead: 'Use the barrier method for a packed sandwich.',
    layout: 'template',
    template: 'text-contrast',
    content: {
      sections: [
        {
          id: 'barrier-method-1',
          title: 'The standard method',
          text: 'Peanut butter on one slice. Fruit spread on the other.',
          marker: 'Serve now',
        },
        {
          id: 'barrier-method-2',
          title: 'The barrier method',
          text: 'Thin peanut butter layers on both slices, with fruit spread in the middle.',
          marker: 'Pack for later',
          more: [
            {
              title: 'Why the layers matter',
              text: 'The peanut butter barrier slows moisture moving from the fruit spread into the bread.',
            },
            {
              title: 'Keep the same controls',
              text: 'Keep layers controlled and each jar’s utensil separate. Follow product labels and applicable storage instructions when holding the sandwich.',
            },
          ],
        },
      ],
    },
    takeaway: 'The barrier slows moisture moving into the bread.',
    caption:
      'For later service, a thin peanut butter layer on each slice surrounds the fruit spread.',
    transcript: [
      'The standard method: Peanut butter on one slice. Fruit spread on the other.',
      'The barrier method: Thin peanut butter layers on both slices, with fruit spread in the middle.',
      'Why the layers matter: The peanut butter barrier slows moisture moving from the fruit spread into the bread.',
      'Keep the same controls: Keep layers controlled and each jar’s utensil separate. Follow product labels and applicable storage instructions when holding the sandwich.',
    ],
  },
  ...pbjQualitySlides,
  {
    id: 'method-recap',
    chapter: 'Quality & cleanup',
    eyebrow: 'Carry the method with you',
    title: 'Simple. Consistent. Considered.',
    lead: 'Good preparation shows in the whole task.',
    layout: 'closing',
    art: 'sandwich',
    points: [
      {
        title: 'Before',
        body: 'Know the recipient, read the labels, and prepare clean hands and tools.',
      },
      {
        title: 'During',
        body: 'Keep utensils separate and follow the seven steps with care.',
      },
      {
        title: 'After',
        body: 'Inspect, serve or pack, and restore the station.',
      },
    ],
    takeaway: 'Check. Prepare. Assemble. Inspect. Reset.',
    caption:
      'Use the same thoughtful sequence from ingredient check to station reset.',
    transcript: [
      'A reliable sandwich comes from a complete sequence: check the recipient and labels, prepare clean hands and a clean station, keep utensils separate, and assemble with controlled layers.',
      'Inspect the result, choose the serving method, and reset the station. You can revisit any chapter in this presentation whenever you want to review a step.',
    ],
  },
];

/** PBJ supplies its own metadata and content to the reusable presentation shell. */
export const pbjPresentation: PresentationCourse = {
  id: 'pbj-101-preview',
  code: 'PBJ-101',
  title: 'Peanut Butter and Jelly Sandwich Preparation',
  sidebarTitle: 'One simple task. Done well.',
  tagline: 'One simple task. Done well.',
  brand: { label: 'HSE Informer', href: '/' },
  returnLink: { label: 'Return to admin', href: '/' },
  statusLabel: 'Design preview',
  jobAid,
  slides: pbjSlides,
};
