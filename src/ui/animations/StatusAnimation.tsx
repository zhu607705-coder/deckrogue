import React from 'react';
import { motion } from 'motion/react';

interface StatusAnimationProps {
  children: React.ReactNode;
  className?: string;
}

export const StatusAnimation: React.FC<StatusAnimationProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
        type: 'spring',
        stiffness: 300,
        damping: 20
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default StatusAnimation;