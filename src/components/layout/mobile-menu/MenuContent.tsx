
import React from 'react';
import { motion } from 'framer-motion';
import { LogOutIcon } from 'lucide-react';
import { MenuItem } from './MenuItem';
import { ExpandableMenuItem } from './ExpandableMenuItem';

interface MenuContentProps {
  isMenuOpen: boolean;
  filteredItems: any[];
  closeMenu: () => void;
  handleLogout: () => void;
}

export const MenuContent = ({ isMenuOpen, filteredItems, closeMenu, handleLogout }: MenuContentProps) => {
  if (!isMenuOpen) return null;
  
  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onClick={closeMenu}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 flex h-[78dvh] max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-white/10 bg-background/95 shadow-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 mb-1 h-1.5 w-11 rounded-full bg-muted-foreground/35" />

        {/* Menu Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex h-6 items-center">
            <img
              src="/Repro HQ dark.png"
              alt="REPRO"
              className="h-6 w-auto -translate-y-0.5 dark:hidden"
              loading="eager"
            />
            <img
              src="/REPRO-HQ.png"
              alt="REPRO"
              className="hidden h-6 w-auto -translate-y-0.5 dark:block"
              loading="eager"
            />
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-auto overscroll-contain px-3 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          <motion.div 
            className="grid grid-cols-2 gap-2.5"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.06
                }
              }
            }}
            initial="hidden"
            animate="show"
          >
            {filteredItems.map((item) => {
              // Use ExpandableMenuItem for items with subItems (like messaging)
              if (item.subItems && item.subItems.length > 0) {
                return (
                  <motion.div
                    key={item.to}
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      show: { opacity: 1, y: 0 }
                    }}
                  >
                    <ExpandableMenuItem
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      isActive={item.isActive}
                      onClick={closeMenu}
                      subItems={item.subItems}
                    />
                  </motion.div>
                );
              }
              // Use regular MenuItem for items without subItems
              return (
                <motion.div
                  key={item.to}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <MenuItem
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    isActive={item.isActive}
                    onClick={closeMenu}
                  />
                </motion.div>
              );
            })}
            
            {/* Logout Button */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <button
                onClick={handleLogout}
                className="w-full flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 shadow-lg transition-all duration-200"
              >
                <div className="text-destructive">
                  <LogOutIcon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">Logout</span>
              </button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
