import type { Course } from './schema';

/** Complete block catalog, kept separate from the learner-facing sample. */
export const pbjComponentLabCourse: Course = {
  id: 'pbj-101-lab',
  code: 'PBJ-LAB',
  title: 'Peanut Butter and Jelly Sandwich Preparation',
  subtitle: 'An exhaustively detailed sandbox course for the HSE Informer player',
  version: '0.1.0-sandbox',
  language: 'en-US',
  audience: 'Product, design, and engineering reviewers of the course player',
  purpose:
    'Exercise every content, disclosure, activity, and interaction block in the component library through one low-stakes task, so that playback, grading, progress, and accessibility can be evaluated before real courses are built on the same shell.',
  objectives: [
    'Describe the quality criteria for a finished sandwich.',
    'Explain cross-contact and the dedicated-utensil rule.',
    'Perform the five handwashing steps and know when to wash.',
    'Set up a station and follow the seven-step standard method.',
    'Troubleshoot common results and choose the barrier method for packed sandwiches.',
    'Recognize how each block type behaves in the player.',
  ],
  modules: [
    {
      id: 'm1',
      title: 'Orientation',
      description:
        'How the course and the player work, and the standard the course aims for.',
      lessons: [
        {
          id: 'l1-1',
          title: 'How this course and player work',
          summary: 'Navigation, requirements, and the four block families.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 1 · Orientation',
              text: 'Welcome to the sandbox course',
            },
            {
              type: 'paragraph',
              variant: 'lead',
              text: 'This course teaches one deliberately ordinary task—preparing a peanut butter and jelly sandwich—in exhaustive detail. The subject is simple so that every part of the course player and component library can be exercised and inspected.',
            },
            {
              type: 'callout',
              variant: 'info',
              title: 'Why a sandwich?',
              text: 'A low-stakes topic lets the team evaluate navigation, knowledge checks, activities, assessments, and accessibility without debating safety content. Nothing here is a workplace training requirement.',
            },
            {
              type: 'objectives',
              items: [
                'Navigate lessons, modules, the final assessment, and the summary.',
                'Recognize the four block families: content, disclosure, activity, and interaction.',
                'Complete a lesson by meeting its requirements, then continue.',
              ],
            },
            {
              type: 'list',
              style: 'numbered',
              title: 'How to move through the course',
              items: [
                'Open a lesson from the outline, or use Continue at the bottom of each lesson.',
                'Answer each knowledge check and press Check answer. Formative checks give feedback and never block you for being wrong.',
                'Complete required activities, such as checklists or acknowledgements, when a lesson includes them.',
                'Press Mark complete and continue. In linear mode, later lessons unlock as you finish earlier ones.',
              ],
            },
            {
              type: 'figure',
              art: 'sandwich',
              alt: 'A finished peanut butter and jelly sandwich cut diagonally on a plate.',
              caption:
                'Every illustration in this course is an inline vector drawing with a text alternative.',
            },
            {
              type: 'callout',
              variant: 'note',
              title: 'Sandbox controls',
              text: 'The bar above the lesson has three development controls: show component notes, switch between linear and free navigation, and reset progress. Component notes reveal the authoring intent behind each block.',
            },
            {
              type: 'multipleChoice',
              id: 'q-1-1-complete',
              prompt: 'What must happen before a lesson can be marked complete?',
              options: [
                {
                  id: 'a',
                  text: 'Every knowledge check must be answered correctly.',
                },
                {
                  id: 'b',
                  text: 'Required knowledge checks must be checked and required activities completed.',
                },
                {
                  id: 'c',
                  text: 'The learner must spend the estimated number of minutes on the page.',
                },
              ],
              answer: 'b',
              explanation:
                'Lessons require engagement, not perfection. Formative checks must be checked; required activities must be finished. Time on page is never a requirement.',
            },
          ],
        },
        {
          id: 'l1-2',
          title: 'What a good sandwich looks like',
          summary: 'The five quality criteria the whole course builds toward.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 1 · Orientation',
              text: 'The standard we are aiming for',
            },
            {
              type: 'paragraph',
              variant: 'lead',
              text: 'Before learning the procedure, agree on the result. A well-made sandwich is consistent, tidy, and safe to eat.',
            },
            {
              type: 'keyTakeaways',
              title: 'Quality criteria',
              items: [
                {
                  title: 'Edge-to-edge coverage',
                  text: 'Both spreads reach the crust so every bite tastes the same.',
                },
                {
                  title: 'Balanced ratio',
                  text: 'Peanut butter and fruit spread are present in roughly equal visual amounts; neither overwhelms the bread.',
                },
                {
                  title: 'Dry exterior',
                  text: 'No spread leaks past the edges, and the outside of the bread stays clean.',
                },
                {
                  title: 'Clean cut',
                  text: 'If cut, the halves are even and the filling stays inside.',
                },
                {
                  title: 'Safe handling',
                  text: 'Clean hands, clean tools, and no cross-contact between jars.',
                },
              ],
            },
            {
              type: 'media',
              kind: 'video',
              title: 'Demonstration: a sandwich made to standard',
              duration: '1:40',
              captions: true,
              transcript: [
                '[Narrator] Two slices of bread lie side by side on a clean board.',
                '[Narrator] Peanut butter is spread on the left slice, from the center out to every edge.',
                '[Narrator] A separate, clean spreader applies fruit spread to the right slice.',
                '[Narrator] The slices are closed, pressed lightly, and cut once on the diagonal.',
                '[Narrator] The finished halves are plated with the cut faces showing even layers.',
              ],
              note: 'Media is a placeholder frame in the sandbox. Production courses would supply a captioned video file alongside this transcript.',
            },
            {
              type: 'trueFalse',
              id: 'q-1-2-edges',
              prompt:
                'A sandwich meets the standard if the spreads stop about a centimeter short of the crust.',
              answer: false,
              explanation:
                'Edge-to-edge coverage is one of the five criteria. Spreads should reach the crust.',
            },
          ],
        },
      ],
    },
    {
      id: 'm2',
      title: 'Foundations',
      description: 'Where the sandwich came from and what goes into it.',
      lessons: [
        {
          id: 'l2-1',
          title: 'A short history',
          summary: 'Commonly cited milestones, shown as a timeline.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 2 · Foundations',
              text: 'How the sandwich came to be',
            },
            {
              type: 'paragraph',
              text: 'The sandwich is common today, but its ingredients arrived at different times. The timeline below uses commonly cited dates; treat them as context rather than examination content.',
            },
            {
              type: 'timeline',
              title: 'Milestones',
              events: [
                {
                  label: '1884',
                  title: 'Peanut paste patented',
                  text: 'Marcellus Gilmore Edson received a patent for a process that produced a peanut paste.',
                },
                {
                  label: '1895',
                  title: 'Peanut butter process',
                  text: 'John Harvey Kellogg filed for a patent on a process for preparing nut meal, often cited as early peanut butter.',
                },
                {
                  label: '1901',
                  title: 'First published recipe',
                  text: 'Julia Davis Chandler published a recipe pairing peanut butter with jelly in the Boston Cooking-School Magazine.',
                },
                {
                  label: '1928',
                  title: 'Sliced bread sold commercially',
                  text: 'Pre-sliced bread reached shoppers, making uniform sandwiches quick to assemble.',
                },
                {
                  label: '1940s',
                  title: 'Everyday staple',
                  text: 'The combination became an everyday meal in the United States; its wartime popularity is frequently credited with the spread.',
                },
              ],
            },
            {
              type: 'callout',
              variant: 'note',
              title: 'Why history is here',
              text: 'The timeline block shows how the player renders dated sequences. The dates are not assessed.',
            },
            {
              type: 'multipleChoice',
              id: 'q-2-1-recipe',
              required: false,
              prompt:
                'Which year is commonly cited for the first published peanut butter and jelly recipe?',
              options: [
                { id: 'a', text: '1884' },
                { id: 'b', text: '1901' },
                { id: 'c', text: '1928' },
              ],
              answer: 'b',
              explanation:
                'The 1901 Boston Cooking-School Magazine recipe is the usual citation. This check is optional.',
            },
          ],
        },
        {
          id: 'l2-2',
          title: 'Ingredients',
          summary: 'Bread, peanut butter, and fruit spreads—and their allergens.',
          minutes: 7,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 2 · Foundations',
              text: 'Three ingredients, many choices',
            },
            {
              type: 'paragraph',
              variant: 'lead',
              text: 'Bread, peanut butter, and a fruit spread. Each has variations that change the result and, more importantly, the allergen profile.',
            },
            {
              type: 'tabs',
              title: 'Ingredient families',
              tabs: [
                {
                  label: 'Bread',
                  text: 'Sandwich bread is sliced to a consistent thickness. Softer breads tear under firm spreading; denser breads hold up better.',
                  bullets: [
                    'Check the label: wheat is a major allergen, and some breads also contain milk, eggs, soy, or sesame.',
                    'Use slices from the same loaf so the halves match.',
                    'Day-old bread resists sogginess slightly better than very fresh bread.',
                  ],
                },
                {
                  label: 'Peanut butter',
                  text: 'Ground roasted peanuts, sometimes with salt, sugar, or stabilizing oils. Natural styles separate and need stirring.',
                  bullets: [
                    'Peanuts are a major allergen; many kitchens keep peanut products away from shared tools.',
                    'Smooth spreads more evenly; crunchy adds texture but tears soft bread.',
                    'Stir natural peanut butter until uniform before measuring.',
                  ],
                },
                {
                  label: 'Fruit spread',
                  text: 'Jelly, jam, preserves, and fruit butter are all cooked fruit products with different textures.',
                  bullets: [
                    'Jelly is made from strained fruit juice and is smooth.',
                    'Jam uses crushed fruit; preserves keep whole or large pieces.',
                    'Refrigerate after opening when the label says so.',
                  ],
                },
              ],
            },
            {
              type: 'table',
              caption: 'Fruit spread comparison',
              columns: ['Spread', 'Made from', 'Texture', 'Spreadability'],
              rows: [
                [
                  'Jelly',
                  'Strained fruit juice set with pectin',
                  'Smooth, firm gel',
                  'Easy; may slide on peanut butter',
                ],
                [
                  'Jam',
                  'Crushed or puréed fruit',
                  'Soft with small pieces',
                  'Easy; clings well',
                ],
                [
                  'Preserves',
                  'Whole or large fruit pieces in syrup',
                  'Chunky',
                  'Uneven; pieces can tear bread',
                ],
                [
                  'Fruit butter',
                  'Fruit cooked down to a thick purée',
                  'Dense and smooth',
                  'Very easy; less sweet',
                ],
              ],
            },
            {
              type: 'definition',
              term: 'Cross-contact',
              definition:
                'The unintentional transfer of an allergen from one food or surface to another—for example, a spreader used in peanut butter and then dipped into a shared jelly jar.',
              example: 'A clean spreader for each jar prevents cross-contact.',
            },
            {
              type: 'flashcards',
              title: 'Vocabulary check',
              cards: [
                {
                  front: 'Edge-to-edge',
                  back: 'Spreading so the layer reaches the crust on all sides.',
                },
                {
                  front: 'Barrier spread',
                  back: 'A thin peanut butter layer on both slices that keeps jelly from soaking the bread.',
                },
                {
                  front: 'Pectin',
                  back: 'A natural fruit fiber that helps jelly and jam set.',
                },
                {
                  front: 'Dedicated utensil',
                  back: 'A spreader used in only one jar during preparation.',
                },
              ],
            },
            {
              type: 'multipleResponse',
              id: 'q-2-2-allergens',
              prompt:
                'Which of these ingredients are among the nine major food allergens recognized by the U.S. FDA?',
              options: [
                { id: 'peanut', text: 'Peanuts' },
                { id: 'wheat', text: 'Wheat' },
                { id: 'grape', text: 'Grapes' },
                { id: 'milk', text: 'Milk' },
                { id: 'strawberry', text: 'Strawberries' },
              ],
              answers: ['peanut', 'wheat', 'milk'],
              explanation:
                'The nine major allergens are milk, eggs, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans, and sesame. Grapes and strawberries are not on the list, though any food can cause a reaction in some people.',
            },
          ],
        },
      ],
    },
    {
      id: 'm3',
      title: 'Safety and hygiene',
      description: 'Allergens, cross-contact, handwashing, and knife safety.',
      lessons: [
        {
          id: 'l3-1',
          title: 'Allergen awareness',
          summary: 'The nine major allergens and how cross-contact happens.',
          minutes: 6,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 3 · Safety and hygiene',
              text: 'Allergens and cross-contact',
            },
            {
              type: 'callout',
              variant: 'danger',
              title: 'Peanuts are a major allergen',
              text: 'Peanuts, tree nuts, wheat, milk, eggs, soybeans, sesame, fish, and crustacean shellfish are the nine major food allergens under U.S. law. Allergic reactions range from mild to life-threatening. Always know who will eat the food and follow your organization’s allergen procedure.',
            },
            {
              type: 'paragraph',
              variant: 'muted',
              text: 'This course does not provide medical advice. If someone shows signs of an allergic reaction, follow the emergency procedure for your location.',
            },
            {
              type: 'list',
              style: 'check',
              title: 'Preventing cross-contact',
              items: [
                'Use a separate, clean utensil for each jar.',
                'Never return a utensil that touched bread or another spread to a jar.',
                'Wipe and sanitize the surface between sandwiches made for different people.',
                'Keep peanut products in their own labeled container or area where required.',
                'Read every label each time; recipes and suppliers change.',
              ],
            },
            {
              type: 'sorting',
              id: 'q-3-1-sort',
              prompt:
                'Sort each practice as a cross-contact risk or a safe practice.',
              categories: [
                { id: 'risk', label: 'Cross-contact risk' },
                { id: 'safe', label: 'Safe practice' },
              ],
              items: [
                {
                  id: 's1',
                  text: 'Dipping the peanut butter spreader into the jelly jar',
                  category: 'risk',
                },
                {
                  id: 's2',
                  text: 'Using two labeled spreaders',
                  category: 'safe',
                },
                {
                  id: 's3',
                  text: 'Wiping the board with the towel used on the peanut butter lid',
                  category: 'risk',
                },
                {
                  id: 's4',
                  text: 'Washing hands before making a sandwich for someone with an allergy',
                  category: 'safe',
                },
                {
                  id: 's5',
                  text: 'Reading the bread label before each service',
                  category: 'safe',
                },
              ],
            },
            {
              type: 'references',
              title: 'Sources for this lesson',
              items: [
                {
                  label: 'FDA · Food Allergies and the nine major allergens',
                  href: 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies',
                },
              ],
            },
            {
              type: 'multipleChoice',
              id: 'q-3-1-label',
              prompt:
                'A new case of bread arrives from a different supplier. What should happen before it is used?',
              options: [
                { id: 'a', text: 'Nothing; bread is bread.' },
                {
                  id: 'b',
                  text: 'Read the ingredient and allergen label, because formulations differ between suppliers.',
                  feedback: 'Correct. Labels change with suppliers and recipes.',
                },
                { id: 'c', text: 'Taste a slice to check quality.' },
              ],
              answer: 'b',
              explanation:
                'Formulations differ between suppliers, so the label is read before first use.',
            },
          ],
        },
        {
          id: 'l3-2',
          title: 'Hand hygiene',
          summary: 'The five handwashing steps and the key times to wash.',
          minutes: 5,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 3 · Safety and hygiene',
              text: 'Clean hands before clean food',
            },
            {
              type: 'figure',
              art: 'handwash',
              alt: 'Hands being washed under a running tap with soap lather.',
              caption: 'Wet, lather, scrub, rinse, dry.',
            },
            {
              type: 'steps',
              title: 'The five handwashing steps',
              steps: [
                {
                  title: 'Wet',
                  text: 'Wet your hands with clean, running water, turn off the tap, and apply soap.',
                },
                {
                  title: 'Lather',
                  text: 'Rub your hands together with the soap, including the backs, between the fingers, and under the nails.',
                },
                {
                  title: 'Scrub',
                  text: 'Scrub for at least 20 seconds—about the time it takes to hum “Happy Birthday” twice.',
                },
                {
                  title: 'Rinse',
                  text: 'Rinse well under clean, running water.',
                },
                {
                  title: 'Dry',
                  text: 'Dry your hands with a clean towel or an air dryer.',
                },
              ],
            },
            {
              type: 'list',
              style: 'bullet',
              title: 'Key times to wash during sandwich preparation',
              items: [
                'Before, during, and after preparing food.',
                'After touching garbage or a trash lid.',
                'After blowing your nose, coughing, or sneezing.',
                'After touching your face, hair, or phone.',
                'Before switching to food for a person with an allergy.',
              ],
            },
            {
              type: 'callout',
              variant: 'tip',
              title: 'When soap and water are not available',
              text: 'Use an alcohol-based hand sanitizer with at least 60% alcohol. Sanitizer is a backup, not a replacement, when hands are visibly dirty or greasy from food preparation.',
            },
            {
              type: 'numeric',
              id: 'q-3-2-seconds',
              prompt: 'For how many seconds should you scrub your hands?',
              min: 20,
              max: 60,
              unit: 'seconds',
              explanation: 'At least 20 seconds. Longer is fine.',
            },
            {
              type: 'trueFalse',
              id: 'q-3-2-sanitizer',
              prompt:
                'Hand sanitizer works just as well as soap and water on hands that are greasy from food preparation.',
              answer: false,
              explanation:
                'Sanitizer is less effective on visibly dirty or greasy hands. Wash with soap and water when you can.',
            },
            {
              type: 'references',
              items: [
                {
                  label: 'CDC · About Handwashing',
                  href: 'https://www.cdc.gov/clean-hands/about/index.html',
                },
              ],
            },
          ],
        },
        {
          id: 'l3-3',
          title: 'Knife and surface safety',
          summary: 'The right tool, safe cutting, and surface readiness.',
          minutes: 5,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 3 · Safety and hygiene',
              text: 'Knives, boards, and surfaces',
            },
            {
              type: 'paragraph',
              text: 'A butter knife or spreader is the right tool. A sharp chef’s knife is unnecessary for spreading and raises the risk when cutting.',
            },
            {
              type: 'table',
              caption: 'Knife handling: do and do not',
              columns: ['Do', 'Do not'],
              rows: [
                [
                  'Use a spreader or table knife for spreading',
                  'Use a serrated or chef’s knife to spread',
                ],
                [
                  'Cut with the blade moving away from your hand',
                  'Hold the sandwich in your palm while cutting',
                ],
                [
                  'Keep the board flat on a dry, stable surface',
                  'Cut on a plate that can slide or crack',
                ],
                [
                  'Set the knife down flat, blade away from the edge',
                  'Leave a knife in a sink of soapy water',
                ],
              ],
            },
            {
              type: 'callout',
              variant: 'warning',
              title: 'If you cut yourself',
              text: 'Stop, step away from the food, and follow your site’s first-aid procedure. Food that may have been contaminated is discarded. Do not resume preparation until the wound is covered and your hands are clean again.',
            },
            {
              type: 'accordion',
              title: 'Surface readiness',
              items: [
                {
                  title: 'Clean',
                  text: 'Remove visible food and residue with detergent and water.',
                },
                {
                  title: 'Sanitize',
                  text: 'Apply a food-safe sanitizer at the labeled concentration and contact time, then let the surface air-dry.',
                },
                {
                  title: 'Inspect',
                  text: 'Look for deep knife scoring or cracks that trap residue. Replace boards that cannot be cleaned.',
                },
              ],
            },
            {
              type: 'fillBlank',
              id: 'q-3-3-blade',
              prompt: 'Complete the rule.',
              text: 'When cutting a sandwich, move the blade ___ from your hand.',
              accepted: ['away'],
              explanation: 'Always cut away from your hand and fingers.',
            },
            {
              type: 'scenario',
              id: 'q-3-3-scenario',
              prompt: 'Decide what to do.',
              situation:
                'You nick your finger while cutting a sandwich. There is a tiny drop of blood on the board but not visibly on the bread. The lunch line is waiting.',
              options: [
                {
                  id: 'a',
                  text: 'Rinse your finger, keep the sandwich, and finish quickly.',
                  outcome:
                    'Food that may have been contaminated cannot be served, and an uncovered wound cannot be near food.',
                  correct: false,
                },
                {
                  id: 'b',
                  text: 'Stop, follow the first-aid procedure, discard the sandwich, and clean and sanitize the board before restarting.',
                  outcome:
                    'This protects the person eating and follows the standard sequence: stop, treat, discard, clean, restart.',
                  correct: true,
                },
                {
                  id: 'c',
                  text: 'Discard only the sandwich and continue on the same board.',
                  outcome:
                    'The board was contaminated and must be cleaned and sanitized; your wound also needs attention first.',
                  correct: false,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'm4',
      title: 'Workspace and equipment',
      description: 'Station setup, tool care, and storage.',
      lessons: [
        {
          id: 'l4-1',
          title: 'Station setup',
          summary: 'Explore the station and complete the setup checklist.',
          minutes: 5,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 4 · Workspace and equipment',
              text: 'Set up once, work cleanly',
            },
            {
              type: 'paragraph',
              variant: 'lead',
              text: 'A prepared station prevents the shortcuts that cause cross-contact and mess. Explore the station below.',
            },
            {
              type: 'hotspots',
              id: 'hs-4-1-station',
              title: 'Explore the station',
              art: 'workstation',
              alt: 'A countertop with a cutting board and two bread slices in the center, a peanut butter jar to the left, a jelly jar to the right, a knife below the board, and a plate, sanitizer, two spreaders, and a towel along the back.',
              hotspots: [
                {
                  id: 'board',
                  x: 50,
                  y: 65,
                  label: 'Cutting board',
                  text: 'Clean, sanitized, and flat. Both slices fit with room to spread.',
                },
                {
                  id: 'knife',
                  x: 50,
                  y: 90,
                  label: 'Table knife',
                  text: 'Used only for the cut. Set down flat with the blade away from the counter edge.',
                },
                {
                  id: 'pb',
                  x: 15,
                  y: 62,
                  label: 'Peanut butter jar',
                  text: 'Kept on the left with its own labeled spreader. The lid stays closed between uses.',
                },
                {
                  id: 'jelly',
                  x: 85,
                  y: 62,
                  label: 'Fruit spread jar',
                  text: 'Kept on the right with its own spreader. Refrigerated after opening when the label requires it.',
                },
                {
                  id: 'plate',
                  x: 17,
                  y: 19,
                  label: 'Serving plate',
                  text: 'Clean and dry, ready before the sandwich is closed.',
                },
                {
                  id: 'sanitizer',
                  x: 30,
                  y: 17,
                  label: 'Surface sanitizer',
                  text: 'Food-safe sanitizer at the labeled concentration, with a contact-time card.',
                },
                {
                  id: 'spreaders',
                  x: 65,
                  y: 19,
                  label: 'Two labeled spreaders',
                  text: 'One for each jar. Labeled handles make the dedicated-utensil rule visible.',
                },
                {
                  id: 'towel',
                  x: 82,
                  y: 15,
                  label: 'Clean towel',
                  text: 'For drying hands only. Food spills use disposable towels.',
                },
              ],
            },
            {
              type: 'checklist',
              id: 'cl-4-1-setup',
              required: true,
              title: 'Station setup checklist',
              items: [
                'Hands washed and dried.',
                'Board and surface cleaned and sanitized.',
                'Two labeled spreaders and one table knife laid out.',
                'Bread, peanut butter, and fruit spread labels read.',
                'Plate or wrap ready.',
                'Trash and disposable towels within reach.',
              ],
            },
            {
              type: 'callout',
              variant: 'tip',
              title: 'Left and right',
              text: 'Keeping the peanut butter jar on one side and the fruit spread on the other makes a crossed utensil obvious at a glance.',
            },
          ],
        },
        {
          id: 'l4-2',
          title: 'Tool care and storage',
          summary: 'Keeping utensils, boards, and jars ready and safe.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 4 · Workspace and equipment',
              text: 'Caring for tools and ingredients',
            },
            {
              type: 'accordion',
              title: 'Tool care',
              items: [
                {
                  title: 'Spreaders and knives',
                  text: 'Wash in hot soapy water after each service, rinse, and air-dry. Replace spreaders with cracked handles.',
                },
                {
                  title: 'Cutting boards',
                  text: 'Wash, sanitize, and store on edge so both faces dry. Retire boards with deep scoring.',
                },
                {
                  title: 'Towels',
                  text: 'Hand towels are changed at least daily and whenever damp or soiled.',
                },
                {
                  title: 'Jars',
                  text: 'Wipe threads and lids before closing; residue on threads attracts contamination and prevents a seal.',
                },
              ],
            },
            {
              type: 'figure',
              art: 'storage',
              alt: 'A pantry shelf holding an unopened peanut butter jar and a refrigerator shelf holding an opened jelly jar.',
              caption:
                'Follow the label: many fruit spreads are refrigerated after opening.',
            },
            {
              type: 'callout',
              variant: 'note',
              title: 'Storage',
              text: 'Unopened jars follow the pantry guidance on the label. After opening, follow the label—many fruit spreads say “refrigerate after opening.” Mark the opening date on the lid.',
            },
            {
              type: 'matching',
              id: 'q-4-2-tools',
              prompt: 'Match each tool to its purpose.',
              pairs: [
                {
                  id: 'm1',
                  left: 'Labeled spreader',
                  right: 'Apply one spread from one jar',
                },
                {
                  id: 'm2',
                  left: 'Table knife',
                  right: 'Cut the closed sandwich',
                },
                {
                  id: 'm3',
                  left: 'Surface sanitizer',
                  right: 'Treat the cleaned board before use',
                },
                {
                  id: 'm4',
                  left: 'Disposable towel',
                  right: 'Wipe spills without recontaminating hand towels',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'm5',
      title: 'Procedure',
      description:
        'The seven-step standard method, spreading technique, and troubleshooting.',
      lessons: [
        {
          id: 'l5-1',
          title: 'The standard method',
          summary: 'Seven steps with cautions, narrated and sequenced.',
          minutes: 7,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 5 · Procedure',
              text: 'Seven steps, every time',
            },
            {
              type: 'figure',
              art: 'ingredients',
              alt: 'Two bread slices, a peanut butter jar, and a jelly jar arranged in a row.',
            },
            {
              type: 'steps',
              title: 'Standard method',
              steps: [
                {
                  title: 'Gather and inspect',
                  text: 'Wash hands, confirm the station checklist, and check each label and date.',
                  caution:
                    'Stop if any label shows an allergen the recipient must avoid.',
                },
                {
                  title: 'Lay out the bread',
                  text: 'Place two matching slices side by side on the board, crust edges aligned.',
                },
                {
                  title: 'Spread the peanut butter',
                  text: 'With the peanut butter spreader, place about two tablespoons in the center of the left slice and work outward to every edge in overlapping strokes.',
                  caution: 'Light pressure; soft bread tears under force.',
                },
                {
                  title: 'Spread the fruit spread',
                  text: 'With the second spreader, apply about one tablespoon to the right slice, edge to edge, in a thinner layer than the peanut butter.',
                },
                {
                  title: 'Close',
                  text: 'Lift the fruit-spread slice and lay it spread-side down onto the peanut butter slice. Press lightly to seal.',
                },
                {
                  title: 'Cut, if requested',
                  text: 'One diagonal or straight cut with the table knife, blade moving away from your hand. Wipe the knife between sandwiches.',
                },
                {
                  title: 'Plate or wrap',
                  text: 'Plate cut-side up for immediate service, or wrap tightly for later. Return lids, store jars, and reset the station.',
                },
              ],
            },
            {
              type: 'media',
              kind: 'audio',
              title: 'Narrated walk-through of the seven steps',
              duration: '2:05',
              captions: true,
              transcript: [
                'Step one: gather and inspect. Hands, checklist, labels, dates.',
                'Step two: lay out two matching slices.',
                'Step three: peanut butter, center outward, edge to edge, light pressure.',
                'Step four: fruit spread with the second spreader, a thinner layer.',
                'Step five: close and press lightly.',
                'Step six: one cut, blade away from your hand.',
                'Step seven: plate or wrap, then reset the station.',
              ],
              note: 'Audio placeholder; the transcript is the accessible equivalent.',
            },
            {
              type: 'sequencing',
              id: 'q-5-1-order',
              prompt: 'Put the standard method in order.',
              items: [
                { id: 'o1', text: 'Gather and inspect' },
                { id: 'o2', text: 'Lay out the bread' },
                { id: 'o3', text: 'Spread the peanut butter' },
                { id: 'o4', text: 'Spread the fruit spread' },
                { id: 'o5', text: 'Close and press lightly' },
                { id: 'o6', text: 'Cut if requested' },
                { id: 'o7', text: 'Plate or wrap and reset' },
              ],
              explanation:
                'Inspection comes first so a label problem stops work before any spreading.',
            },
            {
              type: 'fillBlank',
              id: 'q-5-1-utensil',
              prompt: 'Complete the rule.',
              text: 'Use a ___ spreader for each jar so no spread travels between them.',
              accepted: ['separate', 'dedicated', 'clean', 'different', 'second'],
              explanation:
                'Any wording that means one utensil per jar is accepted.',
            },
          ],
        },
        {
          id: 'l5-2',
          title: 'Spreading technique',
          summary: 'Center-out strokes, thin fruit spread, and the barrier method.',
          minutes: 5,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 5 · Procedure',
              text: 'Technique and the soggy-bread problem',
            },
            {
              type: 'tabs',
              title: 'Technique',
              tabs: [
                {
                  label: 'Peanut butter',
                  text: 'Start in the center and push outward in overlapping strokes. Rotate the slice rather than reaching across it.',
                  bullets: [
                    'Target thickness: about the height of a coin.',
                    'Reach the crust on all four sides.',
                    'Scrape the spreader clean on the slice, not on the jar rim.',
                  ],
                },
                {
                  label: 'Fruit spread',
                  text: 'Use less than you think. A thin, even layer tastes brighter and leaks less.',
                  bullets: [
                    'Jelly slides on peanut butter; spread it on its own slice.',
                    'Break up large preserve pieces with the spreader before spreading.',
                  ],
                },
                {
                  label: 'Barrier method',
                  text: 'For sandwiches eaten later, spread a thin peanut butter layer on both slices and put the fruit spread in the middle. The fat in the peanut butter slows moisture moving into the bread.',
                  bullets: [
                    'Use the barrier method for packed lunches.',
                    'Still keep each spread to its own utensil.',
                  ],
                },
              ],
            },
            {
              type: 'numeric',
              id: 'q-5-2-tbsp',
              prompt:
                'About how many tablespoons of peanut butter does the standard method use on one slice?',
              min: 1,
              max: 3,
              unit: 'tablespoons',
              explanation:
                'The standard method calls for about two tablespoons; one to three is acceptable depending on bread size.',
            },
            {
              type: 'scenario',
              id: 'q-5-2-soggy',
              prompt: 'Choose the best approach.',
              situation:
                'A sandwich is being made at 7 a.m. for a lunch eaten at noon. The recipient dislikes soggy bread.',
              options: [
                {
                  id: 'a',
                  text: 'Spread jelly directly on one slice as usual and wrap it.',
                  outcome:
                    'Five hours is long enough for jelly moisture to soak into untreated bread.',
                  correct: false,
                },
                {
                  id: 'b',
                  text: 'Spread a thin peanut butter layer on both slices and put the jelly between them.',
                  outcome: 'The barrier method keeps the bread drier for hours.',
                  correct: true,
                },
                {
                  id: 'c',
                  text: 'Use extra jelly so the flavor survives the wait.',
                  outcome:
                    'More jelly means more moisture and a soggier sandwich.',
                  correct: false,
                },
                {
                  id: 'd',
                  text: 'Toast the bread first.',
                  outcome:
                    'Toasting helps a little, but toast softens as it cools in a wrapper and loses texture by noon. The barrier method is the better fix.',
                  correct: false,
                },
              ],
            },
            {
              type: 'keyTakeaways',
              title: 'Technique in brief',
              items: [
                {
                  title: 'Center out',
                  text: 'Spreading from the center outward keeps thickness even.',
                },
                {
                  title: 'Less fruit spread',
                  text: 'A thin layer leaks less and tastes brighter.',
                },
                {
                  title: 'Barrier for later',
                  text: 'Peanut butter on both slices protects packed sandwiches.',
                },
              ],
            },
          ],
        },
        {
          id: 'l5-3',
          title: 'Troubleshooting',
          summary: 'Five common problems, their causes, and fixes.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 5 · Procedure',
              text: 'When the result is off',
            },
            {
              type: 'table',
              caption: 'Common problems',
              columns: ['Problem', 'Likely cause', 'Fix'],
              rows: [
                [
                  'Torn bread',
                  'Cold, stiff peanut butter or too much pressure',
                  'Let the jar sit at room temperature briefly; use lighter strokes',
                ],
                [
                  'Jelly leaking at the edges',
                  'Too much fruit spread or spread past the edge',
                  'Use a thinner layer and stop just at the crust',
                ],
                [
                  'Uneven bites',
                  'Spread did not reach the edges',
                  'Work center-out in overlapping strokes to the crust',
                ],
                [
                  'Soggy bread',
                  'Moisture from fruit spread over time',
                  'Use the barrier method for packed sandwiches',
                ],
                [
                  'Jelly in the peanut butter jar',
                  'Shared or returned utensil',
                  'Dedicated spreaders; discard the jar if an allergen was introduced',
                ],
              ],
            },
            {
              type: 'matching',
              id: 'q-5-3-fix',
              prompt: 'Match the problem to its fix.',
              pairs: [
                {
                  id: 'f1',
                  left: 'Torn bread',
                  right: 'Lighter strokes and room-temperature peanut butter',
                },
                {
                  id: 'f2',
                  left: 'Leaking jelly',
                  right: 'Thinner layer stopping at the crust',
                },
                {
                  id: 'f3',
                  left: 'Soggy packed sandwich',
                  right: 'Barrier method',
                },
                {
                  id: 'f4',
                  left: 'Jelly found in the peanut butter jar',
                  right: 'Dedicated spreaders',
                },
              ],
            },
            {
              type: 'callout',
              variant: 'success',
              title: 'Most fixes are technique',
              text: 'Four of the five common problems are solved by how you spread, not by changing ingredients.',
            },
          ],
        },
      ],
    },
    {
      id: 'm6',
      title: 'Quality, service, and cleanup',
      description:
        'Final inspection, variations, cleanup, reflection, and acknowledgement.',
      lessons: [
        {
          id: 'l6-1',
          title: 'Quality check and service',
          summary: 'The final inspection and a printable job aid.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 6 · Quality, service, and cleanup',
              text: 'Check before you serve',
            },
            {
              type: 'list',
              style: 'check',
              title: 'Final inspection',
              items: [
                'Spreads reach every edge.',
                'Exterior of the bread is clean and dry.',
                'Cut halves are even with the filling inside.',
                'Correct ingredients for the person receiving it.',
                'Station is reset: lids on, spreaders separated, surface wiped.',
              ],
            },
            {
              type: 'resource',
              title: 'One-page job aid: PB&J standard method',
              description:
                'A printable summary of the seven steps, the quality criteria, and the cross-contact rules for posting at the station.',
              format: 'PDF · 1 page · placeholder',
            },
            {
              type: 'multipleChoice',
              id: 'q-6-1-serve',
              prompt:
                'The sandwich looks perfect, but you realize you used the wrong bread for someone who avoids wheat. What do you do?',
              options: [
                { id: 'a', text: 'Serve it; it looks fine.' },
                {
                  id: 'b',
                  text: 'Remake it with the correct bread on a clean, sanitized surface with clean utensils.',
                  feedback:
                    'Correct. Appearance never overrides the recipient’s allergen needs.',
                },
                {
                  id: 'c',
                  text: 'Scrape off the spreads and reuse them on new bread.',
                },
              ],
              answer: 'b',
              explanation:
                'Remake it. Spreads that touched the wrong bread carry that bread’s allergens.',
            },
          ],
        },
        {
          id: 'l6-2',
          title: 'Variations and dietary notes',
          summary: 'Common variations and why substitutions need the same care.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 6 · Quality, service, and cleanup',
              text: 'Variations without surprises',
            },
            {
              type: 'accordion',
              title: 'Common variations',
              items: [
                {
                  title: 'Crunchy or smooth',
                  text: 'Crunchy adds texture but tears soft bread; use firmer bread or let the jar warm slightly.',
                },
                {
                  title: 'Alternative spreads',
                  text: 'Sunflower seed butter or soy nut butter is sometimes used where peanuts are excluded. Soy is itself a major allergen; read labels and confirm with the recipient.',
                },
                {
                  title: 'Different breads',
                  text: 'Whole grain, gluten-free, and flatbreads change texture and allergen profile. Gluten-free does not mean allergen-free.',
                },
                {
                  title: 'Added fruit',
                  text: 'Sliced banana or berries add moisture; serve immediately rather than packing.',
                },
              ],
            },
            {
              type: 'callout',
              variant: 'warning',
              title: 'Substitutions are not automatically safer',
              text: 'Never assume a substitute is safe for a person with an allergy. Confirm the recipient’s needs and read the label every time. This course does not provide medical or dietary advice.',
            },
            {
              type: 'multipleResponse',
              id: 'q-6-2-subs',
              prompt: 'Which statements about substitutions are correct?',
              options: [
                {
                  id: 'a',
                  text: 'Soy nut butter can substitute for peanut butter for someone avoiding peanuts, but soy is also a major allergen.',
                },
                { id: 'b', text: 'Gluten-free bread is safe for all allergies.' },
                {
                  id: 'c',
                  text: 'Labels should be read every time, even for a familiar product.',
                },
                {
                  id: 'd',
                  text: 'Adding fresh fruit makes a packed sandwich keep longer.',
                },
              ],
              answers: ['a', 'c'],
              explanation:
                'Gluten-free addresses wheat and gluten only, and fresh fruit adds moisture that shortens how long a packed sandwich stays pleasant.',
            },
          ],
        },
        {
          id: 'l6-3',
          title: 'Cleanup, reflection, and acknowledgement',
          summary: 'Reset the station, reflect, rate your confidence, and acknowledge.',
          minutes: 5,
          blocks: [
            {
              type: 'heading',
              kicker: 'Module 6 · Quality, service, and cleanup',
              text: 'Finish the job',
            },
            {
              type: 'steps',
              title: 'Cleanup',
              steps: [
                {
                  title: 'Lids and jars',
                  text: 'Wipe threads, close lids, and return jars to their labeled storage.',
                },
                {
                  title: 'Utensils',
                  text: 'Wash spreaders and the knife in hot soapy water, rinse, and air-dry.',
                },
                {
                  title: 'Surface',
                  text: 'Clear crumbs, clean, then sanitize the board and counter.',
                },
                {
                  title: 'Hands',
                  text: 'Wash hands after handling trash and before the next task.',
                },
              ],
            },
            {
              type: 'figure',
              art: 'timer',
              alt: 'A kitchen timer showing twenty seconds.',
              caption:
                'Twenty seconds: the minimum scrub time for handwashing.',
            },
            {
              type: 'reflection',
              id: 'rf-6-3',
              required: true,
              minLength: 20,
              prompt:
                'Which part of the standard method would be easiest to skip under time pressure, and what would you do to keep it?',
              placeholder: 'Write a few sentences…',
            },
            {
              type: 'survey',
              id: 'sv-6-3',
              prompt:
                'How confident are you that you could make a sandwich to standard for someone with a peanut allergy in the room?',
              scale: [
                { id: '1', label: 'Not confident' },
                { id: '2', label: 'Slightly' },
                { id: '3', label: 'Moderately' },
                { id: '4', label: 'Very' },
                { id: '5', label: 'Completely' },
              ],
            },
            { type: 'divider' },
            {
              type: 'attestation',
              id: 'at-6-3',
              required: true,
              requiresName: true,
              statement:
                'I have reviewed the standard method and the cross-contact rules in this sandbox course. I understand that this acknowledgement demonstrates the player and does not create a training record.',
            },
          ],
        },
      ],
    },
    {
      id: 'm7',
      title: 'Component catalog (development)',
      description:
        'Every block type once, with authoring notes. Turn on Show component notes to read the intent behind each block.',
      lessons: [
        {
          id: 'l7-1',
          title: 'Content blocks',
          summary: 'Sixteen presentational block types.',
          minutes: 3,
          blocks: [
            {
              type: 'heading',
              kicker: 'Catalog · Content',
              text: 'Heading block',
              devNote:
                'heading: level 2 (default) or 3, optional kicker. The player owns the single h1 per view.',
            },
            {
              type: 'heading',
              level: 3,
              text: 'A level-3 heading for sub-sections',
              devNote: 'heading with level: 3.',
            },
            {
              type: 'paragraph',
              variant: 'lead',
              text: 'A lead paragraph introduces a lesson in a larger size.',
              devNote: 'paragraph variant lead.',
            },
            {
              type: 'paragraph',
              text: 'A body paragraph carries most instruction. Reading width is capped at 68 characters so lines stay scannable.',
              devNote: 'paragraph default variant (body).',
            },
            {
              type: 'paragraph',
              variant: 'muted',
              text: 'A muted paragraph is for disclaimers and asides.',
              devNote: 'paragraph variant muted.',
            },
            {
              type: 'callout',
              variant: 'info',
              title: 'Info callout',
              text: 'Neutral help or context.',
              devNote: 'callout variants map to HSE semantic tokens.',
            },
            {
              type: 'callout',
              variant: 'tip',
              title: 'Tip callout',
              text: 'A practical shortcut that stays within the rules.',
            },
            {
              type: 'callout',
              variant: 'note',
              title: 'Note callout',
              text: 'Context that explains why something is here.',
            },
            {
              type: 'callout',
              variant: 'warning',
              title: 'Warning callout',
              text: 'A condition to avoid or a rule not to skip.',
            },
            {
              type: 'callout',
              variant: 'danger',
              title: 'Danger callout',
              text: 'A hazard with potential for serious harm.',
            },
            {
              type: 'callout',
              variant: 'success',
              title: 'Success callout',
              text: 'A verified good outcome.',
            },
            {
              type: 'objectives',
              title: 'Objectives block',
              items: [
                'State what the learner will be able to do.',
                'Keep each objective observable.',
              ],
              devNote:
                'objectives: checkmarked list reserved for learning outcomes.',
            },
            {
              type: 'list',
              style: 'bullet',
              title: 'Bulleted list',
              items: ['First point', 'Second point'],
              devNote: 'list styles: bullet, numbered, check.',
            },
            {
              type: 'list',
              style: 'numbered',
              title: 'Numbered list',
              items: ['First step', 'Second step'],
            },
            {
              type: 'list',
              style: 'check',
              title: 'Check list (static)',
              items: ['Criterion one', 'Criterion two'],
            },
            {
              type: 'keyTakeaways',
              title: 'Key takeaways block',
              items: [
                { title: 'One idea per card', text: 'A title and one sentence.' },
                { title: 'Three to five cards', text: 'Enough to summarize, not to re-teach.' },
              ],
              devNote: 'keyTakeaways: summary cards; good for lesson ends.',
            },
            {
              type: 'definition',
              term: 'Definition block',
              definition: 'A single term with its definition and an optional example.',
              example: 'Used when a term first appears.',
              devNote: 'definition renders as a dl with one term.',
            },
            {
              type: 'glossary',
              title: 'Glossary block',
              terms: [
                { term: 'Block', definition: 'The smallest authored unit in a lesson.' },
                { term: 'Lesson', definition: 'An ordered list of blocks with completion requirements.' },
                { term: 'Module', definition: 'A titled group of lessons.' },
              ],
              devNote: 'glossary: inline multi-term dl; the course-level glossary opens from the header.',
            },
            {
              type: 'figure',
              art: 'ingredients',
              alt: 'Two bread slices, a peanut butter jar, and a jelly jar.',
              caption: 'Figure block with caption.',
              devNote:
                'figure: inline SVG from the Illustration set; alt is required and read as the image name.',
            },
            {
              type: 'media',
              kind: 'video',
              title: 'Media block (video placeholder)',
              duration: '0:30',
              captions: true,
              transcript: ['A transcript line.', 'Another transcript line.'],
              note: 'Shows how media metadata, captions flag, and transcript render.',
              devNote:
                'media: placeholder frame; a real player would mount here with the same transcript disclosure.',
            },
            {
              type: 'steps',
              title: 'Steps block',
              steps: [
                { title: 'First', text: 'Do the first thing.' },
                { title: 'Second', text: 'Do the second thing.', caution: 'Optional caution line.' },
              ],
              devNote: 'steps: numbered procedure with optional caution per step.',
            },
            {
              type: 'timeline',
              title: 'Timeline block',
              events: [
                { label: 'Then', title: 'An earlier event', text: 'What happened first.' },
                { label: 'Now', title: 'A later event', text: 'What happened next.' },
              ],
              devNote: 'timeline: dated events; labels are free text.',
            },
            {
              type: 'table',
              caption: 'Table block',
              columns: ['Column A', 'Column B'],
              rows: [
                ['Row 1 A', 'Row 1 B'],
                ['Row 2 A', 'Row 2 B'],
              ],
              devNote: 'table: caption required; header cells use scope=col.',
            },
            {
              type: 'resource',
              title: 'Resource block',
              description: 'A downloadable or linked job aid with a format label.',
              format: 'Web page',
              href: 'https://www.fda.gov/food/retail-food-protection/fda-food-code',
              devNote: 'resource: optional href opens in a new tab; without href it renders as a placeholder.',
            },
            {
              type: 'references',
              title: 'References block',
              items: [
                {
                  label: 'CDC · About Handwashing',
                  href: 'https://www.cdc.gov/clean-hands/about/index.html',
                },
              ],
              devNote: 'references: external links with rel=noopener.',
            },
            {
              type: 'divider',
              devNote: 'divider: forces a slide break and renders nothing of its own.',
            },
          ],
        },
        {
          id: 'l7-2',
          title: 'Disclosure and activity blocks',
          summary: 'Progressive disclosure and ungraded learner activities.',
          minutes: 3,
          blocks: [
            {
              type: 'heading',
              kicker: 'Catalog · Disclosure and activity',
              text: 'Blocks that reveal or collect',
            },
            {
              type: 'accordion',
              title: 'Accordion block',
              items: [
                { title: 'Panel one', text: 'Content revealed on demand.' },
                { title: 'Panel two', text: 'Multiple panels may be open at once.' },
              ],
              devNote:
                'accordion: Base UI Accordion with multiple=true; triggers are buttons with aria-expanded.',
            },
            {
              type: 'tabs',
              title: 'Tabs block',
              tabs: [
                { label: 'Tab one', text: 'First panel.', bullets: ['Optional bullets'] },
                { label: 'Tab two', text: 'Second panel.' },
              ],
              devNote: 'tabs: tablist/tab/tabpanel with arrow-key navigation.',
            },
            {
              type: 'flashcards',
              title: 'Flashcards block',
              cards: [
                { front: 'Front of card', back: 'Back of card' },
                { front: 'Another front', back: 'Another back' },
              ],
              devNote:
                'flashcards: each card is a toggle button (aria-pressed); the visible face is announced with a Front/Back label and a reset control clears all cards.',
            },
            {
              type: 'hotspots',
              id: 'hs-7-2-demo',
              title: 'Hotspots block',
              art: 'sandwich',
              alt: 'A sandwich cut diagonally on a plate.',
              hotspots: [
                { id: 'crust', x: 34, y: 52, label: 'Crust', text: 'Spreads reach here.' },
                { id: 'filling', x: 52, y: 60, label: 'Filling', text: 'Even layers show at the cut.' },
                { id: 'plate', x: 78, y: 76, label: 'Plate', text: 'Clean and dry.' },
              ],
              devNote:
                'hotspots: positioned buttons over the illustration plus an equivalent list; coordinates are percentages.',
            },
            {
              type: 'checklist',
              id: 'cl-7-2',
              title: 'Checklist block (optional)',
              items: ['An item to tick', 'Another item'],
              devNote:
                'checklist: required=true makes every item a lesson requirement; this one is optional.',
            },
            {
              type: 'reflection',
              id: 'rf-7-2',
              prompt: 'Reflection block (optional): what did you notice?',
              placeholder: 'Free text…',
              devNote:
                'reflection: ungraded long text; minLength + required gate completion. Not graded; maps to xAPI long-fill-in.',
            },
            {
              type: 'survey',
              id: 'sv-7-2',
              prompt: 'Survey block: how clear was this catalog?',
              scale: [
                { id: '1', label: 'Unclear' },
                { id: '2', label: 'Somewhat clear' },
                { id: '3', label: 'Clear' },
              ],
              devNote: 'survey: likert scale; never a requirement; stored but not graded.',
            },
            {
              type: 'attestation',
              id: 'at-7-2',
              required: false,
              requiresName: false,
              statement:
                'Attestation block (optional): I have read this catalog lesson.',
              devNote:
                'attestation: checkbox plus optional typed name; required by default; records a timestamp.',
            },
            {
              type: 'optionSelect',
              id: 'opt-7-2-demo',
              title: 'Option selection block (select each option to continue)',
              instruction: 'Select each option to explore details without vertical scrolling:',
              required: false,
              options: [
                {
                  id: 'demo-1',
                  title: 'Option One',
                  subtitle: 'Primary feature',
                  badge: 'Interactive',
                  content: 'Clicking an option selects it, marks it as explored with a checkmark badge, and reveals its content pane.',
                  tip: 'Progress is tracked in player state to gate the slide Continue action.',
                },
                {
                  id: 'demo-2',
                  title: 'Option Two',
                  subtitle: 'No scrolling',
                  badge: 'Slide layout',
                  content: 'Consolidating multiple items into selectable cards keeps the slide on a single screen without vertical scrolling.',
                  bullets: ['Keeps text concise and scannable', 'Reinforces focused engagement per item'],
                },
              ],
              devNote:
                'optionSelect: interactive cards that track visited options and gate the slide Next button until all are reviewed.',
            },
          ],
        },
        {
          id: 'l7-3',
          title: 'Interaction blocks',
          summary: 'All nine graded interaction types, optional in this lesson.',
          minutes: 4,
          blocks: [
            {
              type: 'heading',
              kicker: 'Catalog · Interactions',
              text: 'Graded blocks',
            },
            {
              type: 'paragraph',
              variant: 'muted',
              text: 'Every interaction below is optional so this lesson can be completed without answering. In real lessons, interactions are required by default.',
            },
            {
              type: 'multipleChoice',
              id: 'cat-mc',
              required: false,
              prompt: 'Multiple choice: pick one.',
              options: [
                { id: 'a', text: 'Option A', feedback: 'Per-option feedback appears here.' },
                { id: 'b', text: 'Option B (correct)' },
                { id: 'c', text: 'Option C' },
              ],
              answer: 'b',
              devNote: 'multipleChoice → xAPI choice (single). Graded exact match.',
            },
            {
              type: 'multipleResponse',
              id: 'cat-mr',
              required: false,
              prompt: 'Multiple response: pick all that apply.',
              options: [
                { id: 'a', text: 'Correct one' },
                { id: 'b', text: 'Correct two' },
                { id: 'c', text: 'Distractor' },
              ],
              answers: ['a', 'b'],
              devNote:
                'multipleResponse → xAPI choice (multiple). Partial credit = (hits − misses) / expected, floored at 0.',
            },
            {
              type: 'trueFalse',
              id: 'cat-tf',
              required: false,
              prompt: 'True or false: this statement is true.',
              answer: true,
              devNote: 'trueFalse → xAPI true-false.',
            },
            {
              type: 'fillBlank',
              id: 'cat-fb',
              required: false,
              prompt: 'Fill in the blank.',
              text: 'The answer to this blank is ___.',
              accepted: ['blank', 'Blank'],
              devNote:
                'fillBlank → xAPI fill-in. Whitespace collapsed; case-insensitive unless caseSensitive.',
            },
            {
              type: 'numeric',
              id: 'cat-num',
              required: false,
              prompt: 'Numeric: enter a number between 1 and 10.',
              min: 1,
              max: 10,
              devNote: 'numeric → xAPI numeric with min[:]max range.',
            },
            {
              type: 'matching',
              id: 'cat-match',
              required: false,
              prompt: 'Matching: pair each left item with the right one.',
              pairs: [
                { id: 'p1', left: 'Left one', right: 'Right one' },
                { id: 'p2', left: 'Left two', right: 'Right two' },
                { id: 'p3', left: 'Left three', right: 'Right three' },
              ],
              devNote:
                'matching → xAPI matching. Select per left item (no dragging); partial credit by pairs.',
            },
            {
              type: 'sequencing',
              id: 'cat-seq',
              required: false,
              prompt: 'Sequencing: put the items in order.',
              items: [
                { id: 'a', text: 'First' },
                { id: 'b', text: 'Second' },
                { id: 'c', text: 'Third' },
              ],
              devNote:
                'sequencing → xAPI sequencing. Move up/down buttons satisfy WCAG 2.5.7; partial credit by position.',
            },
            {
              type: 'sorting',
              id: 'cat-sort',
              required: false,
              prompt: 'Sorting: assign each item to a category.',
              categories: [
                { id: 'x', label: 'Category X' },
                { id: 'y', label: 'Category Y' },
              ],
              items: [
                { id: 'i1', text: 'Belongs to X', category: 'x' },
                { id: 'i2', text: 'Belongs to Y', category: 'y' },
              ],
              devNote:
                'sorting → xAPI matching (item→category). Select per item; partial credit by item.',
            },
            {
              type: 'scenario',
              id: 'cat-scn',
              required: false,
              prompt: 'Scenario: choose a response.',
              situation: 'A short situation sets up the decision.',
              options: [
                { id: 'a', text: 'A weak response', outcome: 'What happens if you choose this.', correct: false },
                { id: 'b', text: 'The best response', outcome: 'The consequence of the best choice.', correct: true },
              ],
              devNote:
                'scenario → xAPI choice with branching outcome text per option.',
            },
          ],
        },
      ],
    },
  ],
  assessment: {
    id: 'pbj-final',
    title: 'Final knowledge check',
    intro:
      'Twelve questions drawn from every module. You need 80% to pass and have three attempts. Questions are shuffled for each attempt, and feedback is shown after you submit.',
    passingPercent: 80,
    maxAttempts: 3,
    shuffleQuestions: true,
    questions: [
      {
        type: 'multipleChoice',
        id: 'fa-1',
        prompt: 'What is the first step of the standard method?',
        options: [
          { id: 'a', text: 'Lay out the bread' },
          { id: 'b', text: 'Gather and inspect' },
          { id: 'c', text: 'Spread the peanut butter' },
        ],
        answer: 'b',
        explanation: 'Inspection comes first so a label problem stops work early.',
      },
      {
        type: 'multipleChoice',
        id: 'fa-2',
        prompt: 'Which practice prevents cross-contact between the two jars?',
        options: [
          { id: 'a', text: 'Wiping the spreader on the bread between jars' },
          { id: 'b', text: 'A dedicated spreader for each jar' },
          { id: 'c', text: 'Using the knife for both spreads' },
        ],
        answer: 'b',
        explanation: 'One utensil per jar is the rule.',
      },
      {
        type: 'multipleChoice',
        id: 'fa-3',
        prompt: 'In the barrier method, where does the fruit spread go?',
        options: [
          { id: 'a', text: 'Directly on an untreated slice' },
          { id: 'b', text: 'Between two slices that each have a thin peanut butter layer' },
          { id: 'c', text: 'On the outside of the sandwich' },
        ],
        answer: 'b',
        explanation: 'Peanut butter on both slices slows moisture into the bread.',
      },
      {
        type: 'multipleResponse',
        id: 'fa-4',
        prompt: 'Select every item that is one of the nine major U.S. food allergens.',
        options: [
          { id: 'peanut', text: 'Peanuts' },
          { id: 'sesame', text: 'Sesame' },
          { id: 'apple', text: 'Apples' },
          { id: 'wheat', text: 'Wheat' },
          { id: 'rice', text: 'Rice' },
        ],
        answers: ['peanut', 'sesame', 'wheat'],
        explanation: 'Peanuts, sesame, and wheat are major allergens; apples and rice are not.',
      },
      {
        type: 'trueFalse',
        id: 'fa-5',
        prompt: 'A spreader that touched bread may be returned to the jar if it looks clean.',
        answer: false,
        explanation: 'Looking clean is not the standard; a utensil that touched bread or another spread never returns to a jar.',
      },
      {
        type: 'trueFalse',
        id: 'fa-6',
        prompt: 'Hands should be washed before, during, and after preparing food.',
        answer: true,
        explanation: 'This is one of the key times to wash identified by CDC.',
      },
      {
        type: 'fillBlank',
        id: 'fa-7',
        prompt: 'Complete the handwashing rule.',
        text: 'Scrub your hands for at least ___ seconds.',
        accepted: ['20', 'twenty'],
        explanation: 'At least 20 seconds.',
      },
      {
        type: 'numeric',
        id: 'fa-8',
        prompt: 'What is the minimum alcohol percentage CDC recommends for hand sanitizer when soap and water are not available?',
        min: 60,
        max: 100,
        unit: '%',
        explanation: 'At least 60% alcohol.',
      },
      {
        type: 'matching',
        id: 'fa-9',
        prompt: 'Match each spread to what it is made from.',
        pairs: [
          { id: 'jelly', left: 'Jelly', right: 'Strained fruit juice' },
          { id: 'jam', left: 'Jam', right: 'Crushed fruit' },
          { id: 'preserves', left: 'Preserves', right: 'Whole or large fruit pieces' },
        ],
        explanation: 'Jelly is juice, jam is crushed fruit, preserves keep pieces.',
      },
      {
        type: 'sequencing',
        id: 'fa-10',
        prompt: 'Order the first five steps of the standard method.',
        items: [
          { id: 'a', text: 'Gather and inspect' },
          { id: 'b', text: 'Lay out the bread' },
          { id: 'c', text: 'Spread the peanut butter' },
          { id: 'd', text: 'Spread the fruit spread' },
          { id: 'e', text: 'Close and press lightly' },
        ],
        explanation: 'Inspect, lay out, peanut butter, fruit spread, close.',
      },
      {
        type: 'sorting',
        id: 'fa-11',
        prompt: 'Sort each knife practice.',
        categories: [
          { id: 'do', label: 'Do' },
          { id: 'dont', label: 'Do not' },
        ],
        items: [
          { id: 'k1', text: 'Cut with the blade moving away from your hand', category: 'do' },
          { id: 'k2', text: 'Hold the sandwich in your palm while cutting', category: 'dont' },
          { id: 'k3', text: 'Leave the knife in a sink of soapy water', category: 'dont' },
          { id: 'k4', text: 'Set the knife down flat, blade away from the edge', category: 'do' },
        ],
        explanation: 'Blade away from your hand and set down flat; never palm-cut or hide a knife in dishwater.',
      },
      {
        type: 'scenario',
        id: 'fa-12',
        prompt: 'Choose the best action.',
        situation:
          'The label on the open jelly jar is smeared and unreadable. A sealed jar with a clear label is in storage.',
        options: [
          {
            id: 'a',
            text: 'Use the open jar; it is probably the same product.',
            outcome: 'An unreadable label means the allergen information is unknown. Probably is not good enough.',
            correct: false,
          },
          {
            id: 'b',
            text: 'Set the unreadable jar aside per procedure and open the sealed, labeled jar.',
            outcome: 'Correct. Known ingredients and a readable label come first.',
            correct: true,
          },
          {
            id: 'c',
            text: 'Taste the jelly to confirm what it is.',
            outcome: 'Tasting cannot reveal allergens or ingredients, and it contaminates the jar.',
            correct: false,
          },
        ],
      },
    ],
  },
  glossary: [
    { term: 'Allergen', definition: 'A food protein that can trigger an immune reaction in some people.' },
    { term: 'Barrier method', definition: 'A thin peanut butter layer on both slices with the fruit spread between them, to slow moisture into the bread.' },
    { term: 'Cross-contact', definition: 'Unintentional transfer of an allergen from one food or surface to another.' },
    { term: 'Dedicated utensil', definition: 'A spreader used in only one jar during preparation.' },
    { term: 'Edge-to-edge', definition: 'Spreading so the layer reaches the crust on all sides.' },
    { term: 'Jam', definition: 'A fruit spread made from crushed or puréed fruit.' },
    { term: 'Jelly', definition: 'A smooth fruit spread made from strained fruit juice set with pectin.' },
    { term: 'Pectin', definition: 'A natural fruit fiber that helps jelly and jam set.' },
    { term: 'Preserves', definition: 'A fruit spread that keeps whole or large pieces of fruit.' },
    { term: 'Sanitize', definition: 'Reduce microorganisms on a cleaned surface with a food-safe sanitizer at the labeled concentration and contact time.' },
  ],
  references: [
    { label: 'CDC · About Handwashing', href: 'https://www.cdc.gov/clean-hands/about/index.html' },
    { label: 'FDA · Food Allergies', href: 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies' },
    { label: 'FDA · Food Code 2026', href: 'https://www.fda.gov/food/fda-food-code/food-code-2026' },
    { label: 'ADL · xAPI interaction activities (Appendix C)', href: 'https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md' },
    { label: 'W3C · WCAG 2.2 Understanding 2.5.7 Dragging Movements', href: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html' },
    { label: 'W3C · WCAG 2.2 Understanding 4.1.3 Status Messages', href: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html' },
    { label: 'H5P · Content types', href: 'https://h5p.org/content-types-and-applications' },
  ],
  completionStatement:
    'You have finished the sandbox course and passed its knowledge check. This demonstrates the player and component library. It does not create a training record, satisfy any workplace requirement, or authorize any task.',
  boundary:
    'PBJ-101 is a development sandbox with fictional context. It is not part of the HSE Informer course library, is not assigned to learners, and stores progress only in this browser.',
};

/**
 * Learner-facing practice course. The lab keeps author notes and placeholder
 * media; this version contains only complete, usable learning material.
 */
export const pbjCourse: Course = {
  ...pbjComponentLabCourse,
  id: 'pbj-101',
  code: 'PBJ-101',
  version: '1.0.0-preview',
  subtitle: 'A clear method, from ingredient check to final cleanup.',
  audience: 'Anyone exploring the HSE Informer learning experience',
  purpose:
    'Practice preparing a consistent sandwich while learning how to handle ingredients, check labels, use separate utensils, and leave a clean station.',
  objectives: [
    'Describe the quality criteria for a finished sandwich.',
    'Identify cross-contact risks and use a separate utensil for each jar.',
    'Follow the handwashing and station setup steps in the course.',
    'Prepare a sandwich using the seven-step standard method.',
    'Check the result, choose a serving method, and reset the station.',
  ],
  modules: pbjComponentLabCourse.modules.slice(0, 6).map((module) => ({
    ...module,
    description: module.id === 'm1' ? 'Meet the finished standard and learn how to use this practice course.' : module.id === 'm2' ? 'Understand the preparation flow and choose ingredients with care.' : module.description,
    lessons: module.lessons.map((lesson) => {
      if (lesson.id === 'l1-1')
        return {
          ...lesson,
          title: 'Welcome and course guide',
          summary: 'What you will make, how lessons work, and where to begin.',
          blocks: [
            { type: 'heading', kicker: 'Module 1 · Orientation', text: 'A simple task, done with care' },
            { type: 'paragraph', variant: 'lead', text: 'A good peanut butter and jelly sandwich depends on more than spreading two ingredients. You will check ingredients, prepare a clean station, keep utensils separate, and work through a repeatable seven-step method.' },
            { type: 'figure', art: 'sandwich', alt: 'A finished peanut butter and jelly sandwich cut diagonally on a plate.', caption: 'The goal: even coverage, a clean exterior, and careful handling.' },
            {
              type: 'optionSelect',
              id: 'act-1-1-guide',
              title: 'How this course works',
              instruction: 'Select each option below to learn how the practice player operates:',
              required: false,
              options: [
                {
                  id: 'gd-lessons',
                  title: 'Lessons',
                  subtitle: 'One idea at a time',
                  badge: 'Structure',
                  content: 'Work through the lessons in order using Continue or the course outline. Each slide focuses on one idea before you move to the next.',
                  tip: 'Your progress is automatically preserved in this browser.',
                },
                {
                  id: 'gd-checks',
                  title: 'Knowledge checks',
                  subtitle: 'Feedback and retry',
                  badge: 'Feedback',
                  content: 'Answer each short check and review the feedback. If you miss one, select Try again to clear your answer and choose again.',
                },
                {
                  id: 'gd-activities',
                  title: 'Interactive options',
                  subtitle: 'Select each option to continue',
                  badge: 'Engagement',
                  content: 'When a slide contains multiple topics, select each option card to review the content. Reviewing all options unlocks the Next button.',
                },
                {
                  id: 'gd-assessment',
                  title: 'Assessment',
                  subtitle: 'Final practice review',
                  badge: 'Summary',
                  content: 'Finish with the final knowledge assessment and review your summary. Progress is saved locally in this browser without creating a formal record.',
                },
              ],
            },
            { type: 'multipleChoice', id: 'q-1-1-complete', prompt: 'What should you do before you begin preparing a sandwich?', options: [{ id: 'a', text: 'Set out the ingredients without checking their labels.' }, { id: 'b', text: 'Check the ingredients and prepare a clean station.' }, { id: 'c', text: 'Use one spreader for both jars to save time.' }], answer: 'b', explanation: 'Checking ingredients and preparing a clean station come before spreading.' },
          ],
        };
      if (lesson.id === 'l1-2')
        return {
          ...lesson,
          title: 'What a good sandwich looks like',
          summary: 'The five quality criteria the whole course builds toward.',
          blocks: [
            { type: 'heading', kicker: 'Module 1 · Orientation', text: 'The standard we are aiming for' },
            { type: 'paragraph', variant: 'lead', text: 'Before learning the procedure, agree on the result. A well-made sandwich is consistent, tidy, and safe to eat.' },
            { type: 'figure', art: 'sandwich', alt: 'A finished peanut butter and jelly sandwich cut diagonally on a plate.', caption: 'Inspect your sandwich against these five criteria before serving.' },
            {
              type: 'optionSelect',
              id: 'act-1-2-criteria',
              title: 'Five Quality Criteria',
              instruction: 'Select each criterion to review what a finished sandwich must meet:',
              options: [
                {
                  id: 'cr-edge',
                  title: 'Edge-to-edge coverage',
                  subtitle: 'Consistent taste',
                  badge: 'Visual check',
                  content: 'Both spreads reach all the way to the crust so every single bite tastes the same.',
                  tip: 'Spread gently toward corners without tearing the bread.',
                },
                {
                  id: 'cr-ratio',
                  title: 'Balanced ratio',
                  subtitle: 'Equal visual amounts',
                  badge: 'Flavor balance',
                  content: 'Peanut butter and fruit spread are present in roughly equal visual amounts; neither overwhelms the bread.',
                  bullets: ['Peanut butter gives richness and protein.', 'Fruit spread balances with sweetness.'],
                },
                {
                  id: 'cr-exterior',
                  title: 'Dry exterior',
                  subtitle: 'Clean to hold',
                  badge: 'Texture',
                  content: 'No spread leaks past the edges, and the outside of the bread stays clean and dry.',
                  caution: 'Overfilling spreads near the edge causes spillage when cut.',
                },
                {
                  id: 'cr-cut',
                  title: 'Clean cut',
                  subtitle: 'Tidy halves',
                  badge: 'Presentation',
                  content: 'If cut, the halves are even and the filling stays neatly inside without bread squishing.',
                  tip: 'Use a gentle sawing motion with a clean blade.',
                },
                {
                  id: 'cr-safety',
                  title: 'Safe handling',
                  subtitle: 'Hygiene & allergen care',
                  badge: 'Food safety',
                  content: 'Clean hands, clean sanitized tools, and separate utensils for each jar to eliminate cross-contact.',
                  caution: 'Never dip a peanut butter spreader into a shared jelly jar.',
                },
              ],
            },
            { type: 'trueFalse', id: 'q-1-2-edges', prompt: 'Is it acceptable for peanut butter to leak past the crust if the bread is cut?', answer: false, explanation: 'The exterior of the bread should remain clean and dry.' },
          ],
        };
      if (lesson.id === 'l2-1')
        return {
          ...lesson,
          title: 'The preparation flow',
          summary: 'See how the work moves from ingredient check to a clean station.',
          blocks: [
            { type: 'heading', kicker: 'Module 2 · Foundations', text: 'See the whole task first' },
            { type: 'paragraph', variant: 'lead', text: 'A reliable result follows the same broad flow each time. The later lessons give you the details and the chance to practice.' },
            {
              type: 'optionSelect',
              id: 'act-2-1-phases',
              title: 'Five Phases of Preparation',
              instruction: 'Select each phase to understand the standard workflow:',
              options: [
                {
                  id: 'ph-check',
                  title: '1. Check',
                  subtitle: 'Recipient & labels',
                  badge: 'Safety',
                  content: 'Confirm who will eat the sandwich and check every ingredient label for dietary restrictions and allergens before opening jars.',
                  tip: 'Always verify peanut and gluten sensitivities first.',
                },
                {
                  id: 'ph-setup',
                  title: '2. Set Up',
                  subtitle: 'Clean station & tools',
                  badge: 'Hygiene',
                  content: 'Wash hands thoroughly with soap and water. Clean the preparation surface and set out separate spreaders for each jar.',
                  caution: 'Do not share utensils between spread jars.',
                },
                {
                  id: 'ph-assemble',
                  title: '3. Assemble',
                  subtitle: 'Spread & join',
                  badge: 'Method',
                  content: 'Spread peanut butter on one slice and fruit spread on the other. Bring the slices together and cut diagonally if requested.',
                  bullets: ['One spread per slice.', 'Bring edges together evenly.'],
                },
                {
                  id: 'ph-inspect',
                  title: '4. Inspect',
                  subtitle: 'Quality criteria check',
                  badge: 'Quality',
                  content: 'Check for even coverage, clean exterior bread crust, and proper ratio before plating or packing.',
                  tip: 'Wipe any drips off the crust before serving.',
                },
                {
                  id: 'ph-reset',
                  title: '5. Reset',
                  subtitle: 'Station cleanup',
                  badge: 'Reset',
                  content: 'Seal jar lids tightly, wash used knives and spreaders immediately, and sanitize the counter surface for the next use.',
                },
              ],
            },
            { type: 'callout', variant: 'tip', title: 'A pause is part of the method', text: 'If a label, ingredient, or recipient need is uncertain, stop and resolve it before preparing or serving the sandwich.' },
            { type: 'multipleChoice', id: 'q-2-1-flow', required: false, prompt: 'What comes before assembling the sandwich?', options: [{ id: 'a', text: 'Checking ingredients and setting up the station.' }, { id: 'b', text: 'Wrapping the finished sandwich.' }, { id: 'c', text: 'Cleaning the station for the next task.' }], answer: 'a', explanation: 'Check ingredients and set up a clean station before assembly.' },
          ],
        };
      if (lesson.id === 'l2-2')
        return {
          ...lesson,
          title: 'Ingredients and label check',
          summary: 'Bread, peanut butter, and fruit spreads—and their allergens.',
          blocks: [
            { type: 'heading', kicker: 'Module 2 · Foundations', text: 'Three ingredients, many choices' },
            { type: 'paragraph', variant: 'lead', text: 'Bread, peanut butter, and a fruit spread. Each has variations that change the result and, more importantly, the allergen profile.' },
            {
              type: 'optionSelect',
              id: 'act-2-2-ingredients',
              title: 'Three Ingredient Families',
              instruction: 'Select each ingredient family to explore its characteristics and allergens:',
              options: [
                {
                  id: 'ing-bread',
                  title: 'Bread',
                  subtitle: 'Foundation & structure',
                  badge: 'Wheat allergen',
                  content: 'Sandwich bread provides structure. Wheat is a major allergen; some breads also contain milk, eggs, soy, or sesame.',
                  bullets: ['Check the label for wheat and allergens.', 'Use slices from the same loaf so halves match.'],
                  tip: 'Day-old bread resists sogginess better than very fresh bread.',
                },
                {
                  id: 'ing-pb',
                  title: 'Peanut Butter',
                  subtitle: 'Richness & protein',
                  badge: 'Major allergen',
                  content: 'Ground roasted peanuts with oils and salt. Peanuts are a severe allergen; shared tools must be avoided.',
                  bullets: ['Smooth spreads easily; crunchy can tear soft bread.', 'Stir natural peanut butter until uniform.'],
                  caution: 'Never use shared utensils if someone has a peanut allergy.',
                },
                {
                  id: 'ing-fruit',
                  title: 'Fruit Spread',
                  subtitle: 'Sweetness & moisture',
                  badge: 'Jelly / Jam',
                  content: 'Jelly uses strained juice and is smooth. Jam uses crushed fruit. Preserves keep whole chunks.',
                  bullets: ['Jelly spreads smoothly.', 'Refrigerate after opening when required.'],
                  tip: 'Room temperature jelly spreads more evenly than chilled jelly.',
                },
              ],
            },
            { type: 'multipleResponse', id: 'q-2-2-allergens', prompt: 'Which of these ingredients are among the nine major food allergens recognized by the U.S. FDA?', options: [{ id: 'peanut', text: 'Peanuts' }, { id: 'wheat', text: 'Wheat' }, { id: 'grape', text: 'Grapes' }, { id: 'milk', text: 'Milk' }, { id: 'strawberry', text: 'Strawberries' }], answers: ['peanut', 'wheat', 'milk'], explanation: 'The nine major allergens are milk, eggs, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans, and sesame.' },
          ],
        };
      if (lesson.id === 'l3-1')
        return {
          ...lesson,
          title: 'Cross-contact and allergens',
          summary: 'The nine major allergens and how cross-contact happens.',
          blocks: [
            { type: 'heading', kicker: 'Module 3 · Safety and hygiene', text: 'Allergens and cross-contact' },
            { type: 'callout', variant: 'danger', title: 'Peanuts are a major allergen', text: 'Peanuts, tree nuts, wheat, milk, eggs, soybeans, sesame, fish, and shellfish are the nine major allergens. Reactions range from mild to life-threatening. Always know who will eat the food.' },
            {
              type: 'optionSelect',
              id: 'act-3-1-rules',
              title: 'Five Rules to Prevent Cross-Contact',
              instruction: 'Select each rule below to understand food safety standards:',
              options: [
                {
                  id: 'rl-utensil',
                  title: 'Dedicated utensils',
                  subtitle: 'One jar, one spreader',
                  badge: 'Crucial rule',
                  content: 'Always use a separate, clean utensil for each jar. Labeled handles make the dedicated-utensil rule visible.',
                  caution: 'Never dip a peanut butter spreader into a jelly jar.',
                },
                {
                  id: 'rl-nodouble',
                  title: 'No return dipping',
                  subtitle: 'Protect jar contents',
                  badge: 'Jar protection',
                  content: 'Never return a utensil that touched bread or another spread back into a jar. Once it touches bread, it is contaminated.',
                },
                {
                  id: 'rl-sanitize',
                  title: 'Clean & sanitize',
                  subtitle: 'Surfaces between uses',
                  badge: 'Sanitation',
                  content: 'Clean and sanitize the surface and board between sandwiches made for different people.',
                  tip: 'Allow sanitizer to air dry according to contact time.',
                },
                {
                  id: 'rl-storage',
                  title: 'Separate storage',
                  subtitle: 'Pantry isolation',
                  badge: 'Storage',
                  content: 'Keep peanut products in their own labeled container or dedicated area where required by kitchen policy.',
                },
                {
                  id: 'rl-labels',
                  title: 'Read every label',
                  subtitle: 'Check every time',
                  badge: 'Inspection',
                  content: 'Read every label each time you prepare food. Recipes and suppliers change without warning.',
                },
              ],
            },
            { type: 'sorting', id: 'q-3-1-sort', prompt: 'Sort each practice as a cross-contact risk or a safe practice.', categories: [{ id: 'risk', label: 'Cross-contact risk' }, { id: 'safe', label: 'Safe practice' }], items: [{ id: 's1', text: 'Dipping the peanut butter spreader into the jelly jar', category: 'risk' }, { id: 's2', text: 'Using two labeled spreaders', category: 'safe' }, { id: 's3', text: 'Wiping the board with the towel used on the peanut butter lid', category: 'risk' }, { id: 's4', text: 'Washing hands before making a sandwich for someone with an allergy', category: 'safe' }, { id: 's5', text: 'Reading the bread label before each service', category: 'safe' }] },
            { type: 'multipleChoice', id: 'q-3-1-label', prompt: 'A new case of bread arrives from a different supplier. What should happen before it is used?', options: [{ id: 'a', text: 'Nothing; bread is bread.' }, { id: 'b', text: 'Read the ingredient and allergen label, because formulations differ between suppliers.', feedback: 'Correct. Labels change with suppliers and recipes.' }, { id: 'c', text: 'Taste a slice to check quality.' }], answer: 'b', explanation: 'Formulations differ between suppliers, so the label is read before first use.' },
          ],
        };
      if (lesson.id === 'l3-2')
        return {
          ...lesson,
          title: 'Handwashing protocol',
          summary: 'The five handwashing steps and the key times to wash.',
          blocks: [
            { type: 'heading', kicker: 'Module 3 · Safety and hygiene', text: 'Clean hands before clean food' },
            { type: 'figure', art: 'handwash', alt: 'Hands being washed under a running tap with soap lather.', caption: 'Wet, lather, scrub, rinse, dry.' },
            {
              type: 'optionSelect',
              id: 'act-3-2-wash',
              title: 'The Five Handwashing Steps',
              instruction: 'Select each step to review proper CDC hand hygiene:',
              options: [
                {
                  id: 'hw-wet',
                  title: '1. Wet',
                  subtitle: 'Clean running water',
                  badge: 'Prep',
                  content: 'Wet your hands with clean, running water, turn off the tap, and apply soap.',
                },
                {
                  id: 'hw-lather',
                  title: '2. Lather',
                  subtitle: 'Backs & fingers',
                  badge: 'Coverage',
                  content: 'Rub hands together with soap. Lather the backs of hands, between fingers, and under nails.',
                  tip: 'Pay special attention to thumbs and fingertips.',
                },
                {
                  id: 'hw-scrub',
                  title: '3. Scrub',
                  subtitle: 'At least 20 seconds',
                  badge: 'Friction',
                  content: 'Scrub your hands for at least 20 seconds—about the time it takes to hum "Happy Birthday" twice.',
                  caution: 'Scrubbing with friction is what actually removes microbes and oils.',
                },
                {
                  id: 'hw-rinse',
                  title: '4. Rinse',
                  subtitle: 'Running water',
                  badge: 'Rinse',
                  content: 'Rinse hands thoroughly under clean, running water until all soap residue is washed away.',
                },
                {
                  id: 'hw-dry',
                  title: '5. Dry',
                  subtitle: 'Clean towel',
                  badge: 'Finish',
                  content: 'Dry hands completely using a clean cloth towel or single-use paper towel. Damp hands transfer bacteria more easily.',
                },
              ],
            },
            { type: 'callout', variant: 'tip', title: 'Wash before preparing food', text: 'Pause food preparation if you cannot wash your hands with soap and water. Hand sanitizer does not replace handwashing for food preparation.' },
            { type: 'numeric', id: 'q-3-2-seconds', prompt: 'What is the minimum number of seconds CDC recommends scrubbing your hands?', min: 20, max: 20, explanation: 'CDC recommends scrubbing for at least 20 seconds. Longer is fine.' },
            { type: 'trueFalse', id: 'q-3-2-sanitizer', prompt: 'Hand sanitizer works just as well as soap and water on hands that are greasy from food preparation.', answer: false, explanation: 'Hand sanitizer does not replace handwashing for food preparation. Wash with soap and water before resuming the task.' },
          ],
        };
      if (lesson.id === 'l4-2')
        return {
          ...lesson,
          title: 'Tool selection and care',
          summary: 'Keeping utensils, boards, and jars ready and safe.',
          blocks: [
            { type: 'heading', kicker: 'Module 4 · Workspace and equipment', text: 'Caring for tools and ingredients' },
            { type: 'figure', art: 'storage', alt: 'Pantry shelf holding unopened peanut butter jar and refrigerator holding opened jelly jar.', caption: 'Follow the label: many fruit spreads require refrigeration after opening.' },
            {
              type: 'optionSelect',
              id: 'act-4-2-tools',
              title: 'Tool Care and Maintenance',
              instruction: 'Select each equipment type to review care guidelines:',
              options: [
                {
                  id: 'tc-spreaders',
                  title: 'Spreaders & Knives',
                  subtitle: 'Dedicated & sanitized',
                  badge: 'Utensils',
                  content: 'Wash in hot soapy water after each service, rinse, and air-dry. Immediately replace any spreaders with cracked handles.',
                  tip: 'Keep two dedicated spreaders labeled for each spread.',
                },
                {
                  id: 'tc-boards',
                  title: 'Cutting Boards',
                  subtitle: 'Clean, flat surface',
                  badge: 'Prep surface',
                  content: 'Wash, sanitize, and store on edge so both faces dry thoroughly. Retire boards that have deep knife scoring.',
                  caution: 'Deep grooves in plastic or wood boards harbor bacteria and allergens.',
                },
                {
                  id: 'tc-towels',
                  title: 'Towels & Wipes',
                  subtitle: 'Hand vs surface',
                  badge: 'Hygiene',
                  content: 'Hand towels are changed at least daily and whenever damp or soiled. Food spills must use disposable towels only.',
                },
                {
                  id: 'tc-jars',
                  title: 'Jars & Lids',
                  subtitle: 'Tight seals',
                  badge: 'Storage',
                  content: 'Wipe threads and lids before closing. Residue on threads prevents a tight seal and attracts contamination.',
                  tip: 'Mark the date opened on the jar lid with a marker.',
                },
              ],
            },
            { type: 'matching', id: 'q-4-2-tools', prompt: 'Match each tool to its purpose.', pairs: [{ id: 'm1', left: 'Labeled spreader', right: 'Apply one spread from one jar' }, { id: 'm2', left: 'Table knife', right: 'Cut the closed sandwich' }, { id: 'm3', left: 'Surface sanitizer', right: 'Treat the cleaned board before use' }, { id: 'm4', left: 'Disposable towel', right: 'Wipe spills without recontaminating hand towels' }] },
          ],
        };
      if (lesson.id === 'l5-1')
        return {
          ...lesson,
          title: 'The standard seven-step method',
          summary: 'The repeatable seven-step method with cautions and quality points.',
          blocks: [
            { type: 'heading', kicker: 'Module 5 · Procedure', text: 'Seven steps, every time' },
            { type: 'figure', art: 'ingredients', alt: 'Two bread slices, peanut butter jar, and jelly jar arranged in a row.', caption: 'The standard method creates a consistent, clean sandwich.' },
            {
              type: 'optionSelect',
              id: 'act-5-1-steps',
              title: 'The Seven-Step Standard Method',
              instruction: 'Select each step below to learn the preparation procedure:',
              options: [
                {
                  id: 'st-1',
                  title: '1. Gather & Inspect',
                  subtitle: 'Hands, labels, dates',
                  badge: 'Prep',
                  content: 'Wash hands, verify the clean workstation, and check each label and expiration date.',
                  caution: 'Stop immediately if any label indicates an allergen the recipient must avoid.',
                },
                {
                  id: 'st-2',
                  title: '2. Lay Out Bread',
                  subtitle: 'Matching slices',
                  badge: 'Staging',
                  content: 'Place two matching slices side by side on the clean board with crust edges aligned.',
                  tip: 'Matched slices ensure symmetrical halves when cut.',
                },
                {
                  id: 'st-3',
                  title: '3. Spread PB',
                  subtitle: 'Center outward',
                  badge: 'First spread',
                  content: 'With the dedicated peanut butter spreader, place two tablespoons in the center of the left slice and work outward to edges in smooth, overlapping strokes.',
                  caution: 'Light pressure; soft bread tears under force.',
                },
                {
                  id: 'st-4',
                  title: '4. Spread Jelly',
                  subtitle: 'Second slice',
                  badge: 'Second spread',
                  content: 'With the second clean spreader, apply one tablespoon of fruit spread to the right slice in an even, thinner layer.',
                  tip: 'Keep spread 1/8 inch inside the crust to prevent squeeze-out.',
                },
                {
                  id: 'st-5',
                  title: '5. Close',
                  subtitle: 'Align & seal',
                  badge: 'Assembly',
                  content: 'Lift the fruit-spread slice and lay it spread-side down onto the peanut butter slice. Press lightly across the surface to seal.',
                },
                {
                  id: 'st-6',
                  title: '6. Cut If Requested',
                  subtitle: 'Gentle diagonal',
                  badge: 'Finish cut',
                  content: 'One smooth diagonal or straight cut with the table knife, blade moving away from your fingers.',
                  tip: 'Wipe the knife blade clean between sandwiches.',
                },
                {
                  id: 'st-7',
                  title: '7. Plate or Wrap & Reset',
                  subtitle: 'Service & cleanup',
                  badge: 'Reset',
                  content: 'Plate cut-side up for immediate service, or wrap tightly for holding. Return lids, store jars, and sanitize the station.',
                },
              ],
            },
            { type: 'sequencing', id: 'q-5-1-order', prompt: 'Put the standard method in order.', items: [{ id: 'o1', text: 'Gather and inspect' }, { id: 'o2', text: 'Lay out the bread' }, { id: 'o3', text: 'Spread the peanut butter' }, { id: 'o4', text: 'Spread the fruit spread' }, { id: 'o5', text: 'Close and press lightly' }, { id: 'o6', text: 'Cut if requested' }, { id: 'o7', text: 'Plate or wrap and reset' }], explanation: 'Inspection comes first so a label problem stops work before any spreading.' },
            { type: 'fillBlank', id: 'q-5-1-utensil', prompt: 'Complete the rule.', text: 'Use a ___ spreader for each jar so no spread travels between them.', accepted: ['separate', 'dedicated', 'clean', 'different', 'second'], explanation: 'Any wording that means one utensil per jar is accepted.' },
          ],
        };
      if (lesson.id === 'l5-2')
        return {
          ...lesson,
          title: 'Inspecting the result',
          summary: 'Technique, thin fruit spread, and the barrier method.',
          blocks: [
            { type: 'heading', kicker: 'Module 5 · Procedure', text: 'Technique and the soggy-bread problem' },
            { type: 'paragraph', variant: 'lead', text: 'Good technique prevents bread tears and sogginess. Explore the three key spreading strategies below:' },
            {
              type: 'optionSelect',
              id: 'act-5-2-technique',
              title: 'Three Spreading Strategies',
              instruction: 'Select each strategy to understand when and how to apply it:',
              options: [
                {
                  id: 'sq-pb',
                  title: 'Peanut Butter Technique',
                  subtitle: 'Center-outward strokes',
                  badge: 'Base layer',
                  content: 'Start in the center and push outward in overlapping strokes. Rotate the slice rather than reaching across it. Target thickness: coin height.',
                  tip: 'Scrape the spreader clean on the slice, not on the jar rim.',
                },
                {
                  id: 'sq-jelly',
                  title: 'Fruit Spread Technique',
                  subtitle: 'Thin, even layer',
                  badge: 'Moisture control',
                  content: 'Use less than you think. A thin, even layer tastes brighter and leaks less. Jelly slides on peanut butter; always spread it on its own slice.',
                },
                {
                  id: 'sq-barrier',
                  title: 'Barrier Method',
                  subtitle: 'For packed lunches',
                  badge: 'Anti-sogginess',
                  content: 'For sandwiches eaten later, spread a thin peanut butter layer on BOTH slices and place the fruit spread between them. The fat in the peanut butter blocks moisture from reaching the bread.',
                  tip: 'Essential for lunchboxes or make-ahead sandwiches.',
                },
              ],
            },
            { type: 'numeric', id: 'q-5-2-tbsp', prompt: 'About how many tablespoons of peanut butter does the standard method use on one slice?', min: 1, max: 3, unit: 'tablespoons', explanation: 'The standard method calls for about two tablespoons; one to three is acceptable depending on bread size.' },
            { type: 'scenario', id: 'q-5-2-soggy', prompt: 'Choose the best approach.', situation: 'A sandwich is being made at 7 a.m. for a lunch eaten at noon. The recipient dislikes soggy bread.', options: [{ id: 'a', text: 'Spread jelly directly on one slice as usual and wrap it.', outcome: 'Five hours is long enough for jelly moisture to soak into untreated bread.', correct: false }, { id: 'b', text: 'Spread a thin peanut butter layer on both slices and put the jelly between them.', outcome: 'The barrier method keeps the bread drier for hours.', correct: true }, { id: 'c', text: 'Use extra jelly so the flavor survives the wait.', outcome: 'More jelly means more moisture and a soggier sandwich.', correct: false }, { id: 'd', text: 'Toast the bread first.', outcome: 'Toasting changes texture and does not prevent moisture absorption during holding.', correct: false }] },
          ],
        };
      if (lesson.id === 'l6-1')
        return {
          ...lesson,
          title: 'Serving, packing, and holding',
          summary: 'The final inspection and service standards.',
          blocks: [
            { type: 'heading', kicker: 'Module 6 · Quality, service, and cleanup', text: 'Check before you serve' },
            {
              type: 'optionSelect',
              id: 'act-6-1-check',
              title: 'Final Quality Gate',
              instruction: 'Select each inspection checkpoint before serving:',
              options: [
                {
                  id: 'qc-coverage',
                  title: 'Edge Coverage',
                  subtitle: 'Even bite',
                  badge: 'Inspection',
                  content: 'Verify both spreads reach all four edges and corners so the recipient gets balanced flavor in every bite.',
                },
                {
                  id: 'qc-exterior',
                  title: 'Clean Crust',
                  subtitle: 'Dry to handle',
                  badge: 'Inspection',
                  content: 'Confirm the exterior bread crust is completely clean and dry with no jelly leaks or drips.',
                },
                {
                  id: 'qc-cut',
                  title: 'Even Halves',
                  subtitle: 'Clean division',
                  badge: 'Inspection',
                  content: 'If cut, halves are equal and the filling stays neatly inside without crust deformation.',
                },
                {
                  id: 'qc-recipient',
                  title: 'Recipient Match',
                  subtitle: 'Dietary check',
                  badge: 'Allergens',
                  content: 'Double-check that the ingredients used match the recipient’s dietary and allergen requirements.',
                  caution: 'Never serve a sandwich if you suspect allergen cross-contact occurred.',
                },
              ],
            },
            { type: 'resource', title: 'One-page job aid: PB&J standard method', description: 'A printable summary of the seven steps, the quality criteria, and the cross-contact rules for posting at the station.', format: 'Printable guide', href: '/training/pb-and-j/job-aid' },
            { type: 'multipleChoice', id: 'q-6-1-serve', prompt: 'The sandwich looks perfect, but you realize you used the wrong bread for someone who avoids wheat. What do you do?', options: [{ id: 'a', text: 'Serve it; it looks fine.' }, { id: 'b', text: 'Remake it with the correct bread on a clean, sanitized surface with clean utensils.', feedback: 'Correct. Appearance never overrides the recipient’s allergen needs.' }, { id: 'c', text: 'Scrape off the spreads and reuse them on new bread.' }], answer: 'b', explanation: 'Remake it. Spreads that touched the wrong bread carry that bread’s allergens.' },
          ],
        };
      if (lesson.id === 'l6-2')
        return {
          ...lesson,
          title: 'Variations and ingredient substitutions',
          summary: 'Common variations and why substitutions need the same care.',
          blocks: [
            { type: 'heading', kicker: 'Module 6 · Quality, service, and cleanup', text: 'Variations without surprises' },
            { type: 'callout', variant: 'warning', title: 'Substitutions are not automatically safer', text: 'Never assume a substitute is safe for someone with an allergy. Confirm the recipient’s needs and read the label every time.' },
            {
              type: 'optionSelect',
              id: 'act-6-2-variations',
              title: 'Four Common Variations',
              instruction: 'Select each variation to review considerations:',
              options: [
                {
                  id: 'va-crunchy',
                  title: 'Crunchy vs Smooth',
                  subtitle: 'Texture selection',
                  badge: 'Texture',
                  content: 'Crunchy adds texture but tears soft bread. Use firmer bread or let the jar warm slightly before spreading.',
                },
                {
                  id: 'va-alternative',
                  title: 'Alternative Spreads',
                  subtitle: 'Seed & soy butters',
                  badge: 'Allergen check',
                  content: 'Sunflower seed butter or soy nut butter can replace peanut butter when peanuts are excluded. Note that soy is also a major allergen.',
                  caution: 'Check recipient requirements and product labels carefully.',
                },
                {
                  id: 'va-breads',
                  title: 'Alternative Breads',
                  subtitle: 'Whole grain & gluten-free',
                  badge: 'Dietary',
                  content: 'Whole grain, gluten-free, and flatbreads change moisture and texture. Gluten-free does not automatically mean free of other allergens.',
                },
                {
                  id: 'va-fruit',
                  title: 'Added Fresh Fruit',
                  subtitle: 'Bananas & berries',
                  badge: 'Moisture',
                  content: 'Sliced bananas or berries add flavor but release liquid. Serve immediately rather than packing for later holding.',
                  tip: 'Pat fresh fruit dry with a towel before adding.',
                },
              ],
            },
            { type: 'multipleResponse', id: 'q-6-2-subs', prompt: 'Which statements about substitutions are correct?', options: [{ id: 'a', text: 'Soy nut butter is a possible alternative, but the recipient’s needs and product label still need to be checked.' }, { id: 'b', text: 'Gluten-free bread is safe for all allergies.' }, { id: 'c', text: 'Labels should be read every time, even for a familiar product.' }, { id: 'd', text: 'Adding fresh fruit makes a packed sandwich keep longer.' }], answers: ['a', 'c'], explanation: 'Gluten-free addresses wheat and gluten only, and fresh fruit adds moisture that shortens how long a packed sandwich stays pleasant.' },
          ],
        };
      if (lesson.id === 'l6-3')
        return {
          ...lesson,
          title: 'Summary and review',
          summary: 'Reset the station, reflect, rate your confidence, and acknowledge.',
          blocks: [
            { type: 'heading', kicker: 'Module 6 · Quality, service, and cleanup', text: 'Finish the job' },
            {
              type: 'optionSelect',
              id: 'act-6-3-cleanup',
              title: 'Three Station Reset Steps',
              instruction: 'Select each step to complete the station reset:',
              required: false,
              options: [
                {
                  id: 'cl-lids',
                  title: '1. Jars & Lids',
                  subtitle: 'Wipe & seal',
                  badge: 'Storage',
                  content: 'Wipe jar threads clean, tighten lids securely, and return jars to their dedicated pantry or refrigerator storage.',
                },
                {
                  id: 'cl-tools',
                  title: '2. Tools & Surfaces',
                  subtitle: 'Wash & sanitize',
                  badge: 'Sanitation',
                  content: 'Wash spreaders and knife in hot soapy water. Clean and sanitize the cutting board and station counter.',
                  caution: 'Store cutting board on edge so both faces air dry.',
                },
                {
                  id: 'cl-trash',
                  title: '3. Trash & Towels',
                  subtitle: 'Clean exit',
                  badge: 'Hygiene',
                  content: 'Dispose of single-use towels, place soiled hand towels in the laundry bin, and wash hands once more.',
                },
              ],
            },
            {
              type: 'reflection',
              id: 'rf-6-3',
              prompt: 'Which step in the standard method is easiest to overlook, and how will you remember it?',
              placeholder: 'Write at least 20 characters…',
              minLength: 20,
              required: true,
            },
            { type: 'survey', id: 'sv-6-3', prompt: 'How confident are you that you could explain why ingredient labels and separate utensils matter before preparing food for someone else?', scale: [{ id: '1', label: 'Not confident' }, { id: '2', label: 'Somewhat confident' }, { id: '3', label: 'Very confident' }] },
            { type: 'attestation', id: 'at-6-3', statement: 'I have reviewed the standard method and the cross-contact rules in this practice course. I understand that this acknowledgement is saved only in my browser and is not a training record.', requiresName: true, required: true },
          ],
        };
      return {
        ...lesson,
        blocks: lesson.blocks.flatMap((block) => {
          if (block.type === 'media')
            return lesson.id === 'l1-2'
              ? [{ type: 'figure' as const, art: 'sandwich' as const, alt: 'A finished peanut butter and jelly sandwich cut diagonally on a plate.', caption: 'Use the five quality criteria to inspect the result before serving.' }]
              : [];
          if (block.type === 'list' && block.title === 'Preventing cross-contact')
            return [{ ...block, items: block.items.map((item) => item === 'Wipe and sanitize the surface between sandwiches made for different people.' ? 'Clean and sanitize the surface between sandwiches made for different people.' : item) }];
          if (block.type === 'callout' && block.title === 'When soap and water are not available')
            return [{ ...block, title: 'Wash before preparing food', text: 'Pause food preparation if you cannot wash your hands with soap and water. Hand sanitizer may be useful for general hand hygiene away from food preparation, but it does not replace handwashing for this task.' }];
          if (block.type === 'numeric' && block.id === 'q-3-2-seconds')
            return [{ ...block, prompt: 'What is the minimum number of seconds CDC recommends scrubbing your hands?', min: 20, max: 20, explanation: 'CDC recommends scrubbing for at least 20 seconds. Longer is fine.' }];
          if (block.type === 'trueFalse' && block.id === 'q-3-2-sanitizer')
            return [{ ...block, explanation: 'Hand sanitizer does not replace handwashing for food preparation. Wash with soap and water before resuming the task.' }];
          if (block.type === 'multipleResponse' && block.id === 'q-6-2-subs')
            return [{ ...block, options: block.options.map((option) => option.id === 'a' ? { ...option, text: 'Soy nut butter is a possible alternative, but the recipient’s needs and product label still need to be checked.' } : option), explanation: 'Gluten-free bread is not automatically safe for every allergy. Added fresh fruit increases moisture, so serve that variation promptly.' }];
          if (block.type === 'survey' && block.id === 'sv-6-3')
            return [{ ...block, prompt: 'How confident are you that you could explain why ingredient labels and separate utensils matter before preparing food for someone else?' }];
          if (block.type === 'resource' && !block.href)
            return [{ ...block, href: '/training/pb-and-j/job-aid', format: 'Printable guide' }];
          if (block.type === 'attestation' && block.id === 'at-6-3')
            return [{ ...block, statement: 'I have reviewed the standard method and the cross-contact rules in this practice course. I understand that this acknowledgement is saved only in my browser and is not a training record.' }];
          return [block];
        }),
      };
    }),
  })),
  assessment: {
    ...pbjComponentLabCourse.assessment,
    questions: pbjComponentLabCourse.assessment.questions.map((question) =>
      question.type === 'numeric' && question.id === 'fa-8'
        ? { ...question, prompt: 'What is the minimum number of seconds CDC recommends scrubbing your hands?', min: 20, max: 20, unit: 'seconds', explanation: 'CDC recommends at least 20 seconds of scrubbing with soap and water.' }
        : question,
    ),
  },
  references: pbjComponentLabCourse.references.slice(0, 3),
  completionStatement:
    'You completed the lessons and passed the knowledge assessment. Your practice progress is saved in this browser only; this is not a workplace training record or qualification.',
  boundary:
    'PBJ-101 is an unassigned practice course. Progress, responses, and acknowledgements stay in this browser. Completion does not create a training record or authorize workplace food preparation.',
};
