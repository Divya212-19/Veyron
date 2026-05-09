import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, Loader2, AlertTriangle } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { chatWithSaathi } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickActions?: Array<{ type: string; target: string; label: string }>;
}
type ChatLanguage = 'English' | 'हिंदी';

interface CyberSaathiProps {
  autoOpen?: boolean;
  initialMode?: 'emergency' | 'normal';
  onOpenChange?: (open: boolean) => void;
}

export default function CyberSaathi({ autoOpen = false, initialMode = 'normal', onOpenChange }: CyberSaathiProps) {
  const [open, setOpen] = useState(autoOpen);
  const { lang, t } = useLang();
  const [selectedLanguage, setSelectedLanguage] = useState<ChatLanguage>('English');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialMode === 'emergency'
        ? t(
          'I am here with you. Tell me what happened and I will guide you step by step for immediate recovery.',
          'मैं आपके साथ हूँ। बताइए क्या हुआ—मैं आपको तुरंत रिकवरी के लिए कदम-दर-कदम मार्गदर्शन दूँगा/दूँगी।'
        )
        : t(
          'Hello! I am CyberSaathi. I can help you with scams, phishing, fake apps, and cyber safety.',
          'नमस्ते! मैं CyberSaathi हूँ। मैं स्कैम, फिशिंग, नकली ऐप्स और साइबर सुरक्षा में आपकी मदद कर सकता/सकती हूँ।'
        ),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(autoOpen);
  }, [autoOpen]);

  function openChat() {
    setOpen(true);
    onOpenChange?.(true);
  }

  function closeChat() {
    setOpen(false);
    onOpenChange?.(false);
  }

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    setSelectedLanguage(lang === 'en' ? 'English' : 'हिंदी');
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setError('');

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMsg, timestamp: new Date() },
    ]);

    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const data = await chatWithSaathi(userMsg, history, selectedLanguage);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            data.response ||
            (selectedLanguage === 'English'
              ? 'Something went wrong. Please try again in a moment.'
              : 'कुछ समस्या हो गई। कृपया थोड़ी देर बाद फिर से प्रयास करें।'),
          timestamp: new Date(),
          quickActions: Array.isArray(data.quickActions) ? data.quickActions : [],
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Network issue. Please try again.', 'नेटवर्क समस्या। कृपया दोबारा प्रयास करें।')
      );
    } finally {
      setLoading(false);
    }
  }

  function formatContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <strong key={i} className="text-cyan-300">{line.slice(2, -2)}</strong>;
      }
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-cyan-300">{part.slice(2, -2)}</strong>
              : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <motion.button
          onClick={openChat}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400 to-blue-500 text-[#04131f] font-bold px-4 py-3 shadow-[0_16px_45px_rgba(0,224,255,0.35)] transition-all duration-200"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">CyberSaathi</span>
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.97 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed bottom-4 right-4 z-50 w-[350px] sm:w-[400px] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-cyan-500/20 bg-[#0a1628]/90 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0d1f3c] to-[#0a1628] border-b border-cyan-500/20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(0,224,255,0.18),transparent_45%)] opacity-60" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">CyberSaathi</p>
                <p className="text-cyan-400 text-xs">{t('Always here for you', 'हमेशा आपके साथ')}</p>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-2">
              {/* Language follows the global app language (EN/HI) */}
              <button
                type="button"
                onClick={closeChat}
                className="text-slate-500 hover:text-white transition-colors"
                aria-label={t('Close chat', 'चैट बंद करें')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[300px] max-h-[500px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-cyan-500 text-[#060d1f] font-medium rounded-tr-sm'
                      : 'bg-[#0d1f3c] text-slate-200 border border-cyan-500/10 rounded-tl-sm'
                  }`}
                >
                  {formatContent(msg.content)}
                  {msg.quickActions && msg.quickActions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.quickActions.map((action, idx) => (
                        action.type === 'navigate' ? (
                          <button
                            key={`${action.label}-${idx}`}
                            onClick={() => window.dispatchEvent(new CustomEvent('cybersaathi:navigate', { detail: { page: action.target } }))}
                            className="text-xs px-2 py-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                          >
                            {action.label}
                          </button>
                        ) : (
                          <a
                            key={`${action.label}-${idx}`}
                            href={action.type === 'call' ? `tel:${action.target}` : action.target}
                            target={action.target.startsWith('http') ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                          >
                            {action.label}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#0d1f3c] border border-cyan-500/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-300 bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Crisis Banner */}
          <div className="px-4 py-2 bg-orange-900/20 border-t border-orange-500/20 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
            <p className="text-orange-300 text-xs">
              {t('Crisis support: iCall 9152987821', 'संकट सहायता: iCall 9152987821')}
            </p>
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-cyan-500/10 bg-[#060d1f]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={t('Type your question...', 'अपना सवाल लिखें...')}
                className="flex-1 bg-[#0a1628] border border-cyan-500/20 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="p-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-[#060d1f] rounded-xl transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
