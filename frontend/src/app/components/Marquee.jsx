import { motion } from 'framer-motion';

export const Marquee = ({ children, direction = 'left', speed = 40, className = "" }) => {
  return (
    <div className={`relative flex w-full overflow-hidden shrink-0 group ${className}`}>
      {/* Edge Gradients */}
      <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      
      <motion.div
        animate={{ x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
        className="flex shrink-0 gap-6 pr-6 w-max hover:[animation-play-state:paused]"
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
