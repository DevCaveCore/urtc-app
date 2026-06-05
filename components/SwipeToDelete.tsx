import React, { ReactNode } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}

export const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({ children, onDelete, className = '' }) => {
  const controls = useAnimation();

  const handleDragEnd = async (event: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // If swiped far enough left or fast enough left
    if (offset < -100 || velocity < -500) {
      await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.2 } });
      onDelete();
    } else {
      // Snap back
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Red Background Layer */}
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 shadow-inner">
        <div className="flex flex-col items-center justify-center gap-1 opacity-80 text-white">
          <Trash2 size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </div>
      </div>
      
      {/* Swipeable Foreground */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }} // Let it drag freely left, we handle snap back manually
        dragElastic={{ left: 0.8, right: 0 }} // Elasticity on left pull, hard stop on right pull
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative z-10 w-full touch-pan-y"
      >
        <div>
           {children}
        </div>
      </motion.div>
    </div>
  );
};
