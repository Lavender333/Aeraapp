import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ViewState } from '../../types';
import { Button } from '../../components/Button';
import { PresentationDemoProvider } from './PresentationDemoProvider';
import { presentationSlides } from './slides/slideDefinitions';

const statusBadgeClass = (status: 'LIVE' | 'NEXT') => {
  if (status === 'LIVE') return 'bg-emerald-600 text-white';
  return 'bg-amber-500 text-white';
};

const statusLabel = (status: 'LIVE' | 'NEXT') => {
  if (status === 'LIVE') return 'Live Now';
  return 'Next Release';
};

const SlideFrame: React.FC<{
  slideNumber: number;
  section?: string;
  title: string;
  speakerNote?: string;
  status: 'LIVE' | 'NEXT';
  children: React.ReactNode;
  lockInteraction?: boolean;
  scale?: number;
}> = ({ slideNumber, section, title, speakerNote, status, children, lockInteraction = true, scale = 1 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const updateScale = () => {
      const containerRect = container.getBoundingClientRect();
      const contentWidth = Math.max(content.scrollWidth, 1);
      const contentHeight = Math.max(content.scrollHeight, 1);

      const widthRatio = containerRect.width / contentWidth;
      const heightRatio = containerRect.height / contentHeight;
      const nextFitScale = Math.min(1, widthRatio, heightRatio);

      setFitScale(Number.isFinite(nextFitScale) ? nextFitScale : 1);
    };

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(container);
    observer.observe(content);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [children]);

  const effectiveScale = Math.min(scale, fitScale);

  return (
    <section className="w-screen h-screen relative bg-slate-950 overflow-hidden text-slate-100">
      <div className="absolute inset-0 z-0 opacity-15 bg-[radial-gradient(circle_at_1px_1px,rgba(251,191,36,0.5)_1px,transparent_0)] bg-[size:32px_32px]" />
      <div className="absolute -top-20 -right-20 w-56 h-56 rotate-45 bg-amber-400/10 z-0" />

      <div className="absolute top-4 left-4 z-40 max-w-[72vw] rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-3 shadow-sm">
        {section && <p className="text-[11px] tracking-[0.18em] uppercase text-amber-300 font-semibold mb-1">{section}</p>}
        <p className="text-xl md:text-2xl leading-tight font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400 mt-1">Slide {slideNumber}</p>
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}>
          {statusLabel(status)}
        </div>
      </div>

      <div ref={containerRef} className="absolute inset-x-0 top-24 bottom-14 overflow-hidden flex items-start justify-center z-10">
        <div
          ref={contentRef}
          style={{
            transform: `scale(${effectiveScale})`,
            transformOrigin: 'top center',
            width: '100%',
            height: '100%',
          }}
        >
          {children}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-40 h-12 border-t border-slate-700 bg-slate-900/95 px-4 flex items-center">
        <p className="text-sm text-slate-200 truncate">
          {speakerNote || 'Presentation walkthrough of current AERA capabilities and clearly marked next-release areas.'}
        </p>
      </div>

      {lockInteraction && <div className="absolute inset-0 z-20" aria-hidden="true" />}
    </section>
  );
};

export const PresentationLayout: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [slideIndex, setSlideIndex] = useState(0);

  const totalSlides = presentationSlides.length;
  const currentSlide = useMemo(() => presentationSlides[slideIndex], [slideIndex]);

  const goNext = () => setSlideIndex((value) => Math.min(value + 1, totalSlides - 1));
  const goPrev = () => setSlideIndex((value) => Math.max(value - 1, 0));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setView('DASHBOARD');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setView]);

  return (
    <PresentationDemoProvider>
      <div className="w-screen h-screen bg-slate-950 overflow-hidden">
        <div key={currentSlide.id} className="w-full h-full transition-opacity duration-300 ease-in-out opacity-100">
          <SlideFrame
            slideNumber={currentSlide.id}
            section={currentSlide.section}
            title={currentSlide.title}
            speakerNote={currentSlide.speakerNote}
            status={currentSlide.status}
            lockInteraction={currentSlide.lockInteraction}
            scale={currentSlide.scale || 1}
          >
            {currentSlide.content}
          </SlideFrame>
        </div>

        <div className="absolute top-14 right-4 z-50 flex items-center gap-3 bg-slate-900/95 border border-slate-700 rounded-xl px-3 py-2 shadow-sm">
          <Button size="sm" variant="secondary" onClick={goPrev} disabled={slideIndex === 0}>
            <ArrowLeft size={16} className="mr-1" /> Prev
          </Button>
          <span className="text-sm font-medium text-slate-200 min-w-[110px] text-center">
            {slideIndex + 1} / {totalSlides}
          </span>
          <Button size="sm" onClick={goNext} disabled={slideIndex === totalSlides - 1}>
            Next <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </PresentationDemoProvider>
  );
};
