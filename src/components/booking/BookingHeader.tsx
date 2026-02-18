
import React from 'react';
import { motion } from 'framer-motion';

interface BookingHeaderProps {
  title: string;
  description: string;
}

export function BookingHeader({ title, description }: BookingHeaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="ml-[5px] space-y-1 text-left"
    >
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        {description}
      </p>
    </motion.div>
  );
}
