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

  DECK.forEach((item, index) => {
    const slide = pptx.addSlide();

    slide.background = { color: '0F172A' };

    slide.addText(`${index + 1}. ${item.title}`, {
      x: 0.6,
      y: 0.5,
      w: 12,
      h: 0.7,
      fontSize: 34,
      bold: true,
      color: 'F8FAFC'
    });

    slide.addText(item.subtitle, {
      x: 0.6,
      y: 1.25,
      w: 12,
      h: 0.5,
      fontSize: 18,
      color: '94A3B8'
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 1.95,
      w: 12,
      h: 4.7,
      radius: 0.12,
      fill: { color: '1E293B', transparency: 6 },
      line: { color: '334155', pt: 1 }
    });

    slide.addText(
      item.bullets.map((text) => ({ text, options: { bullet: { indent: 18 } } })),
      {
        x: 0.95,
        y: 2.3,
        w: 11.2,
        h: 3.9,
        fontSize: 20,
        color: 'E2E8F0',
        breakLine: true,
        paraSpaceAfterPt: 10,
        valign: 'top'
      }
    );
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: `AERA_Presentation_${fileDate}.pptx` });
};
