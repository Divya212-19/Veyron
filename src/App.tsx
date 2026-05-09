import { useEffect, useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CyberSaathi from './components/CyberSaathi';
import Home from './pages/Home';
import Emergency from './pages/Emergency';
import DeepfakeDetector from './pages/DeepfakeDetector';
import LinkScanner from './pages/LinkScanner';
import SpamChecker from './pages/SpamChecker';
import AppChecker from './pages/AppChecker';
import RootCause from './pages/RootCause';
import ComplaintHub from './pages/ComplaintHub';
import Awareness from './pages/Awareness';
import CinematicBackground from './components/premium/CinematicBackground';

type Page = 'home' | 'emergency' | 'deepfake' | 'scanner' | 'spam' | 'app' | 'rootcause' | 'complaints' | 'awareness';

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatEmergency, setChatEmergency] = useState(false);

  function navigate(p: string) {
    setPage(p as Page);
    window.scrollTo({ top: 0 });
  }

  function triggerEmergency() {
    navigate('emergency');
  }

  function openEmergencyChat() {
    setChatEmergency(true);
    setChatOpen(true);
  }

  useEffect(() => {
    const handler = (evt: Event) => {
      const custom = evt as CustomEvent<{ page?: string }>;
      if (custom.detail?.page) {
        navigate(custom.detail.page);
      }
    };
    window.addEventListener('cybersaathi:navigate', handler as EventListener);
    return () => window.removeEventListener('cybersaathi:navigate', handler as EventListener);
  }, []);

  const showNavAndFooter = page !== 'emergency';

  return (
    <div className="min-h-screen bg-[#060d1f] font-sans text-white relative overflow-x-hidden">
      <CinematicBackground />
      {showNavAndFooter && <Navbar currentPage={page} setPage={navigate} />}

      <main className="relative z-10">
        {page === 'home' && <Home setPage={navigate} triggerEmergency={triggerEmergency} />}
        {page === 'emergency' && <Emergency onOpenChat={openEmergencyChat} setPage={navigate} />}
        {page === 'deepfake' && <DeepfakeDetector />}
        {page === 'scanner' && <LinkScanner />}
        {page === 'spam' && <SpamChecker />}
        {page === 'app' && <AppChecker />}
        {page === 'rootcause' && <RootCause />}
        {page === 'complaints' && <ComplaintHub />}
        {page === 'awareness' && <Awareness />}
      </main>

      {showNavAndFooter && <Footer />}

      <CyberSaathi
        autoOpen={chatOpen}
        initialMode={chatEmergency ? 'emergency' : 'normal'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setChatOpen(false);
            setChatEmergency(false);
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
