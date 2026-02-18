import PptxGenJS from 'pptxgenjs';

type DeckSlide = {
  title: string;
  subtitle: string;
  bullets: string[];
};

const DECK: DeckSlide[] = [
  {
    title: 'AERA',
    subtitle: 'Accelerated Emergency Response Application',
    bullets: [
      'Mitigate • Communicate • Respond • Recover',
      'Role-based platform connecting Communities, Responders, and Institutions during disasters.'
    ]
  },
  {
    title: 'The Challenge',
    subtitle: 'Why We Built AERA',
    bullets: [
      '911 overload during mass events.',
      'Information silos between NGOs, churches, and government.',
      'Slow triage due to poor visibility of who is already safe.'
    ]
  },
  {
    title: 'The User Journey',
    subtitle: 'Rapid, Low-Friction Emergency Reporting',
    bullets: [
      'One-tap SOS for Safe/Danger reporting.',
      'Live GPS with accuracy metrics.',
      'Vital intake data to speed triage.'
    ]
  },
  {
    title: 'Offline Resilience',
    subtitle: 'Works When The Power Goes Out',
    bullets: [
      'Store-and-forward reporting when towers are down.',
      'Automatic sync when signal returns.',
      'Local caching for maps, safety tips, and critical contacts.'
    ]
  },
  {
    title: 'Organization Hubs',
    subtitle: 'Empowering Trusted Institutions',
    bullets: [
      'Community Connect through Community IDs.',
      'Real-time member status tracking.',
      'Local inventory and replenishment requests.'
    ]
  },
  {
    title: 'Active Safety Checks',
    subtitle: 'Instant Accountability',
    bullets: [
      'Admin initiates member status ping.',
      'User responds with I Am Safe / Need Help.',
      'Dashboard updates in real-time with color-coded status.'
    ]
  },
  {
    title: 'Economic Recovery',
    subtitle: 'The G.A.P. Financial Center',
    bullets: [
      'Streamlined grants for housing and business aid.',
      'Emergency advances for verified victims.'
    ]
  },
  {
    title: 'Admin Command',
    subtitle: 'System-Wide Control & Logistics',
    bullets: [
      'Global and scoped broadcasts.',
      'Master inventory visibility across organizations.',
      'Accountability paper trail: signatures, printouts, and CSV exports.'
    ]
  },
  {
    title: 'Future Tech',
    subtitle: 'AI & Drone Integration',
    bullets: [
      'Drone dispatch for supply drops and reconnaissance.',
      'AI-assisted damage assessment and content moderation.'
    ]
  }
];

export const downloadAdminPresentationPptx = async (): Promise<void> => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AERA';
  pptx.subject = 'Emergency response admin presentation';
  pptx.title = 'AERA Presentation';
  pptx.company = 'AERA';

  // Define background colors to match the on-screen presentation
  const slideBackgrounds = [
    '0F172A', // slate-900 - AERA intro
    '991B1B', // red-900 - The Challenge
    '2563EB', // blue-600 - The User Journey
    'B45309', // amber-700 - Offline Resilience
    '6D28D9', // purple-700 - Organization Hubs
    '4338CA', // indigo-700 - Active Safety Checks
    '047857', // emerald-700 - Economic Recovery
    '1E293B', // slate-800 - Admin Command
    '0F766E'  // teal-700 - Future Tech
  ];

  DECK.forEach((item, index) => {
    const slide = pptx.addSlide();

    // Set background color matching the on-screen presentation
    slide.background = { color: slideBackgrounds[index] || '0F172A' };

    // Add slide number in the top right
    slide.addText(`${index + 1}`, {
      x: 12.5,
      y: 0.3,
      w: 0.5,
      h: 0.3,
      fontSize: 14,
      bold: true,
      color: 'FFFFFF',
      align: 'right',
      transparency: 50
    });

    // Add title with better styling
    slide.addText(`${index + 1}. ${item.title}`, {
      x: 0.6,
      y: 0.6,
      w: 11.5,
      h: 0.8,
      fontSize: 40,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Arial'
    });

    // Add subtitle with better contrast
    slide.addText(item.subtitle, {
      x: 0.6,
      y: 1.5,
      w: 11.5,
      h: 0.5,
      fontSize: 20,
      color: 'CBD5E1',
      fontFace: 'Arial',
      italic: true
    });

    // Add a decorative accent line under the subtitle
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 2.1,
      w: 2,
      h: 0.05,
      fill: { color: 'FFFFFF', transparency: 30 },
      line: { type: 'none' }
    });

    // Add content box with better styling
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 2.4,
      w: 12,
      h: 4.3,
      radius: 0.15,
      fill: { color: '1E293B', transparency: 20 },
      line: { color: '475569', pt: 2 }
    });

    // Add bullets with improved formatting and spacing
    slide.addText(
      item.bullets.map((text) => ({ 
        text, 
        options: { 
          bullet: { 
            type: 'number',
            style: 'arabicPeriod',
            indent: 24 
          } 
        } 
      })),
      {
        x: 1.0,
        y: 2.7,
        w: 11.2,
        h: 3.7,
        fontSize: 20,
        color: 'F1F5F9',
        breakLine: true,
        paraSpaceBefore: 8,
        paraSpaceAfter: 12,
        valign: 'top',
        lineSpacing: 24,
        fontFace: 'Arial'
      }
    );

    // Add footer with branding
    slide.addText('AERA - Accelerated Emergency Response Application', {
      x: 0.6,
      y: 7.0,
      w: 11.5,
      h: 0.3,
      fontSize: 10,
      color: 'FFFFFF',
      align: 'left',
      transparency: 50,
      fontFace: 'Arial'
    });
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: `AERA_Presentation_${fileDate}.pptx` });
};
