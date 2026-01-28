import React, { useEffect, useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/auth';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

const Index = () => {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkDesktop = !isMobile && theme === 'dark';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);


  const images = [
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
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 5000); // autoplay every 5 seconds
    return () => clearInterval(iv);
  }, [images.length]);

  return (
    <div
      className="min-h-dvh w-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative pt-[env(safe-area-inset-top)] pb-[max(2rem,env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)]"
      style={{ 
        background: isMobile 
          ? '#020617' 
          : isDarkDesktop 
            ? 'linear-gradient(to bottom, #020617 0%, #0a1628 35%, #0d1f3c 60%, #133557 85%, #1a4a6e 100%)' 
            : 'white',
        ...(isMobile ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {})
      }}
    >
      {/* Left Side - Slideshow */}
      <div
        className={`
          w-full md:w-1/2 relative
          ${isMobile ? 'px-4 pt-4 pb-4' : 'p-4'}
          flex items-center justify-center
        `}
      >
        <div
          className={`relative w-full overflow-hidden ${
            isMobile
              ? 'rounded-t-[30px] rounded-b-none shadow-[0_36px_80px_rgba(5,9,20,0.75)] h-[50vh] min-h-[340px] max-h-[520px]'
              : 'h-[40vh] sm:h-64 md:h-full md:rounded-3xl'
          }`}
        >
          <AnimatePresence mode="sync">
            <motion.img
              key={images[index]}
              src={images[index]}
              alt=""
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>

          {/* Gradient overlay for legibility */}
          <div className="absolute inset-0 md:rounded-3xl bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

          {/* Text content */}
          {!isMobile && (
            <div className="absolute text-white drop-shadow-lg z-10 pointer-events-none bottom-10 left-10 right-10 text-left">
              <p className="text-3xl md:text-4xl font-semibold leading-tight whitespace-normal">
                Elevating your
                <br />
                <span className="lowercase">status quo!</span>
              </p>
            </div>
          )}
          {isMobile && (
            <div className="absolute inset-0 rounded-t-[30px] rounded-b-none pointer-events-none">
              <div className="absolute inset-x-0 bottom-0 h-[160px] rounded-b-none bg-gradient-to-b from-transparent via-[#040b18f2] to-[#030813]" />
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Login Section */}
      <motion.div
        className={`
          w-full md:w-1/2 flex items-start md:items-center justify-center
          px-4 sm:px-6 md:p-8
          py-8 sm:py-10
          ${
            isMobile
              ? 'text-white relative z-10 w-full px-4 flex-1 flex-col justify-end'
              : 'relative'
          }
        `}
        style={isMobile ? { marginTop: 'calc(-8rem + 10px)' } : undefined}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className={`${isMobile ? 'w-full max-w-md space-y-6 text-[15px] pb-8' : 'w-full max-w-md'}`}>
          <LoginForm />
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
