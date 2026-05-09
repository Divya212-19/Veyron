import { motion } from 'framer-motion';
import { Shield, Globe, AlertCircle } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import logo from '/image.png';

export default function Footer() {
  const { t } = useLang();

  const footerSections = [
    {
      title: { en: 'Emergency', hi: 'आपातकाल' },
      icon: AlertCircle,
      items: [
        { text: { en: 'National Cyber Helpline: 1930', hi: 'राष्ट्रीय साइबर: 1930' }, link: 'tel:1930' },
        { text: { en: 'Cybercrime Portal', hi: 'साइबर क्राइम पोर्टल' }, link: 'https://cybercrime.gov.in' },
        { text: { en: 'iCall Support: 9152987821', hi: 'iCall: 9152987821' } },
      ],
    },
    {
      title: { en: 'Tools', hi: 'उपकरण' },
      icon: Shield,
      items: [
        { text: { en: 'Deepfake Detector', hi: 'डीपफेक डिटेक्टर' } },
        { text: { en: 'Link Scanner', hi: 'लिंक स्कैनर' } },
        { text: { en: 'App Checker', hi: 'ऐप चेकर' } },
        { text: { en: 'Email Breach Check', hi: 'ईमेल चेक' } },
      ],
    },
    {
      title: { en: 'File Complaint', hi: 'शिकायत दर्ज करें' },
      icon: Globe,
      items: [
        { text: { en: 'Cybercrime.gov.in', hi: 'Cybercrime.gov.in' }, link: 'https://cybercrime.gov.in' },
        { text: { en: 'RBI Complaints', hi: 'RBI शिकायत' }, link: 'https://cms.rbi.org.in' },
        { text: { en: 'Consumer Helpline', hi: 'उपभोक्ता हेल्पलाइन' }, link: 'https://consumerhelpline.gov.in' },
      ],
    },
  ];

  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-gradient-to-b from-veyron-navy to-veyron-teal border-t border-cyan-500/20 mt-16 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        {/* Brand Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 pb-8 border-b border-cyan-500/10"
        >
          <div className="flex items-center gap-3 mb-4">
            <img src={logo} alt="Veyron" className="h-12 w-12 object-contain drop-shadow-[0_0_8px_rgba(0,224,255,0.6)]" />
            <span className="font-grotesk font-bold text-2xl text-white tracking-wider">VEYRON</span>
          </div>
          <p className="text-cyan-300 text-sm leading-relaxed max-w-2xl">
            {t(
              "India's One-Stop Cyber Safety Platform. Detect threats, calm panic, guide victims, and protect communities.",
              "भारत का वन-स्टॉप साइबर सेफ्टी प्लेटफॉर्म। खतरों का पता लगाएं, घबराहट शांत करें, पीड़ितों को गाइड करें।"
            )}
          </p>
        </motion.div>

        {/* Footer Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {footerSections.map((section, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <section.icon className="w-4 h-4 text-cyan-400" />
                </div>
                <h4 className="text-cyan-300 font-grotesk font-semibold text-sm uppercase tracking-wider">
                  {t(section.title.en, section.title.hi)}
                </h4>
              </div>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i}>
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-cyan-300 text-sm transition-colors"
                      >
                        {t(item.text.en, item.text.hi)}
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">
                        {t(item.text.en, item.text.hi)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-cyan-500/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-xs">
            {t('© 2024 Veyron. Your Safety. Our Priority.', '© 2024 Veyron. आपकी सुरक्षा, हमारी जिम्मेदारी।')}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              {t('Always Active', 'हमेशा सक्रिय')}
            </span>
            <span className="text-slate-600">
              {t('Built for Bharat. Powered by AI.', 'भारत के लिए बनाया। AI से संचालित।')}
            </span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
