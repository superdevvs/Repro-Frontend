import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

// The public login page uses these same photographs and panel treatments.
const slides = Array.from({ length: 16 }, (_, index) => `/login-slides/slide (${index + 1}).jpg`);
const panelGradient = 'linear-gradient(to bottom, rgba(6,10,14,0) 0%, rgba(6,10,14,0.14) 24%, rgba(6,10,14,0.48) 52%, rgba(6,10,14,0.84) 76%, rgba(6,10,14,0.98) 100%)';
const desktopGradient = 'linear-gradient(to top, rgba(27,149,255,0.26) 0%, rgba(20,109,255,0.17) 18%, rgba(8,26,48,0.06) 38%, rgba(6,10,14,0) 58%)';

/** Login presentation only: guests never mount the account sign-in flow. */
export function GuestLoginShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.backgroundColor;
    const previousBody = body.style.backgroundColor;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>("meta[name='theme-color']"));
    const previousColors = metas.map(meta => meta.content);
    html.style.backgroundColor = '#060a0e'; body.style.backgroundColor = '#060a0e';
    metas.forEach(meta => { meta.content = '#060a0e'; });
    return () => {
      html.style.backgroundColor = previousHtml; body.style.backgroundColor = previousBody;
      metas.forEach((meta, index) => { meta.content = previousColors[index]; });
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const next = (slide + 1) % slides.length;
    const image = new Image();
    let ready = false;
    image.decoding = 'async';
    image.onload = () => { ready = true; };
    image.src = slides[next];
    ready = image.complete && image.naturalWidth > 0;
    const timer = window.setInterval(() => { if (ready && !document.hidden) setSlide(next); }, 5000);
    return () => { window.clearInterval(timer); image.onload = null; };
  }, [slide, reduceMotion]);

  const photograph = <AnimatePresence initial={false} mode="sync">
    <motion.img key={slides[slide]} src={slides[slide]} alt="" aria-hidden="true" loading="eager" decoding="async"
      initial={reduceMotion ? false : { opacity: 0, scale: 1.01, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.996 }}
      transition={{ duration: reduceMotion ? 0 : 0.95, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 h-full w-full object-cover" />
  </AnimatePresence>;

  if (isMobile) return <main className="dark flex h-dvh w-full flex-col overflow-y-auto bg-[#060a0e] text-white"
    style={{ paddingTop: 'calc(11px + env(safe-area-inset-top))', paddingBottom: 'calc(11px + env(safe-area-inset-bottom))' }}>
    <div className="relative min-h-[150px] flex-[1_0_150px] overflow-hidden rounded-t-[30px] bg-[#05080d]">{photograph}</div>
    <div className="relative z-10 shrink-0">
      <div aria-hidden="true" className="pointer-events-none -mt-[35px] h-[35px]" style={{ background: panelGradient }} />
      <div className="rounded-b-[28px] bg-[#03060B] shadow-[0_24px_60px_rgba(1,3,9,0.68)]">
        <div className="relative rounded-b-[26px] bg-gradient-to-b from-[#050815]/85 via-[#050f20]/55 to-[#0b1a36] p-4 backdrop-blur-2xl sm:p-6">{children}</div>
      </div>
    </div>
  </main>;

  return <main className="dark relative box-border grid h-dvh w-full grid-cols-2 gap-4 overflow-hidden bg-[#060a0e] py-4 text-white">
    <div className="relative h-full min-w-0 overflow-hidden rounded-3xl bg-[#05080d]">
      {photograph}
      <div className="pointer-events-none absolute bottom-10 left-10 right-10 z-10 text-left text-white drop-shadow-lg">
        <p className="text-3xl font-semibold leading-tight md:text-4xl">Elevating your<br /><span className="lowercase">status quo!</span></p>
      </div>
    </div>
    <section className="relative flex h-full min-h-0 min-w-0 flex-col items-center overflow-y-auto rounded-3xl bg-[#05080d] px-8 py-10 xl:px-12" aria-label="Guest verification">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: desktopGradient }} />
      <div className="relative z-10 my-auto w-full max-w-md shrink-0">{children}</div>
    </section>
  </main>;
}
