import { useState } from 'react';
import { Menu, X, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../context/LanguageContext';
import logo from '/image.png';

interface NavbarProps {
  currentPage: string;
  setPage: (page: string) => void;
}

const navItems = [
  { key: 'home', en: 'Dashboard', hi: 'डैशबोर्ड' },
  { key: 'deepfake', en: 'Deepfake', hi: 'डीपफेक' },
  { key: 'scanner', en: 'Scanner', hi: 'स्कैनर' },
  { key: 'spam', en: 'Email', hi: 'ईमेल' },
  { key: 'app', en: 'Apps', hi: 'ऐप्स' },
  { key: 'rootcause', en: 'Analysis', hi: 'विश्लेषण' },
  { key: 'complaints', en: 'Complaints', hi: 'शिकायतें' },
  { key: 'awareness', en: 'Learn', hi: 'शिक्षा' },
];

export default function Navbar({ currentPage, setPage }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, toggleLang } = useLang();

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 glass-dark border-b cyber-border backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setPage('home')}
            className="flex items-center gap-3 flex-shrink-0 group"
          >
            <div className="relative">
              <img src={logo} alt="Veyron" className="h-10 w-10 object-contain group-hover:drop-shadow-[0_0_8px_rgba(0,224,255,0.6)]" />
            </div>
            <span className="font-grotesk font-bold text-xl text-white tracking-wider hidden sm:block group-hover:text-cyan-300 transition-colors">
              VEYRON
            </span>
          </motion.button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <motion.button
                key={item.key}
                onClick={() => setPage(item.key)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPage === item.key
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-600/30 text-cyan-300 border border-cyan-500/50 shadow-glow-sm'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-white/5'
                }`}
              >
                {lang === 'en' ? item.en : item.hi}
              </motion.button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleLang}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{lang === 'en' ? 'हिंदी' : 'EN'}</span>
            </motion.button>

            {/* Mobile menu toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-cyan-300"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-veyron-navy/95 backdrop-blur-xl border-t cyber-border overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2 max-h-96 overflow-y-auto">
              {navItems.map((item, idx) => (
                <motion.button
                  key={item.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    setPage(item.key);
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    currentPage === item.key
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-cyan-300 hover:bg-white/5'
                  }`}
                >
                  {lang === 'en' ? item.en : item.hi}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
