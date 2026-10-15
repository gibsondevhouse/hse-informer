export type PBJSlide = {
  id: string;
  chapter: string;
  eyebrow: string;
  title: string;
  lead: string;
  layout:
    | 'cover'
    | 'overview'
    | 'principles'
    | 'split'
    | 'steps'
    | 'comparison'
    | 'closing';
  art:
    | 'sandwich'
    | 'ingredients'
    | 'handwash'
    | 'workstation'
    | 'spread'
    | 'cut'
    | 'storage';
  points?: { title: string; body: string }[];
  takeaway?: string;
  caption: string;
  transcript: string[];
};

/**
 * Presentation-only adaptation of pbjCourse in ./pbj-course.ts (1.0.0-preview).
 * Source provenance remains that course's CDC About Handwashing, FDA Food
 * Allergies, and FDA Food Code references. No new regulatory claims or approval
 * are implied. This PBJ scratch pad has no assessment or completion contract.
 */
export const pbjSlides: PBJSlide[] = [
  {
    id: 'welcome',
    chapter: 'Overview',
    eyebrow: 'PBJ-101 · Course presentation',
    title: 'Peanut Butter and Jelly Sandwich Preparation',
    lead: 'One simple task. A method worth getting right.',
    layout: 'cover',
    art: 'sandwich',
    takeaway: 'Check. Prepare. Assemble. Inspect. Reset.',
    caption:
      'Follow a clear method, from the first ingredient check to the final cleanup.',
    transcript: [
      'Welcome to Peanut Butter and Jelly Sandwich Preparation. This presentation walks through one familiar task with care: choosing ingredients, preparing the station, assembling the sandwich, and leaving the workspace ready for its next use.',
      'Move through the slides at your own pace. This is the PBJ course design scratch pad, with no assessment or formal training record.',
    ],
  },
  {
    id: 'course-outcome',
    chapter: 'Overview',
    eyebrow: 'The outcome',
    title: 'A simple task, done with care',
    lead: 'A good result starts before the first spread.',
    layout: 'overview',
    art: 'workstation',
    points: [
      {
        title: 'Prepare thoughtfully',
        body: 'Check the recipient, ingredients, hands, tools, and work surface.',
      },
      {
        title: 'Build consistently',
        body: 'Follow the same seven steps with light pressure and separate utensils.',
      },
      {
        title: 'Finish completely',
        body: 'Inspect the sandwich, serve or pack it, then reset the station.',
      },
    ],
    caption:
      'Preparation, a repeatable method, and a final check all contribute to the result.',
    transcript: [
      'The goal is a consistent sandwich and careful handling from beginning to end. First, confirm who will eat it and check the ingredients. Then prepare clean hands, tools, and a stable work surface.',
      'Use a repeatable assembly method. Before serving, inspect the result and confirm that it matches the recipient. Finish by storing ingredients and cleaning the station.',
    ],
  },
  {
    id: 'learning-path',
    chapter: 'Overview',
    eyebrow: 'Your learning path',
    title: 'Six chapters. One complete method.',
    lead: 'See the whole task, then work through each part.',
    layout: 'steps',
    art: 'ingredients',
    points: [
      {
        title: '01–02 · Understand & choose',
        body: 'Meet the finished standard and inspect the three ingredient families.',
      },
      {
        title: '03–04 · Protect & prepare',
        body: 'Control cross-contact, wash hands, and arrange a clean station.',
      },
      {
        title: '05–06 · Assemble & finish',
        body: 'Use the seven-step method, inspect the result, and clean up.',
      },
    ],
    caption:
      'Overview, ingredients, safety and hygiene, workspace and tools, procedure, and quality.',
    transcript: [
      'The presentation has six chapters. Overview introduces the result. Ingredients covers bread, peanut butter, fruit spread, and the label check. Safety and hygiene covers cross-contact and handwashing.',
      'Workspace and tools prepares the station. Procedure follows the seven-step method. Quality and cleanup closes the task with inspection, serving, storage, and reset.',
    ],
  },
  {
    id: 'finished-standard',
    chapter: 'Overview',
    eyebrow: 'Know the standard',
    title: 'What good looks like',
    lead: 'Even layers. A clean exterior. Careful handling.',
    layout: 'principles',
    art: 'sandwich',
    points: [
      {
        title: 'Consistent inside',
        body: 'Spreads reach the crust with balanced layers and no overloaded areas.',
      },
      {
        title: 'Tidy outside',
        body: 'The exterior stays dry; any cut leaves even halves and filling inside.',
      },
      {
        title: 'Handled with care',
        body: 'Ingredients match the recipient, with clean hands and separate tools.',
      },
    ],
    caption:
      'Inspect coverage, balance, the exterior, the cut, and how the food was handled.',
    transcript: [
      'The finished standard has five parts: edge-to-edge coverage, balanced spread amounts, a dry exterior, a clean cut if requested, and careful handling.',
      'Appearance is only part of the check. The ingredients and preparation must also match the needs of the person who will eat the sandwich.',
    ],
  },
  {
    id: 'ingredient-families',
    chapter: 'Ingredients',
    eyebrow: 'Start with the ingredients',
    title: 'Three ingredients, many choices',
    lead: 'Every variation changes the texture or the label check.',
    layout: 'overview',
    art: 'ingredients',
    points: [
      {
        title: 'Bread',
        body: 'The structure that holds the sandwich together.',
      },
      {
        title: 'Peanut butter',
        body: 'The thicker layer; smooth and crunchy behave differently.',
      },
      {
        title: 'Fruit spread',
        body: 'The thinner layer, adding sweetness and moisture.',
      },
    ],
    caption:
      'Choose bread, peanut butter, and fruit spread with the recipient in mind.',
    transcript: [
      'A PBJ sandwich begins with bread, peanut butter, and fruit spread. Their texture affects the method, and their ingredients affect suitability for the recipient.',
      'Keep the labels available while preparing the sandwich. Familiar packaging is not a substitute for checking the actual product.',
    ],
  },
  {
    id: 'choose-bread',
    chapter: 'Ingredients',
    eyebrow: 'Ingredient 01 · Bread',
    title: 'Choose a matching pair',
    lead: 'Two similar slices make a more consistent sandwich.',
    layout: 'split',
    art: 'ingredients',
    points: [
      {
        title: 'Match the shape',
        body: 'Use two slices from the same loaf and align their crust edges.',
      },
      {
        title: 'Read the ingredients',
        body: 'Bread may contain wheat, milk, eggs, soy, or sesame.',
      },
      {
        title: 'Consider the texture',
        body: 'Soft bread needs especially light spreading pressure.',
      },
    ],
    caption:
      'Match the slices and check the bread label before opening the spreads.',
    transcript: [
      'Choose two matching slices and check the bread label. Wheat is common in sandwich bread, and some products also contain milk, eggs, soy, or sesame.',
      'The bread should suit the recipient. During assembly, use light pressure so the slices retain their shape.',
    ],
  },
  {
    id: 'choose-spreads',
    chapter: 'Ingredients',
    eyebrow: 'Ingredients 02–03 · Spreads',
    title: 'Let texture guide your technique',
    lead: 'Use controlled layers, whatever the spread.',
    layout: 'comparison',
    art: 'spread',
    points: [
      {
        title: 'Peanut butter',
        body: 'Smooth spreads easily. Crunchy needs care on soft bread.',
      },
      {
        title: 'Jelly or jam',
        body: 'Jelly uses strained juice; jam contains crushed fruit.',
      },
      {
        title: 'Preserves',
        body: 'Larger fruit pieces need gentle spreading to keep the layer even.',
      },
    ],
    caption:
      'Peanut butter provides the thicker layer; fruit spread should stay thin and even.',
    transcript: [
      'Smooth peanut butter is easier to spread on soft bread. Crunchy varieties need lighter pressure. Stir separated natural peanut butter until uniform before using it.',
      'Jelly is made with strained fruit juice, jam with crushed fruit, and preserves with larger fruit pieces. Keep the fruit layer thin and even, and follow the product label for storage.',
    ],
  },
  {
    id: 'read-labels',
    chapter: 'Ingredients',
    eyebrow: 'Before opening a jar',
    title: 'Read every label, every time',
    lead: 'Recipes and suppliers can change.',
    layout: 'principles',
    art: 'storage',
    points: [
      {
        title: 'Recipient needs',
        body: 'Compare the ingredient and allergen information with the recipient’s needs.',
      },
      {
        title: 'Product details',
        body: 'Check the date, readable label, and instructions for use and storage.',
      },
      {
        title: 'Substitutions',
        body: 'Give an alternative bread or spread the same full check.',
      },
    ],
    takeaway: 'A familiar product still needs a fresh check.',
    caption:
      'Use the actual label to confirm ingredients, dates, and storage instructions.',
    transcript: [
      'Read the ingredient and allergen information on every product. Check the date and any instructions for use or storage, including refrigeration after opening when required.',
      'Repeat the check when a supplier changes or an alternative is used. A substitute is not automatically suitable for a person with an allergy.',
    ],
  },
  {
    id: 'resolve-uncertainty',
    chapter: 'Ingredients',
    eyebrow: 'A deliberate pause',
    title: 'Uncertain? Resolve it first.',
    lead: 'A readable label and a clear recipient match come first.',
    layout: 'split',
    art: 'ingredients',
    points: [
      {
        title: 'Unreadable label',
        body: 'Set the product aside according to procedure; use a clearly labeled product.',
      },
      {
        title: 'Unknown ingredient',
        body: 'Confirm its suitability before beginning preparation.',
      },
      {
        title: 'Wrong product',
        body: 'Replace it before it touches the bread or other ingredients.',
      },
    ],
    takeaway: 'Do not guess or taste a product to identify allergens.',
    caption:
      'Stop when an ingredient, label, or recipient requirement is unclear.',
    transcript: [
      'If a label cannot be read, set the product aside according to the applicable procedure and choose a product with clear information. Tasting cannot confirm its ingredients or allergens.',
      'Resolve an uncertain recipient requirement before preparing or serving the sandwich. This pause is part of the method.',
    ],
  },
  {
    id: 'know-the-recipient',
    chapter: 'Safety & hygiene',
    eyebrow: 'Care begins with the person',
    title: 'Know who will eat it',
    lead: 'Ingredient choices must match the recipient.',
    layout: 'split',
    art: 'sandwich',
    points: [
      {
        title: 'Confirm requirements',
        body: 'Know the recipient’s dietary needs before choosing ingredients.',
      },
      {
        title: 'Check peanuts',
        body: 'Peanuts are a major allergen; substitutions need their own label check.',
      },
      {
        title: 'Check the whole sandwich',
        body: 'Bread, spreads, utensils, and surfaces all matter.',
      },
    ],
    caption:
      'The recipient’s needs guide the ingredients and the preparation setup.',
    transcript: [
      'Peanuts are a major allergen. Bread and alternative spreads may introduce other allergens, so the whole ingredient list matters.',
      'Confirm the recipient’s requirements before starting. Then consider the tools and surfaces as well as the products themselves.',
    ],
  },
  {
    id: 'cross-contact',
    chapter: 'Safety & hygiene',
    eyebrow: 'Understand the transfer',
    title: 'Cross-contact can travel',
    lead: 'A small transfer can connect separate foods.',
    layout: 'principles',
    art: 'workstation',
    points: [
      {
        title: 'Utensil to jar',
        body: 'A shared spreader can carry peanut butter into the fruit spread.',
      },
      {
        title: 'Bread to jar',
        body: 'A returned spreader can introduce ingredients from the bread.',
      },
      {
        title: 'Surface to food',
        body: 'Boards, hands, and towels can transfer residue between tasks.',
      },
    ],
    takeaway:
      'Keep ingredients, tools, and the preparation area under control.',
    caption:
      'Cross-contact is the unintended transfer of an allergen between foods or surfaces.',
    transcript: [
      'Cross-contact means an allergen is unintentionally transferred from one food or surface to another. A spreader moved between jars is one example. A utensil returned to a jar after touching bread is another.',
      'Hands, boards, and towels can also move residue. Separate utensils and a clean setup reduce these opportunities for transfer.',
    ],
  },
  {
    id: 'dedicated-utensils',
    chapter: 'Safety & hygiene',
    eyebrow: 'The essential habit',
    title: 'One jar. One spreader.',
    lead: 'Keep each spread and its utensil together.',
    layout: 'comparison',
    art: 'ingredients',
    points: [
      {
        title: 'Separate from the start',
        body: 'Set out a clean, dedicated spreader for each jar.',
      },
      {
        title: 'Keep the boundary',
        body: 'Never move the peanut butter spreader into the fruit spread jar.',
      },
      {
        title: 'No return dipping',
        body: 'Use a clean utensil if the first has touched bread or another spread.',
      },
    ],
    caption: 'Dedicated utensils protect both jars throughout preparation.',
    transcript: [
      'Use a separate clean utensil for each jar. Labeled handles can make the intended use clear, and placing each spreader beside its jar helps maintain the boundary.',
      'Once a utensil has touched bread or another spread, do not return it to the jar. Use another clean utensil if more spread is needed.',
    ],
  },
  {
    id: 'handwashing-start',
    chapter: 'Safety & hygiene',
    eyebrow: 'Handwashing · Steps 1–3',
    title: 'Wet. Lather. Scrub.',
    lead: 'Give every part of your hands attention.',
    layout: 'steps',
    art: 'handwash',
    points: [
      {
        title: '01 · Wet',
        body: 'Use clean running water, turn off the tap, and apply soap.',
      },
      {
        title: '02 · Lather',
        body: 'Cover the backs of hands, between fingers, and under nails.',
      },
      {
        title: '03 · Scrub',
        body: 'Scrub your hands for at least 20 seconds.',
      },
    ],
    takeaway: 'At least 20 seconds of scrubbing.',
    caption:
      'Begin with clean running water and soap, then scrub for at least 20 seconds.',
    transcript: [
      'Wet your hands with clean running water. Turn off the tap and apply soap. Rub your hands together to create lather, including the backs of your hands, the spaces between your fingers, and under your nails.',
      'Scrub for at least 20 seconds. Give attention to thumbs and fingertips as you work over the whole hand.',
    ],
  },
  {
    id: 'handwashing-finish',
    chapter: 'Safety & hygiene',
    eyebrow: 'Handwashing · Steps 4–5',
    title: 'Rinse. Dry. Begin clean.',
    lead: 'Finish the sequence before returning to food.',
    layout: 'steps',
    art: 'handwash',
    points: [
      {
        title: '04 · Rinse',
        body: 'Rinse thoroughly under clean running water.',
      },
      { title: '05 · Dry', body: 'Use a clean towel or an air dryer.' },
      {
        title: 'If washing is unavailable',
        body: 'Pause preparation until you can wash with soap and water.',
      },
    ],
    caption:
      'Rinse and dry completely. Use soap and water before preparing food.',
    transcript: [
      'Rinse your hands thoroughly under clean running water, then dry them with a clean towel or an air dryer.',
      'For this task, hand sanitizer does not replace washing with soap and water. If handwashing is unavailable, pause food preparation until it is available.',
    ],
  },
  {
    id: 'wash-again',
    chapter: 'Safety & hygiene',
    eyebrow: 'Keep the clean sequence',
    title: 'Know when to wash again',
    lead: 'Preparation includes the interruptions.',
    layout: 'principles',
    art: 'handwash',
    points: [
      {
        title: 'During the task',
        body: 'Wash before, during, and after preparing food as needed.',
      },
      {
        title: 'After contact',
        body: 'Wash after touching trash, your face, hair, or phone.',
      },
      {
        title: 'Before switching',
        body: 'Wash before preparing food for a person with an allergy.',
      },
    ],
    caption:
      'Rewash after interruptions or contact that could transfer residue to the food.',
    transcript: [
      'Clean hands are needed throughout the task. Wash after touching garbage, a trash lid, your face, hair, or phone, and after blowing your nose, coughing, or sneezing.',
      'Wash before switching to food for a person with an allergy. Reset the surfaces and tools for that preparation too.',
    ],
  },
  {
    id: 'station-layout',
    chapter: 'Workspace & tools',
    eyebrow: 'Build the station',
    title: 'Set up once. Work cleanly.',
    lead: 'Give each part of the task a clear place.',
    layout: 'overview',
    art: 'workstation',
    points: [
      {
        title: 'Center',
        body: 'A clean, stable board with room for both slices.',
      },
      {
        title: 'Left & right',
        body: 'Each jar beside its own spreader, with lids ready to close.',
      },
      {
        title: 'Ready to finish',
        body: 'A clean plate or wrapper and a table knife within reach.',
      },
    ],
    caption:
      'Arrange the board, ingredients, dedicated tools, and serving materials before starting.',
    transcript: [
      'Place a clean, stable cutting board at the center of the workspace. It should have room for two bread slices and the spreading motion.',
      'Arrange the peanut butter and fruit spread on opposite sides with their dedicated utensils. Have a clean plate or wrapper ready, and keep the cutting knife flat and away from the counter edge.',
    ],
  },
  {
    id: 'surface-readiness',
    chapter: 'Workspace & tools',
    eyebrow: 'Prepare the surface',
    title: 'Clean, sanitize, inspect',
    lead: 'Each action has a different purpose.',
    layout: 'steps',
    art: 'workstation',
    points: [
      {
        title: 'Clean',
        body: 'Remove food and visible residue with detergent and water.',
      },
      {
        title: 'Sanitize',
        body: 'Follow the food-safe sanitizer’s concentration and contact-time label.',
      },
      {
        title: 'Inspect',
        body: 'Replace a board that is cracked or cannot be cleaned.',
      },
    ],
    caption:
      'Prepare a clean, sanitized, stable surface before laying out the bread.',
    transcript: [
      'Clean the preparation surface and board by removing visible food and residue with detergent and water. Then use a food-safe sanitizer according to its labeled concentration and contact time, allowing the surface to air-dry as directed.',
      'Inspect the board for cracks or deep scoring that prevents effective cleaning. Keep it flat on a dry, stable surface, and reset the preparation area between sandwiches for different people.',
    ],
  },
  {
    id: 'tool-handling',
    chapter: 'Workspace & tools',
    eyebrow: 'Choose and handle tools',
    title: 'Keep the blade under control',
    lead: 'Use a spreader for spreading and a table knife for the cut.',
    layout: 'comparison',
    art: 'cut',
    points: [
      {
        title: 'On the board',
        body: 'Cut on a stable board with the blade moving away from your fingers.',
      },
      {
        title: 'Between uses',
        body: 'Set the knife down flat, away from the counter edge.',
      },
      {
        title: 'During cleanup',
        body: 'Keep knives visible; never leave one hidden in soapy water.',
      },
    ],
    takeaway: 'Never hold the sandwich in your palm while cutting.',
    caption:
      'Keep the sandwich on the board and the blade away from your fingers.',
    transcript: [
      'Use an appropriate spreader for each jar and a table knife for the optional cut. Keep the sandwich on the stable board, with the blade moving away from your hand and fingers. Never hold it in your palm while cutting.',
      'Set the knife down flat and keep it visible during cleanup. If you cut yourself, stop, step away from the food, and follow the applicable first-aid procedure. Discard food that may have been contaminated and clean the affected area before resuming.',
    ],
  },
  {
    id: 'tool-care',
    chapter: 'Workspace & tools',
    eyebrow: 'Look after the setup',
    title: 'Clean tools stay ready',
    lead: 'Care for the surfaces that touch the food.',
    layout: 'principles',
    art: 'storage',
    points: [
      {
        title: 'Utensils',
        body: 'Wash, rinse, and dry after use; replace cracked handles.',
      },
      {
        title: 'Boards',
        body: 'Clean and sanitize, then store so both sides can dry.',
      },
      {
        title: 'Towels & jars',
        body: 'Keep hand towels separate from spill cleanup; wipe and seal jar lids.',
      },
    ],
    caption: 'Inspect tools, separate towel uses, and keep jar closures clean.',
    transcript: [
      'Wash used utensils, rinse them, and let them dry. Replace tools with cracked handles. Clean and sanitize the board and store it so both faces can dry.',
      'Use clean hand towels for hands, and disposable towels for food spills in this practice setup. Wipe jar threads and lids before closing, and follow the product’s storage instructions.',
    ],
  },
  {
    id: 'step-1-inspect',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 01 of 07',
    title: 'Gather and inspect',
    lead: 'Make the final check before assembly.',
    layout: 'steps',
    art: 'ingredients',
    points: [
      {
        title: 'Hands & station',
        body: 'Wash hands and verify that the work surface and tools are ready.',
      },
      {
        title: 'Labels & dates',
        body: 'Check each ingredient and confirm it matches the recipient.',
      },
      {
        title: 'Dedicated tools',
        body: 'Keep a clean spreader beside each jar.',
      },
    ],
    takeaway: 'Resolve any ingredient concern before moving on.',
    caption:
      'Step one: check hands, station, labels, dates, and dedicated utensils.',
    transcript: [
      'Step one is gather and inspect. Wash your hands, confirm that the station is ready, and check each ingredient label and date.',
      'Confirm the ingredients match the recipient’s needs. If a label shows an allergen they must avoid, stop and resolve the ingredient choice before beginning.',
    ],
  },
  {
    id: 'step-2-bread',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 02 of 07',
    title: 'Lay out the bread',
    lead: 'Start with two matching slices, side by side.',
    layout: 'split',
    art: 'ingredients',
    points: [
      {
        title: 'Align',
        body: 'Place both slices flat on the clean board with crust edges matched.',
      },
      {
        title: 'Leave room',
        body: 'Keep enough space to spread without reaching across a jar or blade.',
      },
    ],
    caption:
      'Step two: position matching slices on the board before applying either spread.',
    transcript: [
      'Step two is lay out the bread. Place two matching slices next to each other on the clean board, with their crust edges aligned.',
      'The left slice will receive peanut butter and the right slice fruit spread. Leave enough working room to spread with controlled strokes.',
    ],
  },
  {
    id: 'step-3-peanut-butter',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 03 of 07',
    title: 'Spread from the center out',
    lead: 'Light pressure keeps the bread intact.',
    layout: 'split',
    art: 'spread',
    points: [
      {
        title: 'Start centrally',
        body: 'Place about two tablespoons of peanut butter in the center.',
      },
      {
        title: 'Work outward',
        body: 'Use gentle, overlapping strokes toward every edge.',
      },
      {
        title: 'Keep it even',
        body: 'Rotate the slice as needed instead of stretching across it.',
      },
    ],
    caption:
      'Step three: use the peanut butter spreader and work gently from the center to the crust.',
    transcript: [
      'Step three is spread the peanut butter. Using its dedicated spreader, place about two tablespoons in the center of the left slice, adjusting the amount for the bread size.',
      'Work outward in smooth, overlapping strokes. Use light pressure and rotate the slice if it helps you reach the corners. Keep the layer even and the bread intact.',
    ],
  },
  {
    id: 'step-4-fruit-spread',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 04 of 07',
    title: 'Add a thin fruit layer',
    lead: 'A little spread, distributed evenly.',
    layout: 'split',
    art: 'spread',
    points: [
      {
        title: 'Switch utensils',
        body: 'Use the second clean spreader for the fruit spread.',
      },
      {
        title: 'Use the other slice',
        body: 'Apply about one tablespoon to the right slice.',
      },
      {
        title: 'Control the edge',
        body: 'Spread evenly to the crust without pushing filling past it.',
      },
    ],
    caption:
      'Step four: use the second spreader to apply a thinner fruit layer to the other slice.',
    transcript: [
      'Step four is apply the fruit spread. Use its own clean spreader and begin with about one tablespoon on the right slice.',
      'Create a thin, even layer up to the crust. Keep the spread inside the bread’s outline so closing the sandwich will not force filling out of the sides.',
    ],
  },
  {
    id: 'step-5-close',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 05 of 07',
    title: 'Align and close gently',
    lead: 'Bring the layers together without squeezing them out.',
    layout: 'split',
    art: 'sandwich',
    points: [
      {
        title: 'Turn',
        body: 'Lift the fruit-spread slice and turn its filling toward the peanut butter.',
      },
      { title: 'Align', body: 'Bring the crust edges together evenly.' },
      {
        title: 'Press lightly',
        body: 'Use gentle pressure across the surface to close the sandwich.',
      },
    ],
    caption:
      'Step five: align the slices, filling sides together, and press lightly.',
    transcript: [
      'Step five is close. Lift the slice with fruit spread and place it spread-side down onto the peanut butter slice.',
      'Align the edges and press lightly across the surface. The goal is contact between the layers without flattening the bread or forcing filling beyond the crust.',
    ],
  },
  {
    id: 'step-6-cut',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 06 of 07',
    title: 'Cut only if requested',
    lead: 'A clean cut keeps the layers in place.',
    layout: 'split',
    art: 'cut',
    points: [
      {
        title: 'Keep it stable',
        body: 'Leave the sandwich flat on the board.',
      },
      {
        title: 'Cut gently',
        body: 'Make a straight or diagonal cut with the blade away from your fingers.',
      },
      {
        title: 'Check the result',
        body: 'Look for even halves and filling that stays inside.',
      },
    ],
    caption:
      'Step six: make an optional straight or diagonal cut on the board.',
    transcript: [
      'Step six is cut, if requested. Leave the sandwich on the stable board and use a table knife to make a straight or diagonal cut.',
      'Use a gentle sawing motion with the blade away from your fingers. Avoid compressing the bread. Keep the blade clean between sandwiches.',
    ],
  },
  {
    id: 'step-7-serve-reset',
    chapter: 'Procedure',
    eyebrow: 'The standard method · Step 07 of 07',
    title: 'Plate or wrap, then reset',
    lead: 'The method ends with a ready station.',
    layout: 'steps',
    art: 'sandwich',
    points: [
      {
        title: 'Inspect',
        body: 'Check coverage, exterior, cut, and the recipient match.',
      },
      {
        title: 'Serve or pack',
        body: 'Plate for immediate service or wrap for later.',
      },
      {
        title: 'Reset',
        body: 'Seal and store jars, then clean the tools and station.',
      },
    ],
    caption: 'Step seven: inspect, plate or wrap, and restore the workspace.',
    transcript: [
      'Step seven is plate or wrap and reset. Inspect the finished sandwich before serving. For immediate service, place the halves cut-side up on a clean plate; for later, wrap the sandwich.',
      'Return the lids, store the ingredients according to their labels, and clean the tools and station. The next chapter looks more closely at these finishing decisions.',
    ],
  },
  {
    id: 'barrier-method',
    chapter: 'Procedure',
    eyebrow: 'Technique for later service',
    title: 'Protect the bread from moisture',
    lead: 'Use the barrier method for a packed sandwich.',
    layout: 'comparison',
    art: 'spread',
    points: [
      {
        title: 'Both slices',
        body: 'Apply a thin peanut butter layer to each slice.',
      },
      {
        title: 'Fruit in the middle',
        body: 'Keep the fruit spread between the peanut butter layers.',
      },
      {
        title: 'Same utensil rule',
        body: 'Keep each jar’s utensil separate throughout the method.',
      },
    ],
    takeaway: 'The barrier slows moisture moving into the bread.',
    caption:
      'For later service, a thin peanut butter layer on each slice surrounds the fruit spread.',
    transcript: [
      'For a sandwich that will be eaten later, spread a thin layer of peanut butter on both slices and put the fruit spread between those layers. This barrier slows moisture moving from the fruit spread into the bread.',
      'Keep the layers controlled and maintain the dedicated-utensil rule. Follow the product labels and applicable storage instructions when holding the sandwich.',
    ],
  },
  {
    id: 'final-inspection',
    chapter: 'Quality & cleanup',
    eyebrow: 'Before service',
    title: 'Take one final look',
    lead: 'Check the result and the recipient match.',
    layout: 'principles',
    art: 'sandwich',
    points: [
      {
        title: 'Inside',
        body: 'Even coverage and balanced layers, with no overloaded areas.',
      },
      {
        title: 'Outside',
        body: 'Dry crust, contained filling, and even halves if cut.',
      },
      {
        title: 'Recipient',
        body: 'Confirm the ingredients and handling match the recipient’s needs.',
      },
    ],
    takeaway: 'Do not serve if you suspect allergen cross-contact.',
    caption:
      'A neat appearance and a correct ingredient match both belong in the final check.',
    transcript: [
      'Check that the spread reaches the crust, the layers are balanced, and the outside is clean and dry. If the sandwich is cut, look for even halves and filling that remains inside.',
      'Confirm the ingredient choice once more. If the wrong bread was used or cross-contact is suspected, do not scrape the filling onto new bread. Remake it with the correct ingredients and a clean setup.',
    ],
  },
  {
    id: 'troubleshooting',
    chapter: 'Quality & cleanup',
    eyebrow: 'Refine the technique',
    title: 'Read the result',
    lead: 'Small changes in technique solve common problems.',
    layout: 'comparison',
    art: 'spread',
    points: [
      {
        title: 'Torn bread',
        body: 'Use lighter strokes and avoid forcing stiff spread across soft bread.',
      },
      {
        title: 'Leaking filling',
        body: 'Apply less fruit spread and keep it within the crust.',
      },
      {
        title: 'Uneven or soggy bites',
        body: 'Reach the edges evenly; use the barrier method for later service.',
      },
    ],
    caption:
      'Use pressure, layer thickness, and coverage to adjust the finished texture.',
    transcript: [
      'Torn bread often indicates too much pressure or a stiff spread. Use gentler strokes. Leaking fruit spread usually calls for a thinner layer that stays within the bread’s outline.',
      'Uneven bites call for more consistent coverage. For moisture that develops while a sandwich waits, consider the barrier method. If a jar has been cross-contaminated, stop using it and follow the applicable handling procedure.',
    ],
  },
  {
    id: 'serve-or-pack',
    chapter: 'Quality & cleanup',
    eyebrow: 'Choose the finish',
    title: 'Serve now or prepare for later',
    lead: 'Choose the presentation to suit the plan.',
    layout: 'comparison',
    art: 'sandwich',
    points: [
      {
        title: 'Serve now',
        body: 'Use a clean, dry plate; show the cut faces if the sandwich is halved.',
      },
      {
        title: 'Pack for later',
        body: 'Wrap the sandwich and use the barrier method to help protect texture.',
      },
      {
        title: 'Store correctly',
        body: 'Follow ingredient labels and the applicable storage procedure.',
      },
    ],
    caption:
      'Plate for immediate service, or wrap and store according to the ingredients and procedure.',
    transcript: [
      'For immediate service, place the sandwich on a clean, dry plate. If it has been cut, turn the cut faces upward so the layers are visible.',
      'For later service, wrap it and follow the ingredient labels and applicable storage procedure. The barrier method can help preserve the bread’s texture while it waits.',
    ],
  },
  {
    id: 'variations',
    chapter: 'Quality & cleanup',
    eyebrow: 'Adapt with care',
    title: 'A variation needs the same checks',
    lead: 'Changing an ingredient changes the decision.',
    layout: 'principles',
    art: 'ingredients',
    points: [
      {
        title: 'Alternative spreads',
        body: 'Check seed or soy spreads against the recipient’s needs and label.',
      },
      {
        title: 'Alternative breads',
        body: 'Gluten-free does not automatically mean free of other allergens.',
      },
      {
        title: 'Fresh fruit',
        body: 'Added fruit increases moisture; serve that variation promptly.',
      },
    ],
    caption:
      'Check the recipient and label again whenever bread, spread, or fillings change.',
    transcript: [
      'Alternative spreads and breads may be useful, but no substitute is automatically safe for every allergy. Read the label and confirm the recipient’s needs before using it.',
      'A different bread or a crunchy spread also changes texture and spreading technique. Added bananas or berries introduce more moisture, so serve a fresh-fruit variation promptly.',
    ],
  },
  {
    id: 'store-ingredients',
    chapter: 'Quality & cleanup',
    eyebrow: 'Reset · Ingredients',
    title: 'Close, label, return',
    lead: 'Put every ingredient back in its proper place.',
    layout: 'steps',
    art: 'storage',
    points: [
      {
        title: 'Wipe & seal',
        body: 'Clean jar threads and lids, then close them securely.',
      },
      {
        title: 'Follow the label',
        body: 'Refrigerate opened products when their instructions require it.',
      },
      {
        title: 'Keep storage organized',
        body: 'Use the designated area and label opened jars according to procedure.',
      },
    ],
    caption:
      'Clean closures and label-led storage finish the ingredient part of the reset.',
    transcript: [
      'Wipe the jar threads and lids before tightening them securely. Return each product to its designated storage location.',
      'Follow the product’s instructions, including refrigeration after opening when required. Keep peanut products in the dedicated storage area where the kitchen procedure calls for one, and mark opened jars according to that procedure.',
    ],
  },
  {
    id: 'reset-station',
    chapter: 'Quality & cleanup',
    eyebrow: 'Reset · Tools and surfaces',
    title: 'Leave the station ready',
    lead: 'Finish the cleanup before calling the task done.',
    layout: 'steps',
    art: 'workstation',
    points: [
      {
        title: 'Wash tools',
        body: 'Clean the spreaders and knife, rinse, and allow them to dry.',
      },
      {
        title: 'Restore surfaces',
        body: 'Clean and sanitize the board and counter; let the board dry.',
      },
      {
        title: 'Finish clean',
        body: 'Discard used paper towels, remove soiled towels, and wash your hands.',
      },
    ],
    caption:
      'Clean the tools and surfaces, remove used towels, and finish by washing your hands.',
    transcript: [
      'Wash the spreaders and knife after use, keeping the blade visible and controlled. Clean and sanitize the board and counter, following the sanitizer label. Store the board so both faces can dry.',
      'Discard single-use towels and place soiled reusable towels in the laundry. Wash your hands once more and leave the station ready for the next task.',
    ],
  },
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
