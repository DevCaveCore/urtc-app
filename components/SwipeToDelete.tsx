import React, { ReactNode } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}

export const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({ children, onDelete, className = '' }) => {
  const controls = useAnimation();
  // The red "Delete" layer is only painted once the card is actually being
  // dragged aside. Painting it at rest meant any card with a translucent
  // background (e.g. archived trips) showed the trash icon bleeding through.
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [-100, -8, 0], [1, 0, 0]);

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
      {/* Red reveal layer — fades in only as the card is pulled aside */}
      <motion.div
        style={{ opacity: revealOpacity }}
        aria-hidden="true"
        className="absolute inset-0 bg-red-950 flex items-center justify-end pr-5 shadow-inner pointer-events-none"
      >
        <div className="flex flex-col items-center justify-center gap-1 text-red-400">
          <Trash2 size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </div>
      </motion.div>

      {/* Swipeable Foreground */}
      <motion.div
        drag="x"
        dragDirectionLock
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }} // Let it drag freely left, we handle snap back manually
        dragElastic={{ left: 0.8, right: 0 }} // Elasticity on left pull, hard stop on right pull
        onDragEnd={handleDragEnd}
        animate={controls}
        onPointerDownCapture={(e) => e.stopPropagation()}
        onTouchStartCapture={(e) => e.stopPropagation()}
        className="relative z-10 w-full touch-pan-y"
      >
        <div>
           {children}
        </div>
      </motion.div>
    </div>
  );
};
