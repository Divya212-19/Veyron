import { useState } from 'react';
import { TrendingUp, Loader2, Brain, Heart, Shield, ChevronRight, Info } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

interface Analysis {
  entryPoint: string;
  mechanism: string;
  psychTrick: string;
  validation: string;
  prevention: string[];
}

const scamPatterns: { keywords: string[]; result: Analysis }[] = [
  {
    keywords: ['upi', 'qr', 'paytm', 'gpay', 'phonepe', 'money', 'transfer', 'scan'],
    result: {
      entryPoint: 'UPI / QR Code Entry Point',
      mechanism: 'The scammer sent you a payment request disguised as a "receive money" QR code. Scanning it authorized a debit from your account instead of a credit. Many apps show a similar UI for both sending and receiving.',
      psychTrick: 'GREED + URGENCY — "Scan this QR to receive your refund/prize/payment." The promise of free money combined with time pressure disabled your critical thinking.',
      validation: 'Ye aapki galti nahi thi. Ye ek professionally engineered trap tha. Fraudsters practice these conversations hundreds of times before targeting you.',
      prevention: [
        'QR codes can ONLY debit money — never use them to "receive" payments',
        'Always verify payment requests by calling back on official numbers',
        'Use UPI PIN only when YOU initiate a payment',
        'Enable transaction SMS alerts from your bank',
        'Keep a low UPI transaction limit',
      ],
    },
  },
  {
    keywords: ['otp', 'call', 'bank', 'kyc', 'verify', 'account', 'block', 'update'],
    result: {
      entryPoint: 'Vishing (Voice Phishing) — Phone Call Attack',
      mechanism: 'A trained fraudster called posing as your bank official. They created a false emergency (KYC expiry, account block) and guided you to "resolve" it by sharing an OTP — which actually authorized a transaction.',
      psychTrick: 'AUTHORITY + FEAR — Fake official identity + fear of losing access to your money. Urgency ("you have 30 minutes") prevents you from thinking or verifying.',
      validation: 'Banks never call to ask for OTPs. This was a professionally designed social engineering attack. The scammer knew your name, possibly partial account details — making it seem legitimate.',
      prevention: [
        'Banks NEVER ask for OTP, CVV, or PIN over the phone — never',
        'Hang up and call back on the number on the back of your card',
        'Register on DND to reduce spam calls: 1909',
        'Add a mental rule: anyone asking for OTP = SCAMMER',
        'Use call recording to have evidence if scammed',
      ],
    },
  },
  {
    keywords: ['job', 'work', 'salary', 'earn', 'task', 'commission', 'investment', 'crypto', 'trading', 'profit', 'return'],
    result: {
      entryPoint: 'Fake Job / Investment Platform',
      mechanism: 'The scam worked in stages: first you were shown small real earnings to build trust. Then larger "investment" amounts were requested. The platform is fake — your "balance" exists only as numbers on a fraudulent website.',
      psychTrick: 'GREED + SOCIAL PROOF — "Others are making lakhs." Small initial payouts build trust. Once invested heavily, the platform disappears or demands more money for "withdrawal fees."',
      validation: 'Scammers invest months building your trust. They use professional websites, fake testimonials, and manipulated screenshots. This was not foolishness — it was sophisticated fraud.',
      prevention: [
        'Any scheme promising guaranteed returns above 2% monthly is likely a scam',
        'Verify company registration on MCA Portal before investing',
        'Never pay a "fee" to withdraw your own money',
        'Check SEBI and RBI registered entity lists',
        'Consult a SEBI-registered financial advisor',
      ],
    },
  },
  {
    keywords: ['video', 'nude', 'photo', 'blackmail', 'threat', 'share', 'intimate', 'sextortion', 'whatsapp call', 'nude call'],
    result: {
      entryPoint: 'Sextortion / Deepfake Blackmail',
      mechanism: 'An unknown contact initiated a video call. Screenshots were captured or deepfake was created. Threatening messages demand money to prevent sharing. This is a scripted, organized crime operation.',
      psychTrick: 'SHAME + FEAR — The scammer exploits social stigma. They claim to have your contacts and threaten viral exposure. The shame often prevents victims from reporting — exactly what scammers count on.',
      validation: 'You are one of thousands of victims of organized crime. Paying does NOT stop them — it signals you will pay more. The video/image may not even exist. You did nothing illegal. Reporting is the correct step.',
      prevention: [
        'Never accept video calls from unknown numbers',
        'Cover your camera for unknown calls',
        'If threatened — do NOT pay, do NOT respond',
        'Report immediately on cybercrime.gov.in',
        'Call iCall: 9152987821 for support — judgment-free',
        'Evidence: screenshot all messages before blocking',
      ],
    },
  },
  {
    keywords: ['app', 'install', 'apk', 'remote', 'anydesk', 'teamviewer', 'screen share', 'customer care'],
    result: {
      entryPoint: 'Remote Access Trojan / Fake Customer Care',
      mechanism: 'You were directed to install a "customer care" or "screen sharing" app. This gave the fraudster full control of your phone — they could see your banking apps, read OTPs, and authorize transactions without your knowledge.',
      psychTrick: 'AUTHORITY + HELPFULNESS — Posing as customer care, they "helped" you with a problem. Accepting screen share feels natural when you need support. The help is the trap.',
      validation: 'Legitimate customer care never asks you to install apps or share screens. This was a sophisticated impersonation attack. The fraudster likely had your number from a data breach.',
      prevention: [
        'Real customer care never asks to install any app',
        'Find official helpline numbers only from bank\'s official website',
        'Never share your screen with anyone for financial support',
        'Uninstall any screen-sharing apps immediately',
        'After such incident, factory reset your device',
      ],
    },
  },
];

function analyzeScam(desc: string): Analysis {
  const lower = desc.toLowerCase();
  for (const pattern of scamPatterns) {
    if (pattern.keywords.some((k) => lower.includes(k))) {
      return pattern.result;
    }
  }
  return {
    entryPoint: 'Social Engineering Attack',
    mechanism: 'Based on your description, this appears to be a sophisticated social engineering attack designed to exploit trust, urgency, or fear to extract money or personal information.',
    psychTrick: 'TRUST + URGENCY — Scammers create false relationships or emergencies to bypass rational decision-making. You were targeted because scammers identified a potential vulnerability.',
    validation: 'This was not your fault. Professional scam operations employ trained manipulators who work on hundreds of victims. The sophistication of the trap is what defines it, not the victim.',
    prevention: [
      'Verify all financial requests through official channels',
      'Take 24 hours before any financial decision from an unknown source',
      'When in doubt, call 1930 for guidance before acting',
      'Share awareness with family — older adults and first-time internet users are common targets',
      'Regularly check haveibeenpwned.com for email breaches',
    ],
  };
}

export default function RootCause() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const { t } = useLang();

  async function analyze() {
    if (!description.trim()) return;
    setLoading(true);
    setAnalysis(null);
    await new Promise((r) => setTimeout(r, 2000));
    setAnalysis(analyzeScam(description));
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#060d1f] pt-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-white">{t('Root Cause Explainer', 'कारण विश्लेषण')}</h1>
            <p className="text-slate-500">{t('Understand exactly what happened and how', 'समझें क्या हुआ और कैसे')}</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-8 flex gap-3">
          <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-400 text-sm">
            {t(
              'Describe what happened in your own words — Hindi, English, or Hinglish. We\'ll explain the mechanism, the psychological trick used, and how to prevent it next time.',
              'जो हुआ वो अपने शब्दों में बताएं — हिंदी, अंग्रेजी, या हिंगलिश में। हम तंत्र, मनोवैज्ञानिक चाल और बचाव बताएंगे।'
            )}
          </p>
        </div>

        {/* Input */}
        <div className="bg-[#0a1628] border border-slate-700/50 rounded-2xl p-6 mb-6">
          <label className="text-slate-400 text-sm font-medium block mb-2">
            {t('Describe what happened', 'क्या हुआ बताएं')}
          </label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setAnalysis(null); }}
            placeholder={t('e.g., Mujhe ek call aaya jo kehta tha main HDFC bank se hoon aur mera KYC update karna hai, unhone OTP manga...', 'जैसे: मुझे एक कॉल आया जो कह रहा था मैं HDFC बैंक से हूं...')}
            rows={5}
            className="w-full bg-[#060d1f] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
          />
          <p className="text-slate-600 text-xs mt-2">
            {t('Mention: type of contact, what they asked, what you did, how much was lost', 'बताएं: संपर्क का प्रकार, उन्होंने क्या मांगा, आपने क्या किया')}
          </p>
        </div>

        <button
          onClick={analyze}
          disabled={loading || !description.trim()}
          className="w-full flex items-center justify-center gap-3 py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{t('Analyzing...', 'विश्लेषण हो रहा है...')}</>
          ) : (
            <><Brain className="w-5 h-5" />{t('Analyze Root Cause', 'कारण विश्लेषण करें')}</>
          )}
        </button>

        {/* Quick examples */}
        {!analysis && (
          <div className="mt-8">
            <p className="text-slate-500 text-sm mb-3">{t('Quick examples:', 'त्वरित उदाहरण:')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                'I scanned a QR code to receive money',
                'Someone called from bank asking for OTP',
                'Got a job offer with daily task commission',
                'Video call blackmail on WhatsApp',
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setDescription(ex)}
                  className="px-3 py-1.5 bg-[#0a1628] border border-slate-700/50 hover:border-orange-500/30 text-slate-400 hover:text-white text-xs rounded-lg transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="mt-8 space-y-4">
            {/* Entry Point */}
            <div className="bg-[#0a1628] border border-orange-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ChevronRight className="w-5 h-5 text-orange-400" />
                <p className="text-orange-400 font-semibold text-sm">{t('Entry Point Exploited', 'कौन सा रास्ता इस्तेमाल हुआ')}</p>
              </div>
              <p className="text-white font-medium">{analysis.entryPoint}</p>
            </div>

            {/* Mechanism */}
            <div className="bg-[#0a1628] border border-blue-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-blue-400" />
                <p className="text-blue-400 font-semibold text-sm">{t('How the Scam Worked', 'स्कैम कैसे काम किया')}</p>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{analysis.mechanism}</p>
            </div>

            {/* Psych Trick */}
            <div className="bg-[#0a1628] border border-yellow-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                <p className="text-yellow-400 font-semibold text-sm">{t('Psychological Trick Used', 'मनोवैज्ञानिक चाल जो इस्तेमाल हुई')}</p>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{analysis.psychTrick}</p>
            </div>

            {/* Validation */}
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-5 h-5 text-cyan-400" />
                <p className="text-cyan-400 font-semibold text-sm">{t('This Was NOT Your Fault', 'यह आपकी गलती नहीं थी')}</p>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed italic">{analysis.validation}</p>
            </div>

            {/* Prevention */}
            <div className="bg-[#0a1628] border border-green-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-green-400" />
                <p className="text-green-400 font-semibold text-sm">{t('Prevention: Protect Yourself Next Time', 'बचाव: अगली बार खुद को बचाएं')}</p>
              </div>
              <ul className="space-y-2">
                {analysis.prevention.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
