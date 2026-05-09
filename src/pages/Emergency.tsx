import { useState } from 'react';
import { Phone, Copy, CheckCircle, ChevronRight, ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { supabase, getSessionId } from '../lib/supabase';

interface EmergencyProps {
  onOpenChat: () => void;
  setPage: (page: string) => void;
}

type Step = 'calm' | 'select' | 'action' | 'draft' | 'saathi';

const incidentTypes = [
  { id: 'upi', en: 'UPI / Bank Fraud', hi: 'UPI / बैंक धोखाधड़ी', icon: '💳', color: 'border-red-500/40 hover:bg-red-500/10' },
  { id: 'otp', en: 'Fake Call / OTP Scam', hi: 'फेक कॉल / OTP स्कैम', icon: '📞', color: 'border-orange-500/40 hover:bg-orange-500/10' },
  { id: 'app', en: 'Fake App Installed', hi: 'फेक ऐप इंस्टॉल हुई', icon: '📱', color: 'border-yellow-500/40 hover:bg-yellow-500/10' },
  { id: 'sextortion', en: 'Sextortion / Blackmail / Deepfake', hi: 'सेक्सटॉर्शन / ब्लैकमेल / डीपफेक', icon: '⚠️', color: 'border-purple-500/40 hover:bg-purple-500/10' },
  { id: 'job', en: 'Fake Job / Investment Scam', hi: 'फेक नौकरी / निवेश स्कैम', icon: '💼', color: 'border-blue-500/40 hover:bg-blue-500/10' },
  { id: 'other', en: 'Something Else', hi: 'कुछ और', icon: '🆘', color: 'border-slate-500/40 hover:bg-slate-500/10' },
];

const actionData: Record<string, { firstAction: { en: string; hi: string }; banks: { name: string; steps: string[] }[]; upi: { name: string; steps: string[] }[] }> = {
  upi: {
    firstAction: { en: 'Call 1930 immediately — do this in the next 5 minutes!', hi: 'तुरंत 1930 पर कॉल करें — अभी 5 मिनट में करें!' },
    banks: [
      { name: 'SBI', steps: ['Call 1800-11-2211', 'Say "Block account" / "Fraudulent transaction"', 'Request immediate hold on last transaction'] },
      { name: 'HDFC', steps: ['Call 1800-202-6161', 'Navigate to "Block account"', 'Use NetBanking → My Account → Report Fraud'] },
      { name: 'ICICI', steps: ['Call 1800-1080', 'Report unauthorized transaction', 'Block debit card via iMobile'] },
      { name: 'Axis', steps: ['Call 1800-419-5555', 'Request fraud block', 'Block via Axis Mobile App → Services'] },
      { name: 'PNB', steps: ['Call 1800-180-2222', 'Report fraud transaction', 'Visit branch with Aadhaar for urgent block'] },
      { name: 'Kotak', steps: ['Call 1860-266-2666', 'Report unauthorized transaction', 'Block via Kotak app → Service Requests'] },
    ],
    upi: [
      { name: 'PhonePe', steps: ['Open app → Help → Report a Fraud', 'Call PhonePe: 080-68727374', 'Block disputed transaction in app'] },
      { name: 'GPay', steps: ['Open GPay → Profile → Support', 'Report transaction as fraudulent', 'Contact your bank to reverse'] },
      { name: 'Paytm', steps: ['Open Paytm → Help & Support', '24/7 helpline: 0120-4456-456', 'Report Fraud under transaction details'] },
      { name: 'BHIM', steps: ['Call NPCI: 1800-120-1740', 'File complaint on bhimupi.com', 'Contact your linked bank immediately'] },
    ],
  },
  otp: {
    firstAction: { en: 'Do NOT share more OTPs. Call your bank to freeze account NOW.', hi: 'और OTP शेयर न करें। अभी बैंक को कॉल करके खाता फ्रीज करें।' },
    banks: [
      { name: 'SBI', steps: ['Call 1800-11-2211 immediately', 'Say your OTP was shared with a fraudster', 'Request account freeze'] },
      { name: 'All Banks', steps: ['Call national helpline 1930', 'File report on cybercrime.gov.in', 'Change all passwords immediately'] },
    ],
    upi: [],
  },
  app: {
    firstAction: { en: 'Do NOT open the suspicious app. Revoke its permissions immediately.', hi: 'संदिग्ध ऐप न खोलें। तुरंत उसकी अनुमतियां रद्द करें।' },
    banks: [],
    upi: [
      { name: 'Revoke Permissions', steps: ['Settings → Apps → [App Name] → Permissions', 'Disable ALL permissions especially contacts, messages, camera', 'Then uninstall the app'] },
      { name: 'After Uninstall', steps: ['Change passwords on all accounts from a DIFFERENT device', 'Enable 2FA on all important accounts', 'Check bank account for unauthorized transactions'] },
    ],
  },
  sextortion: {
    firstAction: { en: 'Do NOT pay. Do NOT respond. Screenshot everything. You are NOT alone.', hi: 'पैसे न दें। जवाब न दें। सब कुछ स्क्रीनशॉट करें। आप अकेले नहीं हैं।' },
    banks: [],
    upi: [
      { name: 'Immediate Steps', steps: ['Block the sender on all platforms', 'Save all evidence — screenshots, chat logs', 'Report on cybercrime.gov.in → Report Other Cyber Crime'] },
      { name: 'Report & Support', steps: ['File complaint at cybercrime.gov.in', 'Call iCall for emotional support: 9152987821', 'Contact nearest cyber police station'] },
    ],
  },
  job: {
    firstAction: { en: 'Stop all communication with the fraudster. Do not send any more money.', hi: 'धोखेबाज से सभी संपर्क बंद करें। और पैसे न भेजें।' },
    banks: [
      { name: 'If Money Transferred', steps: ['Call 1930 immediately', 'Contact your bank to reverse transaction', 'File complaint on cybercrime.gov.in within 24 hours'] },
    ],
    upi: [
      { name: 'Evidence Collection', steps: ['Screenshot all conversations', 'Note down all phone numbers and account details', 'Save job offer documents as PDF'] },
    ],
  },
  other: {
    firstAction: { en: 'Call the National Cyber Helpline: 1930 — available 24/7', hi: 'राष्ट्रीय साइबर हेल्पलाइन पर कॉल करें: 1930 — 24/7 उपलब्ध' },
    banks: [],
    upi: [
      { name: 'Universal Steps', steps: ['Call 1930 for guidance', 'File on cybercrime.gov.in', 'Document everything — screenshots and details'] },
    ],
  },
};

const draftTemplates: Record<string, string> = {
  upi: `To,
The Station House Officer,
Cyber Crime Police Station

Subject: Complaint Regarding Online UPI/Banking Fraud

Respected Sir/Madam,

I, [YOUR FULL NAME], aged [AGE], residing at [YOUR ADDRESS], hereby lodge a formal complaint regarding an online financial fraud committed against me.

On [DATE], I was defrauded of Rs. [AMOUNT] through UPI/online banking. The fraudster [describe how contact was made]. I was misled into making the transfer/sharing my OTP under the false pretext of [reason given by fraudster].

Transaction Details:
- Date & Time: [DATE AND TIME]
- Amount: Rs. [AMOUNT]
- Transaction ID/UTR: [ID]
- Fraudster's Account/UPI: [DETAILS IF KNOWN]
- Phone Number Used: [NUMBER IF KNOWN]

I request you to:
1. Register an FIR against the fraudster
2. Initiate action to freeze the fraudster's account
3. Help recover the defrauded amount

I am attaching all relevant screenshots and transaction details.

Thanking you,
[YOUR FULL NAME]
[DATE]
[MOBILE NUMBER]`,

  otp: `To,
The Station House Officer,
Cyber Crime Police Station

Subject: Complaint Regarding OTP Fraud / Vishing Attack

Respected Sir/Madam,

I, [YOUR FULL NAME], residing at [YOUR ADDRESS], wish to report an OTP fraud committed against me.

On [DATE], I received a call from [PHONE NUMBER] claiming to be from [BANK/ORGANIZATION NAME]. The caller convinced me to share my OTP under the pretext of [reason given — KYC update/account verification/etc.].

After sharing the OTP, Rs. [AMOUNT] was debited from my account without my authorization.

I request an FIR be registered and appropriate action be taken against the fraudster.

Yours faithfully,
[YOUR FULL NAME]
[DATE]`,

  sextortion: `To,
The Station House Officer,
Cyber Crime Police Station

Subject: Complaint Regarding Sextortion/Cyber Blackmail

Respected Sir/Madam,

I, [YOUR FULL NAME], wish to report a case of cyber blackmail/sextortion.

I was contacted by a person/group via [PLATFORM — WhatsApp/Instagram/etc.] on [DATE]. They obtained [describe how — video call/photos/etc.] and are now threatening to share this content unless I pay Rs. [AMOUNT].

I have NOT made any payment. I am providing all available screenshots and communication evidence.

I request immediate action, including:
1. Identification and arrest of the perpetrators
2. Removal of any uploaded content
3. Legal protection for my privacy

I am attaching all evidence herewith.

Yours sincerely,
[YOUR FULL NAME]
[DATE]`,

  other: `To,
The Station House Officer,
Cyber Crime Police Station

Subject: Complaint Regarding Cyber Fraud

Respected Sir/Madam,

I, [YOUR FULL NAME], residing at [YOUR ADDRESS], wish to report a cyber fraud.

[DESCRIBE YOUR INCIDENT IN DETAIL — what happened, how, when, how much lost]

I request you to register an FIR and take appropriate legal action.

Yours faithfully,
[YOUR FULL NAME]
[DATE]
[CONTACT NUMBER]`,
};

export default function Emergency({ onOpenChat, setPage }: EmergencyProps) {
  const [step, setStep] = useState<Step>('calm');
  const [selectedType, setSelectedType] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draft, setDraft] = useState('');
  const { t } = useLang();

  function handleIncidentSelect(id: string) {
    setSelectedType(id);
    setStep('action');
  }

  async function generateDraft() {
    setGeneratingDraft(true);
    const template = draftTemplates[selectedType] || draftTemplates.other;
    await new Promise((r) => setTimeout(r, 1500));
    setDraft(template);
    setGeneratingDraft(false);

    await supabase.from('emergency_reports').insert({
      session_id: getSessionId(),
      incident_type: selectedType,
      description: selectedType,
      complaint_draft: template,
    });

    setStep('draft');
  }

  function copyDraft() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const actions = actionData[selectedType] || actionData.other;
  const incident = incidentTypes.find((i) => i.id === selectedType);

  return (
    <div className="min-h-screen bg-[#09050a] pt-16">
      {/* Step: Calm */}
      {step === 'calm' && (
        <div className="fixed inset-0 z-40 bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.28),rgba(9,5,10,1)_55%)] flex items-center justify-center px-6">
          <div className="max-w-lg text-center">
            <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center animate-pulse-subtle">
              <svg viewBox="0 0 100 100" className="w-10 h-10">
                <circle cx="50" cy="50" r="35" fill="none" stroke="#f87171" strokeWidth="4" strokeDasharray="20 10" />
              </svg>
            </div>
            <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
              {t('Don\'t panic.', 'घबराओ मत।')}
            </h1>
            <p className="text-xl text-red-300 font-medium mb-2">
              {t('You\'re in the right place.', 'आप सही जगह आए हैं।')}
            </p>
            <p className="text-slate-400 text-lg mb-10">
              {t('The next 5 minutes are critical. We\'re here.', 'अगले 5 मिनट बहुत महत्वपूर्ण हैं। हम साथ हैं।')}
            </p>
            <p className="text-slate-500 text-sm mb-8">
              {t(
                'Take a deep breath. You are safe here. Veyron will guide you through every step.',
                'गहरी साँस लें। आप यहाँ सुरक्षित हैं। Veyron आपको हर कदम पर मार्गदर्शन देगा।'
              )}
            </p>
            <button
              onClick={() => setStep('select')}
              className="px-10 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-lg rounded-2xl transition-all duration-200 shadow-2xl shadow-red-900/50"
            >
              {t('I\'m ready — Show me what to do', 'मैं तैयार हूँ — आगे बताओ')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Select incident */}
      {step === 'select' && (
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setStep('calm')} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white">
                {t('What happened?', 'क्या हुआ?')}
              </h2>
              <p className="text-red-200/70 text-sm">{t('Select the type of incident', 'घटना का प्रकार चुनें')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {incidentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleIncidentSelect(type.id)}
                className={`bg-[#0a1628] border ${type.color} rounded-2xl p-5 text-left transition-all duration-200 group`}
              >
                <span className="text-3xl mb-3 block">{type.icon}</span>
                <p className="text-white font-semibold text-sm mb-1">{t(type.en, type.hi)}</p>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Action Panel */}
      {step === 'action' && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setStep('select')} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white">
                {incident && t(incident.en, incident.hi)}
              </h2>
              <p className="text-red-200/70 text-sm">{t('Immediate action steps', 'तत्काल कार्रवाई के कदम')}</p>
            </div>
          </div>

          {/* Priority Action */}
          <div className="bg-gradient-to-r from-red-950/45 to-rose-950/30 border border-red-500/45 rounded-2xl p-5 mb-6 flex items-start gap-4 shadow-[0_0_28px_rgba(220,38,38,0.20)] animate-pulse-subtle">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold text-sm mb-1">{t('DO THIS FIRST', 'पहले यह करें')}</p>
              <p className="text-white font-semibold">{t(actions.firstAction.en, actions.firstAction.hi)}</p>
              <a href="tel:1930" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all">
                <Phone className="w-4 h-4" />
                {t('Call 1930 Now', '1930 पर कॉल करें')}
              </a>
            </div>
          </div>

          {/* Bank Steps */}
          {actions.banks.length > 0 && (
            <div className="mb-6">
              <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                {t('Bank-wise Account Freeze Steps', 'बैंक-वार खाता फ्रीज कदम')}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {actions.banks.map((bank, i) => (
                  <div key={i} className="bg-[#0a1628] border border-slate-700/50 rounded-xl p-4">
                    <p className="text-red-300 font-semibold text-sm mb-2">{bank.name}</p>
                    <ol className="space-y-1">
                      {bank.steps.map((step, j) => (
                        <li key={j} className="text-slate-400 text-xs flex gap-2">
                          <span className="text-red-400 font-bold flex-shrink-0">{j + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPI Steps */}
          {actions.upi.length > 0 && (
            <div className="mb-6">
              <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                {selectedType === 'upi' ? t('UPI App Steps', 'UPI ऐप कदम') : t('Next Steps', 'अगले कदम')}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {actions.upi.map((item, i) => (
                  <div key={i} className="bg-[#0a1628] border border-slate-700/50 rounded-xl p-4">
                    <p className="text-rose-300 font-semibold text-sm mb-2">{item.name}</p>
                    <ol className="space-y-1">
                      {item.steps.map((s, j) => (
                        <li key={j} className="text-slate-400 text-xs flex gap-2">
                          <span className="text-rose-400 font-bold flex-shrink-0">{j + 1}.</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={generateDraft}
              disabled={generatingDraft}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/40"
            >
              {generatingDraft ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t('Generating complaint...', 'शिकायत बन रही है...')}</>
              ) : (
                <>{t('Generate Complaint Draft', 'शिकायत ड्राफ्ट बनाएं')} <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
            <button
              onClick={() => { onOpenChat(); }}
              className="flex-1 py-3.5 bg-[#0f101d] border border-red-500/35 text-red-300 font-semibold rounded-xl hover:bg-red-500/10 transition-all"
            >
              {t('Talk to CyberSaathi', 'CyberSaathi से बात करें')}
            </button>
            <button
              onClick={() => setPage('home')}
              className="flex-1 py-3.5 bg-[#0a1628] border border-slate-600 text-slate-300 font-semibold rounded-xl hover:bg-slate-800 transition-all"
            >
              {t('Return to Dashboard', 'डैशबोर्ड पर लौटें')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Draft */}
      {step === 'draft' && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setStep('action')} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white">
                {t('Your Complaint Draft', 'आपका शिकायत ड्राफ्ट')}
              </h2>
              <p className="text-slate-500 text-sm">{t('Fill in the [bracketed] details and submit', '[ब्रैकेट] में विवरण भरें और जमा करें')}</p>
            </div>
          </div>

          <div className="bg-[#0f101d] border border-red-500/25 rounded-2xl p-6 mb-6">
            <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{draft}</pre>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <button
              onClick={copyDraft}
              className="flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl transition-all"
            >
              {copied ? <><CheckCircle className="w-4 h-4" />{t('Copied!', 'कॉपी हुआ!')}</> : <><Copy className="w-4 h-4" />{t('Copy Complaint', 'शिकायत कॉपी करें')}</>}
            </button>
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 bg-[#0f101d] border border-red-500/35 text-red-300 font-semibold rounded-xl hover:bg-red-500/10 transition-all"
            >
              {t('Submit on cybercrime.gov.in', 'cybercrime.gov.in पर जमा करें')}
            </a>
          </div>

          <button
            onClick={() => { setStep('saathi'); onOpenChat(); }}
            className="w-full py-4 bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/40"
          >
            {t('Continue with CyberSaathi — I still have questions', 'CyberSaathi के साथ जारी रखें — मेरे और सवाल हैं')}
          </button>
          <button
            onClick={() => setPage('home')}
            className="w-full mt-3 py-3.5 bg-[#0a1628] border border-slate-600 text-slate-300 font-semibold rounded-xl hover:bg-slate-800 transition-all"
          >
            {t('Return to Dashboard', 'डैशबोर्ड पर लौटें')}
          </button>
        </div>
      )}
    </div>
  );
}
