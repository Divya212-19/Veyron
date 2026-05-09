import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassmorphicPanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}

export function GlassmorphicPanel({
  children,
  className = '',
  hover = true,
  delay = 0,
}: GlassmorphicPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      whileHover={hover ? { y: -5, scale: 1.02 } : undefined}
      className={`glass-dark rounded-2xl p-6 border border-cyan-500/20 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function HolographicText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-glow-strong font-grotesk font-bold ${className}`}>
      {children}
    </span>
  );
}

export function CyberBadge({ children, variant = 'cyan' }: { children: ReactNode; variant?: 'cyan' | 'blue' | 'red' }) {
  const variants = {
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    red: 'bg-red-500/10 border-red-500/30 text-red-300',
  };

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function PremiumButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyber-lg hover:shadow-cyber-xl',
    secondary: 'border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 shadow-cyber hover:shadow-cyber-lg',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-900/40',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function ScanPulse() {
  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 rounded-2xl border border-cyan-500/40 animate-pulse-glow" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-500/20 animate-pulse" style={{ animationDelay: '0.3s' }} />
    </div>
  );
}

export function CyberGrid() {
  return (
    <div className="absolute inset-0 opacity-20">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <svg className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 224, 255, 0.1)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
