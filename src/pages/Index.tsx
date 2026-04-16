import React, { useEffect, useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/auth';
import { useNavigate } from 'react-router-dom';

const LOGIN_SLIDES = [
  '/login-slides/slide (1).jpg',
  '/login-slides/slide (2).jpg',
  '/login-slides/slide (3).jpg',
  '/login-slides/slide (4).jpg',
  '/login-slides/slide (5).jpg',
  '/login-slides/slide (6).jpg',
  '/login-slides/slide (7).jpg',
  '/login-slides/slide (8).jpg',
  '/login-slides/slide (9).jpg',
  '/login-slides/slide (10).jpg',
  '/login-slides/slide (11).jpg',
  '/login-slides/slide (12).jpg',
  '/login-slides/slide (13).jpg',
  '/login-slides/slide (14).jpg',
  '/login-slides/slide (15).jpg',
  '/login-slides/slide (16).jpg',
] as const;

const LOGIN_PANEL_GRADIENT =
  'linear-gradient(to bottom, rgba(6,10,14,0) 0%, rgba(6,10,14,0.14) 24%, rgba(6,10,14,0.48) 52%, rgba(6,10,14,0.84) 76%, rgba(6,10,14,0.98) 100%)';
const DESKTOP_LOGIN_CARD_GRADIENT =
  'linear-gradient(to top, rgba(27,149,255,0.26) 0%, rgba(20,109,255,0.17) 18%, rgba(8,26,48,0.06) 38%, rgba(6,10,14,0) 58%)';

const markImageReady = async (
  image: HTMLImageElement,
  src: string,
  markLoaded: (src: string) => void,
) => {
  try {
    if (typeof image.decode === 'function') {
      await image.decode();
    }
  } catch {
    // Ignore decode failures and still allow the image to be used.
  }

  markLoaded(src);
};

const Index = () => {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('login');
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [displayIndex, setDisplayIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [desktopGradientVisible, setDesktopGradientVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;

    html.style.backgroundColor = '#060a0e';
    body.style.backgroundColor = '#060a0e';

    const themeColorMetas = Array.from(
      document.querySelectorAll("meta[name='theme-color']")
    ) as HTMLMetaElement[];
    const prevThemeColors = themeColorMetas.map((meta) => meta.content);

    themeColorMetas.forEach((meta) => {
      meta.content = '#060a0e';
    });

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      themeColorMetas.forEach((meta, index) => {
        meta.content = prevThemeColors[index] ?? meta.content;
      });
    };
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    let cancelled = false;

    const markLoaded = (src: string) => {
      if (cancelled) return;
      setLoadedImages((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
    };

    LOGIN_SLIDES.forEach((src, index) => {
      const image = new Image();
      image.decoding = 'async';
      if ('fetchPriority' in image) {
        (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
          index < 2 ? 'high' : 'auto';
      }
      image.src = src;

      if (image.complete) {
        void markImageReady(image, src, markLoaded);
        return;
      }

      image.onload = () => {
        void markImageReady(image, src, markLoaded);
      };
      image.onerror = () => markLoaded(src);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const nextIndex = (displayIndex + 1) % LOGIN_SLIDES.length;
      const nextImage = LOGIN_SLIDES[nextIndex];

      if (loadedImages[nextImage]) {
        setDisplayIndex(nextIndex);
        setPendingIndex(null);
        return;
      }

      setPendingIndex(nextIndex);
    }, 5000); // autoplay every 5 seconds
    return () => clearInterval(iv);
  }, [displayIndex, loadedImages]);

  useEffect(() => {
    if (pendingIndex === null) return;
    const nextImage = LOGIN_SLIDES[pendingIndex];
    if (!loadedImages[nextImage]) return;

    setDisplayIndex(pendingIndex);
    setPendingIndex(null);
  }, [loadedImages, pendingIndex]);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleDesktopGradient = () => {
      fadeTimer = setTimeout(() => {
        setDesktopGradientVisible(true);
      }, 1000);
    };

    if (document.readyState === 'complete') {
      scheduleDesktopGradient();
    } else {
      window.addEventListener('load', scheduleDesktopGradient, { once: true });
    }

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      window.removeEventListener('load', scheduleDesktopGradient);
    };
  }, []);

  const activeSlide = LOGIN_SLIDES[displayIndex];
  const isRegisterView = activeTab === 'register';

  // Mobile layout: Login = no scroll, responsive height; Register = scrollable
  if (isMobile) {
    const isLogin = activeTab === 'login';
    
    return (
      <div 
        className={`dark ${isLogin ? '' : 'mobile-login-scrollable'}`} 
        style={{ 
          background: '#060a0e', 
          minHeight: '100dvh',
          height: isLogin ? '100dvh' : 'auto',
          overflow: isLogin ? 'hidden' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: isLogin ? '16px' : undefined,
          paddingTop: isLogin ? 'calc(11px + env(safe-area-inset-top))' : undefined,
          paddingBottom: isLogin ? 'calc(11px + env(safe-area-inset-bottom))' : undefined,
        }}
      >
        {/* Image Section - flex grows to fill available space on login */}
        <div
          className={`${isLogin ? 'relative' : 'fixed top-0 left-0 right-0 z-0 px-4 pt-[calc(env(safe-area-inset-top)+16px)]'}`}
          style={{ 
            height: isLogin ? 'auto' : '50vh',
            flex: isLogin ? '1 1 auto' : undefined,
            minHeight: isLogin ? '150px' : '320px', 
            maxHeight: isLogin ? undefined : '450px',
          }}
        >
          <div 
            className="relative w-full overflow-hidden rounded-t-[30px]"
            style={{ 
              height: '100%',
              minHeight: isLogin ? '150px' : undefined,
            }}
          >
            <AnimatePresence mode="sync">
              <motion.img
                key={activeSlide}
                src={activeSlide}
                alt=""
                initial={{ opacity: 0, scale: 1.01, filter: 'blur(4px)' }}
                animate={{ opacity: loadedImages[activeSlide] ? 1 : 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.996, filter: 'blur(1px)' }}
                transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover will-change-transform"
                loading="eager"
                decoding="async"
              />
            </AnimatePresence>
          </div>
        </div>

        {/* Page Content */}
        <div
          className="relative z-10 w-full"
          style={{
            flex: isLogin ? '0 0 auto' : undefined,
            minHeight: isLogin ? undefined : 'calc(100dvh - 50vh)',
            paddingBottom: isLogin ? undefined : 'calc(10px + env(safe-area-inset-bottom))',
          }}
        >
          {/* Gradient at top of content */}
          <div 
            className="w-full pointer-events-none"
            style={{
              height: isLogin ? '35px' : '25px',
              marginTop: isLogin ? '-35px' : '-25px',
              background: LOGIN_PANEL_GRADIENT,
            }}
          />
          <div style={{ background: '#060a0e' }}>
            <motion.div
              className={`relative z-10 w-full text-white ${isLogin ? '' : 'px-4'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <div className={`w-full max-w-md mx-auto space-y-6 text-[15px] ${isLogin ? '' : 'pb-8 pt-2'}`}>
                <LoginForm onTabChange={handleTabChange} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      className="dark box-border h-dvh w-full flex flex-row gap-4 p-4 md:overflow-hidden relative"
      style={{ background: '#060a0e' }}
    >
      {/* Left Side - Slideshow */}
      <div className="relative flex h-full w-1/2 items-center justify-center">
        <div className="relative w-full h-full overflow-hidden rounded-3xl bg-[#05080d]">
          <AnimatePresence mode="sync">
            <motion.img
              key={activeSlide}
              src={activeSlide}
              alt=""
              initial={{ opacity: 0, scale: 1.01, filter: 'blur(4px)' }}
              animate={{ opacity: loadedImages[activeSlide] ? 1 : 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.996, filter: 'blur(1px)' }}
              transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              loading="eager"
              decoding="async"
            />
          </AnimatePresence>

          {/* Text content */}
          <div className="absolute text-white drop-shadow-lg z-10 pointer-events-none bottom-10 left-10 right-10 text-left">
            <p className="text-3xl md:text-4xl font-semibold leading-tight whitespace-normal">
              Elevating your
              <br />
              <span className="lowercase">status quo!</span>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Section */}
      <motion.div
        className="flex h-full w-1/2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div
          className={`relative flex h-full w-full justify-center rounded-3xl bg-[#05080d] px-8 xl:px-12 ${
            isRegisterView
              ? 'items-start overflow-y-auto py-14 xl:py-16'
              : 'items-center overflow-hidden py-10'
          }`}
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={false}
            animate={{ opacity: desktopGradientVisible ? 1 : 0 }}
            transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: DESKTOP_LOGIN_CARD_GRADIENT }}
          />
          <div className={`relative z-10 w-full max-w-md ${isRegisterView ? 'min-h-full' : ''}`}>
            <LoginForm />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
