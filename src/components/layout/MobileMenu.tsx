
import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useMobileMenu } from './mobile-menu/useMobileMenu';
import { MobileBottomNav } from './mobile-menu/MobileBottomNav';
import { MenuContent } from './mobile-menu/MenuContent';

const MobileMenu = () => {
  const { isMenuOpen, toggleMenu, closeMenu, handleLogout, filteredItems } = useMobileMenu();

  return (
    <>
      <MobileBottomNav toggleMenu={toggleMenu} />

      <AnimatePresence>
        {isMenuOpen && (
          <MenuContent 
            isMenuOpen={isMenuOpen}
            filteredItems={filteredItems}
            closeMenu={closeMenu}
            handleLogout={handleLogout}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileMenu;
