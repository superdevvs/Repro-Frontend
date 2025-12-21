
import React from 'react';
import { motion } from 'framer-motion';
import { LogOutIcon, HomeIcon } from 'lucide-react';
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
      className="fixed inset-0 z-40 backdrop-blur-md bg-background/80 flex flex-col overflow-auto"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Menu Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <HomeIcon className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">REPro Dashboard</span>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="flex-1 p-4 overflow-auto pb-20">
        <motion.div 
          className="grid grid-cols-2 gap-4"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.07
              }
            }
          }}
          initial="hidden"
          animate="show"
        >
          {filteredItems.map((item, index) => {
            // Use ExpandableMenuItem for items with subItems (like messaging)
            if (item.subItems && item.subItems.length > 0) {
              return (
                <motion.div
                  key={item.to}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
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
                  hidden: { opacity: 0, y: 20 },
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
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
          >
            <button
              onClick={handleLogout}
              className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-xl backdrop-blur-md bg-destructive/10 border border-destructive/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="text-2xl text-destructive">
                <LogOutIcon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">Logout</span>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};
