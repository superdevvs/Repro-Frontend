import React, { useEffect, useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/auth';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);


  const images = [
    '/slide1.jpg',
    '/slide2.jpg',
    '/slide3.jpg',
    '/slide4.jpg',
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 3000); // autoplay every 3 seconds
    return () => clearInterval(iv);
  }, [images.length]);

  return (
    <div className="min-h-dvh w-full flex flex-col md:flex-row overflow-hidden relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Left Side - Slideshow */}
      <div
        className={`
          w-full md:w-1/2 relative
          ${isMobile ? 'p-0' : 'p-4'}
          flex items-center justify-center
        `}
      >
        <div className="relative w-full h-48 sm:h-64 md:h-full overflow-hidden md:rounded-3xl">
          <AnimatePresence mode="wait">
            <motion.img
              key={images[index]}
              src={images[index]}
              alt=""
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>

          {/* Gradient overlay for legibility */}
          <div className="absolute inset-0 md:rounded-3xl bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

          {/* Text content */}
          <div className="absolute bottom-3 left-4 right-4 md:bottom-10 md:left-10 text-white drop-shadow">
            <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
              Capture.<br />Manage.<br />Deliver.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Section */}
      <motion.div
        className={`
          w-full md:w-1/2 flex items-center justify-center
          px-4 sm:px-6 md:p-8
          py-6 sm:py-8
          overflow-y-auto overscroll-contain
        `}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
