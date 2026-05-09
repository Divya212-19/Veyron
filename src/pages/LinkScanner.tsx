import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, CheckCircle, XCircle, Loader2, Globe, Shield, Clock, Info } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { scanLink } from '../api';
import { recordUserActivity } from '../lib/userStats';

type Verdict = 'safe' | 'suspicious' | 'dangerous' | 'unknown' | null;

interface ScanResult {
  verdict: Verdict;
  threatType: string;
  confidence: number;
  domain: string;
  registeredDate: string;
  domainAge: string;
  registrar: string;
  maliciousCount: number;
  suspiciousCount: number;
  safeCount: number;
  undetectedCount: number;
  totalEngines: number;
  recommendation: string;
  details: string[];
  invalidDomain?: boolean;
  connectionStatus?: string;
}

const verdictConfig = {
  safe: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'SAFE', labelHi: 'सुरक्षित' },
  suspicious: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'SUSPICIOUS', labelHi: 'संदिग्ध' },
  dangerous: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'DANGEROUS', labelHi: 'खतरनाक' },
  unknown: { icon: Info, color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/30', label: 'UNKNOWN', labelHi: 'अज्ञात' },
};

export default function LinkScanner() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const { t } = useLang();

  async function scan() {
    if (!url.trim()) return;
    const normalizedUrl = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP(S) links are supported.');
      }
    } catch {
      setError(t('Please enter a valid full URL (for example: https://example.com).', 'कृपया एक सही पूर्ण URL दर्ज करें (उदाहरण: https://example.com)।'));
      setResult(null);
      return;
    }
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const data = await scanLink(normalizedUrl);
      const threats = Array.isArray(data.threats)
        ? data.threats.map((item: unknown) => (typeof item === 'string' ? item : JSON.stringify(item)))
        : [];
      const findings = Array.isArray(data.findings) && data.findings.length > 0
        ? data.findings.map((item: unknown) => (typeof item === 'string' ? item : JSON.stringify(item)))
        : (data.recommendations || [data.details || 'No additional details']).map((item: unknown) => (typeof item === 'string' ? item : JSON.stringify(item)));
      const verdict: Verdict = ['safe', 'suspicious', 'dangerous', 'unknown'].includes(data.verdict)
        ? data.verdict
        : 'unknown';
      recordUserActivity(
        'link',
        verdict === 'dangerous' ? 'dangerous' : verdict === 'suspicious' || verdict === 'unknown' ? 'suspicious' : 'safe',
        findings[0] || 'Scan completed.'
      );
      setResult({
        verdict,
        threatType: threats.join(', ') || 'None detected',
        confidence: Number(data.confidence ?? (data.verdict === 'dangerous' ? 0.95 : data.verdict === 'suspicious' ? 0.7 : 0.35)),
        domain: parsed.hostname,
        registeredDate: data.domainInfo?.registeredDate || 'Unknown',
        domainAge: data.domainInfo?.age || 'Unknown',
        registrar: 'Unknown',
        maliciousCount: Number(data.malicious_count ?? data.virusTotal?.stats?.malicious ?? 0),
        suspiciousCount: Number(data.suspicious_count ?? data.virusTotal?.stats?.suspicious ?? 0),
        safeCount: Number(data.safe_count ?? data.harmless_count ?? data.virusTotal?.stats?.harmless ?? 0),
        undetectedCount: Number(data.undetected_count ?? data.virusTotal?.stats?.undetected ?? 0),
        totalEngines: Number(data.total_engines ?? 0),
        recommendation: data.recommendations?.[0] || data.details || 'Proceed cautiously.',
        details: findings,
        invalidDomain: Boolean(data.invalid_domain),
        connectionStatus: typeof data.connection_status === 'string' ? data.connection_status : '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan link.');
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
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Search className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-white">{t('Link Scanner', 'लिंक स्कैनर')}</h1>
            <p className="text-slate-500">{t('Check any URL before you click', 'क्लिक करने से पहले URL जांचें')}</p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-white/5 backdrop-blur-xl border border-orange-500/20 rounded-xl p-4 mb-8 flex gap-3">
          <Info className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-400 text-sm">
            {t(
              'Never click suspicious links from unknown senders. Always scan first. Financial fraud links often impersonate banks and UPI apps.',
              'अनजान लोगों के संदिग्ध लिंक पर कभी क्लिक न करें। पहले स्कैन करें।'
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
            {t('Paste the suspicious URL', 'संदिग्ध URL यहाँ डालें')}
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setResult(null); }}
                onKeyDown={(e) => e.key === 'Enter' && scan()}
                placeholder="https://suspicious-link.com"
                className="w-full bg-[#060d1f] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>
        </motion.div>

        <button
          onClick={scan}
          disabled={loading || !url.trim()}
          className="w-full flex items-center justify-center gap-3 py-4 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{t('Scanning...', 'स्कैन हो रहा है...')}</>
          ) : (
            <><Shield className="w-5 h-5" />{t('Scan This Link', 'इस लिंक को स्कैन करें')}</>
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
            {/* Verdict */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
              <vConf.icon className={`w-10 h-10 ${vConf.color}`} />
              <div className="flex-1">
                <p className={`font-['Space_Grotesk'] text-2xl font-bold ${vConf.color}`}>
                  {t(vConf.label, vConf.labelHi)}
                </p>
                <p className="text-slate-500 text-sm mt-0.5">{result.threatType}</p>
                <p className="text-slate-500 text-xs mt-1">Confidence: {(result.confidence * 100).toFixed(0)}%</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">VirusTotal</p>
                <p className={`font-bold text-lg ${result.maliciousCount > 0 ? 'text-red-400' : result.suspiciousCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {result.maliciousCount + result.suspiciousCount}/{result.totalEngines || 0}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-red-400 font-bold text-lg">{result.maliciousCount}</p>
                <p className="text-slate-500 text-xs">Malicious</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-yellow-400 font-bold text-lg">{result.suspiciousCount}</p>
                <p className="text-slate-500 text-xs">Suspicious</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-green-400 font-bold text-lg">{result.safeCount}</p>
                <p className="text-slate-500 text-xs">Harmless</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-slate-300 font-bold text-lg">{result.undetectedCount}</p>
                <p className="text-slate-500 text-xs">Undetected</p>
              </div>
            </div>

            {/* Domain Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-slate-500 text-xs mb-1">{t('Domain', 'डोमेन')}</p>
                <p className="text-white text-sm font-medium truncate">{result.domain}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <p className="text-slate-500 text-xs">{t('Domain Age', 'डोमेन आयु')}</p>
                </div>
                <p className={`text-sm font-medium ${result.domainAge.includes('day') ? 'text-red-400' : 'text-green-400'}`}>
                  {result.domainAge}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-slate-500 text-xs mb-1">{t('Registered', 'पंजीकृत')}</p>
                <p className="text-white text-sm font-medium">{result.registeredDate}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-slate-500 text-xs mb-1">{t('Registrar', 'रजिस्ट्रार')}</p>
                <p className="text-white text-sm font-medium truncate">{result.registrar}</p>
              </div>
            </div>

            {/* Details */}
            <div className="mb-4">
              {result.invalidDomain ? (
                <p className="mb-3 rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-2 text-sm text-slate-300">
                  {t('Domain could not be reached or resolved. Treat this URL as unknown/invalid until verified from an official source.', 'डोमेन तक पहुंच या DNS सत्यापन नहीं हो सका। आधिकारिक स्रोत से सत्यापित होने तक इसे अज्ञात/अमान्य मानें।')}
                </p>
              ) : null}
              <p className="text-slate-400 text-sm font-medium mb-2">{t('Findings:', 'निष्कर्ष:')}</p>
              <ul className="space-y-1.5">
                {result.details.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${result.verdict === 'safe' ? 'bg-green-400' : result.verdict === 'suspicious' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendation */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-cyan-400 text-sm font-semibold mb-1">{t('Recommendation:', 'सिफारिश:')}</p>
              <p className="text-slate-300 text-sm">{result.recommendation}</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
