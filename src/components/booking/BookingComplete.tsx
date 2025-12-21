
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircleIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BookingCompleteProps {
  date: Date | undefined;
  time: string;
  resetForm: () => void;
}

export function BookingComplete({ date, time, resetForm }: BookingCompleteProps) {
  const navigate = useNavigate();
  
  // Format the date properly to ensure correct display
  const formattedDate = date ? format(new Date(
    date.getFullYear(),
    date.getMonth(), 
    date.getDate(),
    12 // Set to noon to avoid timezone issues
  ), 'MMMM d, yyyy') : '';

  return (
    <motion.div
      key="complete"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto"
    >
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircleIcon className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Booking Complete!</h2>
      <p className="text-muted-foreground mb-6">
        The shoot has been successfully scheduled for {formattedDate} at {time}.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={resetForm} variant="outline">Book Another Shoot</Button>
        <Button onClick={() => navigate('/shoot-history')}>View All Shoots</Button>
      </div>
    </motion.div>
  );
}
