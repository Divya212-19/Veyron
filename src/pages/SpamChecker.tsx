import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, AlertTriangle, CheckCircle, XCircle, Loader2, Shield, Info, ExternalLink } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { checkEmail } from '../api';
import { recordUserActivity } from '../lib/userStats';

type Verdict = 'clean' | 'suspicious' | 'breached' | null;

interface SpamResult {
  verdict: Verdict;
  riskScore: number;
  breachesCount: number;
  summary: string;
  action: string;
  recommendations: string[];
  breaches: Array<{ name: string; date: string; exposedData: string[]; source?: string }>;
  warning?: string;
}

const verdictConfig = {
  clean: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'NO KNOWN BREACHES', labelHi: 'कोई ज्ञात ब्रीच नहीं' },
  suspicious: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'SUSPICIOUS', labelHi: 'संदिग्ध' },
  breached: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'BREACHED', labelHi: 'लीक हुआ' },
};

export default function SpamChecker() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpamResult | null>(null);
  const [error, setError] = useState('');
  const { t } = useLang();

  async function check() {
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const data = await checkEmail(email.trim());
      const rawBreaches = data.breaches ?? (Array.isArray(data.breaches_found) ? data.breaches_found : data.breachesFoundRaw) ?? data.breachesFound ?? [];
      const breachList = Array.isArray(rawBreaches) ? rawBreaches : [];
      const breachesFound = typeof data.breaches_found === 'boolean' ? data.breaches_found : breachList.length > 0;
      const isSafe = data.is_safe ?? data.isSafe ?? !breachesFound;
      const riskScore = data.risk_score ?? data.riskScore ?? 0;
      const verdict: Verdict = breachesFound ? 'breached' : isSafe ? 'clean' : 'suspicious';
      recordUserActivity(
        'email',
        verdict === 'clean' ? 'safe' : verdict === 'breached' ? 'dangerous' : 'suspicious',
        breachList.length
          ? `Found ${breachList.length} known breach record(s).`
          : 'No known breach records found.'
      );
      setResult({
        verdict,
        riskScore,
        breachesCount: breachList.length || 0,
        summary: t(
          data.englishSummary || 'Email breach status generated.',
          data.hindiSummary || 'ईमेल ब्रीच स्थिति तैयार हो गई।'
        ),
        action: data.recommendations?.[0] || 'Change password and enable 2FA.',
        recommendations: data.recommendations || [],
        warning: typeof data.warning === 'string' ? data.warning : '',
        breaches: breachList.map((b: { name?: string; service?: string; date?: string; exposedData?: string[]; exposed_data?: string[]; source?: string }) => ({
          name: b.service || b.name || 'Unknown',
          date: b.date || 'Unknown',
          exposedData: b.exposed_data || b.exposedData || [],
          source: b.source,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check email.';
      setError(
        message === 'Failed to fetch'
          ? t(
            'Cannot reach server right now. Please try again shortly.',
            'अभी सर्वर तक पहुंच नहीं हो पा रही है। कृपया थोड़ी देर बाद प्रयास करें।'
          )
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  const vConf = result?.verdict ? verdictConfig[result.verdict] : null;

  return (
    <div className="min-h-screen bg-[#060d1f] pt-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <Mail className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-white">{t('Email Breach Checker', 'ईमेल ब्रीच चेकर')}</h1>
            <p className="text-slate-500">{t('Check if your email was leaked in known breaches', 'जांचें कि आपका ईमेल डेटा लीक में शामिल था या नहीं')}</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-white/5 backdrop-blur-xl border border-teal-500/20 rounded-xl p-4 mb-8 flex gap-3">
          <Info className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-400 text-sm">
            {t(
              'Enter your email address to check whether it appears in known data breach sources.',
              'अपना ईमेल दर्ज करें और देखें कि क्या वह किसी ज्ञात डेटा ब्रीच में आया है।'
            )}
          </p>
        </div>

        {/* Input */}
        <motion.div
          whileHover={{ rotateX: -3, rotateY: 3 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="bg-white/5 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6"
        >
          <label className="text-slate-400 text-sm font-medium block mb-2">
            {t('Enter email address', 'ईमेल पता दर्ज करें')}
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setResult(null); }}
                onKeyDown={(e) => e.key === 'Enter' && check()}
                placeholder="your@email.com"
                className="w-full bg-[#060d1f] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
              />
            </div>
          </div>
        </motion.div>

        <button
          onClick={check}
          disabled={loading || !email.trim()}
          className="w-full flex items-center justify-center gap-3 py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-[#060d1f] font-bold text-base rounded-xl transition-all"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{t('Checking...', 'जांच हो रही है...')}</>
          ) : (
            <><Shield className="w-5 h-5" />{t('Check This Email', 'यह ईमेल जांचें')}</>
          )}
        </button>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        {/* Results */}
        {result && vConf && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-8 border rounded-2xl p-6 backdrop-blur-xl ${vConf.bg}`}
          >
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
              <vConf.icon className={`w-10 h-10 ${vConf.color}`} />
              <div className="flex-1">
                <p className={`font-['Space_Grotesk'] text-2xl font-bold ${vConf.color}`}>
                  {t(vConf.label, vConf.labelHi)}
                </p>
                <p className="text-slate-500 text-sm mt-0.5">
                  {t(
                    `${result.breachesCount} breach(es) found`,
                    `${result.breachesCount} ब्रीच रिकॉर्ड मिले`
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">{t('Risk Score', 'रिस्क स्कोर')}</p>
                <p className={`font-['Space_Grotesk'] font-bold text-2xl ${vConf.color}`}>{result.riskScore}%</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className={`font-['Space_Grotesk'] text-2xl font-bold ${vConf.color}`}>{result.breachesCount.toLocaleString()}</p>
                <p className="text-slate-500 text-xs mt-1">{t('Breaches', 'ब्रीच')}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                  <div className={`h-full rounded-full transition-all duration-1000 ${result.verdict === 'clean' ? 'bg-green-400' : result.verdict === 'suspicious' ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${result.riskScore}%` }} />
                </div>
                <p className="text-slate-500 text-xs">{t('Risk Level', 'जोखिम स्तर')}</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <p className="text-slate-300 text-sm">{result.summary}</p>
            </div>
            {result.warning ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <p className="text-yellow-300 text-sm">{result.warning}</p>
              </div>
            ) : null}

            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <p className="text-cyan-400 text-sm font-semibold mb-1">{t('What to do:', 'क्या करें:')}</p>
              <p className="text-slate-300 text-sm">{result.action}</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-teal-400 text-sm font-semibold mb-1">{t('Breach Details:', 'ब्रीच विवरण:')}</p>
              {result.breaches.length === 0 ? (
                <p className="text-slate-300 text-sm mb-2">
                  {t('No known breaches found for this email.', 'इस ईमेल के लिए कोई ज्ञात ब्रीच रिकॉर्ड नहीं मिला।')}
                </p>
              ) : (
                <ul className="space-y-2 mb-2">
                  {result.breaches.map((breach, idx) => (
                    <li key={`${breach.name}-${idx}`} className="text-slate-300 text-sm">
                      <span className="text-white font-medium">{breach.name}</span> ({breach.date}){' '}
                      {t(' - Exposed: ', ' - उजागर डेटा: ')}
                      {breach.exposedData.join(', ') || t('Unknown', 'अज्ञात')}
                      {breach.source ? <span className="text-slate-500"> - {breach.source}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {result.recommendations.length > 0 && (
                <p className="text-slate-300 text-sm mb-2">{result.recommendations.join(' | ')}</p>
              )}
              <a
                href="https://cybercrime.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-400 text-sm hover:text-teal-300 transition-colors"
              >
                {t('Report suspicious activity', 'संदिग्ध गतिविधि रिपोर्ट करें')}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>
        )}

        {/* Common Breach Safety Tips */}
        <div className="mt-12">
          <h3 className="text-slate-300 font-semibold mb-4">{t('Breach Safety Tips', 'ब्रीच सुरक्षा सुझाव')}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { pattern: t('Use unique passwords', 'अलग-अलग पासवर्ड रखें'), desc: t('Do not reuse one password across sites.', 'एक ही पासवर्ड हर जगह इस्तेमाल न करें।') },
              { pattern: t('Enable 2FA', '2FA ऑन करें'), desc: t('Turn on two-factor authentication for critical accounts.', 'महत्वपूर्ण खातों पर दो-स्तरीय सुरक्षा चालू करें।') },
              { pattern: t('Beware phishing', 'फिशिंग से सावधान'), desc: t('After breaches, scam emails increase significantly.', 'ब्रीच के बाद फर्जी ईमेल अक्सर बढ़ जाते हैं।') },
              { pattern: t('Monitor accounts', 'खातों की निगरानी करें'), desc: t('Watch for unauthorized logins and reset quickly.', 'अनाधिकृत लॉगिन दिखे तो तुरंत रीसेट करें।') },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
                <p className="text-orange-400 text-sm font-semibold mb-1">{item.pattern}</p>
                <p className="text-slate-500 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
