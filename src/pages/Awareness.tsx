import { useMemo, useState } from 'react';
import { BookOpen, ChevronRight, CheckCircle, XCircle, Trophy, Eye } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const scamTypes = [
  {
    id: 'upi',
    title: 'UPI / QR Code Fraud',
    titleHi: 'UPI / QR कोड धोखाधड़ी',
    mechanism: 'Fraudsters share a QR code or payment request claiming it will deposit money into your account. Scanning it actually authorizes a debit from your account.',
    mechanismHi: 'धोखेबाज QR कोड या भुगतान अनुरोध साझा करते हैं, यह दावा करते हुए कि यह आपके खाते में पैसे जमा करेगा।',
    redFlags: ['Anyone asks you to scan QR to receive money', '"Payment failed, scan again"', 'Refund through QR code'],
    prevention: ['QR codes only debit money — never credit', 'Use UPI ID for receiving payments', 'Verify in your bank app'],
    color: 'border-red-500/30',
    tag: 'HIGH RISK',
    tagColor: 'bg-red-500/20 text-red-400',
  },
  {
    id: 'otp',
    title: 'OTP / Vishing Fraud',
    titleHi: 'OTP / विशिंग धोखाधड़ी',
    mechanism: 'Callers impersonate bank officials, police, or government employees. They create a false emergency (KYC expiry, account block) and ask for OTP to "solve" the issue.',
    mechanismHi: 'कॉलर बैंक अधिकारी, पुलिस या सरकारी कर्मचारी का रूप धरते हैं। झूठी आपात स्थिति बनाकर OTP मांगते हैं।',
    redFlags: ['Unsolicited call from "bank"', '"Your KYC will expire in 2 hours"', '"To unblock your account, share OTP"'],
    prevention: ['Banks NEVER ask for OTP', 'Hang up and call official number', 'Register on DND: 1909'],
    color: 'border-orange-500/30',
    tag: 'VERY COMMON',
    tagColor: 'bg-orange-500/20 text-orange-400',
  },
  {
    id: 'job',
    title: 'Fake Job / Part-Time Task Scam',
    titleHi: 'फेक नौकरी / पार्ट-टाइम टास्क स्कैम',
    mechanism: 'Victims are recruited for "simple tasks" (like YouTube likes). Small initial payments build trust. Then victims are asked to invest larger amounts for "task upgrades" which disappear.',
    mechanismHi: 'पीड़ितों को "सरल कार्य" के लिए भर्ती किया जाता है। शुरुआती छोटे भुगतान विश्वास बनाते हैं, फिर बड़े निवेश के लिए कहा जाता है।',
    redFlags: ['Contacted on WhatsApp for work', '"Earn Rs 2000/day from home"', 'Asked to join Telegram channel for tasks'],
    prevention: ['No legitimate job requires advance payment', 'Verify company on MCA portal', 'Never invest to earn more'],
    color: 'border-yellow-500/30',
    tag: 'GROWING TREND',
    tagColor: 'bg-yellow-500/20 text-yellow-400',
  },
  {
    id: 'sextortion',
    title: 'Sextortion / Deepfake Blackmail',
    titleHi: 'सेक्सटॉर्शन / डीपफेक ब्लैकमेल',
    mechanism: 'Unknown contacts initiate video calls or send messages. Screenshots or deepfake content is created. Victims are threatened with viral sharing unless payment is made.',
    mechanismHi: 'अज्ञात संपर्क वीडियो कॉल शुरू करते हैं। स्क्रीनशॉट या डीपफेक सामग्री बनाई जाती है। भुगतान न होने पर वायरल करने की धमकी दी जाती है।',
    redFlags: ['Unknown contact requests video call', 'Attractive profile with very few posts', '"I have your recording — pay or I share it"'],
    prevention: ['Never accept video calls from unknown numbers', 'DO NOT pay — it encourages more demands', 'Report on cybercrime.gov.in immediately'],
    color: 'border-purple-500/30',
    tag: 'SENSITIVE',
    tagColor: 'bg-slate-500/20 text-slate-400',
  },
  {
    id: 'loan',
    title: 'Predatory Loan App Scam',
    titleHi: 'प्रीडेटरी लोन ऐप स्कैम',
    mechanism: 'Fake loan apps promise instant loans. After granting access to contacts and photos, they charge hidden fees and harass victims by sending morphed photos to all contacts.',
    mechanismHi: 'नकली लोन ऐप तत्काल ऋण का वादा करते हैं। संपर्कों और फ़ोटो तक पहुंच देने के बाद, वे छिपे शुल्क लगाते हैं और morphed फ़ोटो भेजकर परेशान करते हैं।',
    redFlags: ['Loan approved in 5 minutes', 'App requests access to contacts and photos', '"Processing fee" before loan disbursal'],
    prevention: ['Verify lender on RBI SACHET portal', 'Never grant contact/photo permissions to loan apps', 'Report to sachet.rbi.org.in'],
    color: 'border-green-500/30',
    tag: 'HIGH RISK',
    tagColor: 'bg-red-500/20 text-red-400',
  },
  {
    id: 'investment',
    title: 'Fake Investment / Crypto Scam',
    titleHi: 'नकली निवेश / क्रिप्टो स्कैम',
    mechanism: 'Sophisticated fake trading platforms show guaranteed returns. Small withdrawals work initially. Once large deposits are made, the platform freezes withdrawals claiming "taxes" or "upgrade fees".',
    mechanismHi: 'नकली ट्रेडिंग प्लेटफॉर्म गारंटीड रिटर्न दिखाते हैं। शुरुआत में छोटी निकासी होती है। बड़ी जमा के बाद प्लेटफॉर्म "टैक्स" का बहाना बनाकर निकासी बंद कर देता है।',
    redFlags: ['"Double your money in 30 days"', 'WhatsApp group with fake profit screenshots', 'Platform not registered with SEBI'],
    prevention: ['Verify with SEBI at sebi.gov.in', 'No legitimate investment guarantees returns', 'If you cannot withdraw easily — it is a scam'],
    color: 'border-cyan-500/30',
    tag: 'HIGH LOSS',
    tagColor: 'bg-red-500/20 text-red-400',
  },
];

const beginnerQuizImages = [
  { id: 1, isReal: false, imageUrl: 'https://images.pexels.com/photos/3184298/pexels-photo-3184298.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Look at the skin texture and hairline boundaries', explanation: 'This image shows subtle blending artifacts around the hairline and inconsistent skin texture — common signs of AI face-swapping technology.' },
  { id: 2, isReal: true, imageUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Check natural lighting and shadow consistency', explanation: 'Natural lighting, consistent shadows, and authentic skin texture. Authentic images show imperfections that AI currently struggles to replicate naturally.' },
  { id: 3, isReal: false, imageUrl: 'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Notice the background and edge quality', explanation: 'Background blurring inconsistencies and unnatural edge transitions between subject and background indicate AI generation.' },
  { id: 4, isReal: true, imageUrl: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Look at eye reflection and facial asymmetry', explanation: 'Natural facial asymmetry, authentic eye reflections, and organic skin texture — signs of a genuine photograph.' },
];

const intermediateQuizImages = [
  { id: 11, isReal: false, imageUrl: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Check facial edges around ears and neck', explanation: 'Subtle cutout artifacts and uneven blending near the ears/neck often indicate generated or manipulated media.' },
  { id: 12, isReal: true, imageUrl: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Observe texture consistency in skin and clothing', explanation: 'Natural texture variation and realistic lighting transitions suggest this image is authentic.' },
  { id: 13, isReal: false, imageUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Compare object geometry and perspective', explanation: 'Distorted perspective and inconsistent depth cues are common in AI-generated composites.' },
  { id: 14, isReal: true, imageUrl: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Check natural imperfections and asymmetry', explanation: 'Asymmetry and fine imperfections are strong signs of real-world photography.' },
];

const advancedQuizImages = [
  { id: 21, isReal: false, imageUrl: 'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Look for unnatural micro-details in eyes and teeth', explanation: 'Over-smoothed micro-details and inconsistent reflections are subtle indicators of synthetic generation.' },
  { id: 22, isReal: true, imageUrl: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Evaluate reflection behavior and texture noise', explanation: 'Natural image noise and physically consistent highlights indicate authenticity.' },
  { id: 23, isReal: false, imageUrl: 'https://images.pexels.com/photos/1092671/pexels-photo-1092671.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Inspect background detail coherence', explanation: 'Background coherence breaks and edge anomalies are strong signals of generated image composition.' },
  { id: 24, isReal: true, imageUrl: 'https://images.pexels.com/photos/774095/pexels-photo-774095.jpeg?auto=compress&cs=tinysrgb&w=600', hint: 'Check multi-point lighting realism', explanation: 'Lighting falloff and shadow behavior are physically plausible throughout the scene, indicating a real image.' },
];

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export default function Awareness() {
  const [expandedScam, setExpandedScam] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<boolean | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const { t } = useLang();

  const activeQuizSet = useMemo(() => {
    const pool = difficulty === 'beginner'
      ? beginnerQuizImages
      : difficulty === 'intermediate'
        ? intermediateQuizImages
        : advancedQuizImages;
    return [...pool].sort(() => Math.random() - 0.5);
  }, [difficulty]);

  function handleQuizAnswer(answer: boolean) {
    const current = activeQuizSet[quizIndex];
    const correct = answer === current.isReal;
    setQuizAnswer(answer);
    if (correct) setQuizScore((s) => s + 1);

    setTimeout(() => {
      if (quizIndex < activeQuizSet.length - 1) {
        setQuizIndex((i) => i + 1);
        setQuizAnswer(null);
      } else {
        setQuizCompleted(true);
      }
    }, 2500);
  }

  function resetQuiz(nextDifficulty: Difficulty = difficulty) {
    setDifficulty(nextDifficulty);
    setQuizIndex(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizCompleted(false);
  }

  const currentQuiz = activeQuizSet[quizIndex];
  const canPromote =
    quizCompleted
    && quizScore / activeQuizSet.length >= 0.75
    && difficulty !== 'advanced';
  const nextDifficulty: Difficulty =
    difficulty === 'beginner' ? 'intermediate' : 'advanced';

  return (
    <div className="min-h-screen bg-[#060d1f] pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-white">{t('Awareness Center', 'जागरूकता केंद्र')}</h1>
            <p className="text-slate-500">{t('Learn about cyber threats. Protect yourself and your family.', 'साइबर खतरों के बारे में जानें। खुद को और परिवार को बचाएं।')}</p>
          </div>
        </div>

        {/* Scam Library */}
        <section className="mb-16">
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white mb-6">{t('Scam Type Library', 'स्कैम प्रकार लाइब्रेरी')}</h2>
          <div className="space-y-3">
            {scamTypes.map((scam) => (
              <div key={scam.id} className={`bg-[#0a1628] border ${scam.color} rounded-2xl overflow-hidden`}>
                <button
                  onClick={() => setExpandedScam(expandedScam === scam.id ? null : scam.id)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white font-semibold text-sm">{t(scam.title, scam.titleHi)}</span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${scam.tagColor}`}>{scam.tag}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedScam === scam.id ? 'rotate-90' : ''}`} />
                </button>

                {expandedScam === scam.id && (
                  <div className="px-4 pb-5 border-t border-white/5 pt-4 space-y-4">
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{t('How it works', 'कैसे काम करता है')}</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{t(scam.mechanism, scam.mechanismHi)}</p>
                    </div>
                    <div>
                      <p className="text-red-400 text-xs font-medium uppercase tracking-wider mb-2">{t('Red Flags', 'खतरे के संकेत')}</p>
                      <ul className="space-y-1">
                        {scam.redFlags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                            <span className="text-red-500 font-bold flex-shrink-0">!</span>{flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-green-400 text-xs font-medium uppercase tracking-wider mb-2">{t('Prevention', 'बचाव')}</p>
                      <ul className="space-y-1">
                        {scam.prevention.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />{tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Deepfake Quiz */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-6 h-6 text-cyan-400" />
            <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white">
              {t('Deepfake Spotting Quiz', 'डीपफेक पहचान क्विज़')}
            </h2>
            <span className="ml-auto text-slate-500 text-sm capitalize">{difficulty}</span>
            <span className="text-slate-500 text-sm">{quizIndex + 1}/{activeQuizSet.length}</span>
          </div>

          {!quizCompleted ? (
            <div className="bg-[#0a1628] border border-cyan-500/20 rounded-2xl p-6">
              <p className="text-slate-400 text-sm mb-4">
                {t('Is this image REAL or AI-GENERATED (Fake)?', 'क्या यह छवि असली है या AI-निर्मित (नकली)?')}
              </p>
              <div className="relative mb-4 rounded-xl overflow-hidden">
                <img src={currentQuiz.imageUrl} alt="Quiz" className="w-full h-64 sm:h-80 object-cover" />
                {quizAnswer !== null && (
                  <div className={`absolute inset-0 flex items-center justify-center ${quizAnswer === currentQuiz.isReal ? 'bg-green-500/40' : 'bg-red-500/40'}`}>
                    {quizAnswer === currentQuiz.isReal ? (
                      <CheckCircle className="w-16 h-16 text-green-300" />
                    ) : (
                      <XCircle className="w-16 h-16 text-red-300" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4 p-3 bg-white/5 rounded-xl">
                <Eye className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <p className="text-slate-400 text-sm">{t('Hint:', 'संकेत:')} {currentQuiz.hint}</p>
              </div>

              {quizAnswer === null ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleQuizAnswer(true)}
                    className="py-3.5 bg-green-500/10 border border-green-500/30 text-green-400 font-bold rounded-xl hover:bg-green-500/20 transition-all"
                  >
                    {t('REAL', 'असली')}
                  </button>
                  <button
                    onClick={() => handleQuizAnswer(false)}
                    className="py-3.5 bg-red-500/10 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-500/20 transition-all"
                  >
                    {t('AI FAKE', 'AI नकली')}
                  </button>
                </div>
              ) : (
                <div className={`p-4 rounded-xl ${quizAnswer === currentQuiz.isReal ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <p className={`font-bold mb-1 ${quizAnswer === currentQuiz.isReal ? 'text-green-400' : 'text-red-400'}`}>
                    {quizAnswer === currentQuiz.isReal ? t('Correct!', 'सही!') : t('Incorrect!', 'गलत!')}
                    {' '}{t('This image is', 'यह छवि')} {currentQuiz.isReal ? t('REAL', 'असली') : t('AI-GENERATED', 'AI-निर्मित')}
                  </p>
                  <p className="text-slate-400 text-sm">{currentQuiz.explanation}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#0a1628] border border-cyan-500/20 rounded-2xl p-8 text-center">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white mb-2">
                {quizScore}/{activeQuizSet.length} {t('Correct', 'सही')}
              </h3>
              <p className="text-slate-400 mb-6">
                {quizScore >= 3
                  ? t('Excellent! You have a sharp eye for deepfakes.', 'उत्कृष्ट! आपकी नजर तेज है।')
                  : t('Keep practicing — deepfake technology is getting better every day.', 'अभ्यास जारी रखें — डीपफेक तकनीक हर दिन बेहतर हो रही है।')}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => resetQuiz()} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-[#060d1f] font-bold rounded-xl transition-all">
                  {t('Try Again', 'फिर कोशिश करें')}
                </button>
                {canPromote ? (
                  <button
                    onClick={() => resetQuiz(nextDifficulty)}
                    className="px-6 py-3 bg-white/5 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl hover:bg-cyan-500/10 transition-all"
                  >
                    {t(`Move to ${nextDifficulty}`, `${nextDifficulty} स्तर पर जाएं`)}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        {/* Shareable Tips */}
        <section>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white mb-6">
            {t('Share Awareness — Protect Your Family', 'जागरूकता फैलाएं — परिवार को बचाएं')}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { tip: 'OTP is like your ATM PIN — NEVER share it with anyone, ever.', tipHi: 'OTP आपके ATM PIN की तरह है — इसे कभी किसी के साथ शेयर न करें।', icon: '🔐' },
              { tip: 'QR codes can only TAKE money. They cannot SEND money to you.', tipHi: 'QR कोड सिर्फ पैसे लेते हैं। वे आपको पैसे नहीं भेज सकते।', icon: '📲' },
              { tip: 'If someone promises guaranteed returns — it is 100% a scam.', tipHi: 'अगर कोई गारंटीड रिटर्न का वादा करे — यह 100% स्कैम है।', icon: '💰' },
              { tip: 'Real banks never call asking for passwords, PINs, or OTPs.', tipHi: 'असली बैंक कभी पासवर्ड, PIN या OTP के लिए कॉल नहीं करते।', icon: '🏦' },
              { tip: 'If threatened online — do NOT pay. Report on cybercrime.gov.in.', tipHi: 'ऑनलाइन धमकी मिले — पैसे न दें। cybercrime.gov.in पर रिपोर्ट करें।', icon: '⚠️' },
              { tip: 'Always download apps from official Play Store only. Never from WhatsApp.', tipHi: 'ऐप्स हमेशा आधिकारिक Play Store से डाउनलोड करें। WhatsApp से कभी नहीं।', icon: '📱' },
            ].map((item, i) => (
              <div key={i} className="bg-[#0a1628] border border-slate-700/50 hover:border-cyan-500/20 rounded-2xl p-4 transition-all">
                <span className="text-2xl block mb-2">{item.icon}</span>
                <p className="text-slate-300 text-sm leading-relaxed">{t(item.tip, item.tipHi)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
