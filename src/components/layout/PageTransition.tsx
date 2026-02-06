
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ 
  children, 
  className = "",
  ...props
}: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Add default export to support both named and default imports
export default PageTransition;
