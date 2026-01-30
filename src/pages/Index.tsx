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
  const [activeTab, setActiveTab] = useState<string>('login');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };


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

  // Mobile layout: Login = no scroll, responsive height; Register = scrollable
  if (isMobile) {
    const isLogin = activeTab === 'login';
    
    return (
      <div 
        className={isLogin ? '' : 'mobile-login-scrollable'} 
        style={{ 
          background: '#03060B', 
          minHeight: '100dvh',
          height: isLogin ? '100dvh' : 'auto',
          overflow: isLogin ? 'hidden' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: isLogin ? '16px' : undefined,
          paddingTop: isLogin ? 'calc(6px + env(safe-area-inset-top))' : undefined,
          paddingBottom: isLogin ? 'calc(6px + env(safe-area-inset-bottom))' : undefined,
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
              background: 'linear-gradient(to bottom, transparent 0%, rgba(3,6,11,0.45) 30%, rgba(3,6,11,0.78) 65%, #03060B 100%)',
            }}
          />
          <div style={{ background: '#03060B' }}>
            <motion.div
              className={`relative z-10 w-full text-white ${isLogin ? '' : 'px-4'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <div className={`w-full max-w-md mx-auto space-y-6 text-[15px] ${isLogin ? '' : 'pb-2'}`}>
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
      className="min-h-dvh w-full flex flex-row md:overflow-hidden relative pb-[env(safe-area-inset-bottom)]"
      style={{ 
        background: isDarkDesktop 
          ? 'linear-gradient(180deg, rgba(6,10,14,1) 0%, rgba(9,16,28,1) 35%, rgba(11,24,42,1) 60%, rgba(14,35,63,1) 85%, rgba(18,55,92,1) 100%)'
          : 'white'
      }}
    >
      {/* Left Side - Slideshow */}
      <div className="w-1/2 relative p-4 flex items-center justify-center">
        <div className="relative w-full h-full overflow-hidden rounded-3xl">
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
        className="w-1/2 flex items-center justify-center p-8 relative"
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
