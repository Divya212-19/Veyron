import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Link, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, Info, Sparkles } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { detectDeepfake } from '../api';
import { recordUserActivity } from '../lib/userStats';
import { GlassmorphicPanel, CyberGrid } from '../components/premium/PremiumUI';

type Verdict = 'fake' | 'real' | 'suspicious' | 'unverified' | null;
type InputMode = 'upload' | 'link';

interface DetectionSignalRow {
  signal: string;
  score: number;
  detail: string;
}

interface AnalysisResult {
  verdict: Verdict;
  decisiveVerdict: 'REAL' | 'AI GENERATED' | 'UNCERTAIN';
  verdictColor: 'green' | 'red' | 'yellow';
  verdictReason: string;
  assessment?: string;
  confidence: number;
  aiProbability: number;
  manipulationRisk: number;
  confidenceLevel?: string;
  detectionSignals: DetectionSignalRow[];
  metadataStatus?: string;
  suspiciousIndicators: string[];
  reason: string;
  manipulation: string[];
  action: string;
  context?: string;
}

const verdictConfig = {
  fake: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'HIGH SYNTHETIC RISK', labelHi: 'उच्च संश्लेषित जोखिम', bar: 'from-red-600 to-orange-500' },
  suspicious: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'REVIEW REQUIRED', labelHi: 'पुनः जाँच आवश्यक', bar: 'from-amber-500 to-yellow-400' },
  real: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'LIKELY AUTHENTIC', labelHi: 'संभवतः प्रामाणिक', bar: 'from-emerald-500 to-cyan-400' },
  unverified: { icon: Info, color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/30', label: 'INCONCLUSIVE / ERROR', labelHi: 'अनिर्णीत / त्रुटि', bar: 'from-slate-500 to-slate-400' },
};

const assessmentLabels: Record<string, { en: string; hi: string }> = {
  likely_real: { en: 'Assessment: Likely real capture', hi: 'आकलन: संभवतः वास्तविक फोटो' },
  possibly_ai_generated: { en: 'Assessment: Possible AI-generated imagery', hi: 'आकलन: संभावित AI-जनित छवि' },
  ai_generated: { en: 'Assessment: Strong synthetic cues', hi: 'आकलन: प्रबल संश्लेषित संकेत' },
  manipulated: { en: 'Assessment: Integrity / editing anomalies', hi: 'आकलन: संपादन/अखंडता असंगति' },
  inconclusive: { en: 'Assessment: Inconclusive — corroborate externally', hi: 'आकलन: अनिर्णीत — बाहरी पुष्टि करें' },
};

const metadataLabels: Record<string, { en: string; hi: string }> = {
  suspicious_or_ai_hint: { en: 'Metadata hints AI / generator tooling', hi: 'मेटाडेटा में AI/जनरेटर संकेत' },
  consistent_typical_camera: { en: 'Typical camera-style metadata', hi: 'सामान्य कैमरा मेटाडेटा' },
  incomplete_or_neutral: { en: 'Sparse or neutral metadata', hi: 'अपूर्ण या तटस्थ मेटाडेटा' },
  unknown: { en: 'Metadata unavailable', hi: 'मेटाडेटा अनुपलब्ध' },
};

export default function DeepfakeDetector() {
  const MAX_FILE_MB = 25;
  const [mode, setMode] = useState<InputMode>('upload');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useLang();

  async function analyze() {
    if (mode === 'upload' && !file) return;
    if (mode === 'link' && !url.trim()) return;
    if (mode === 'upload' && file && file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_MB}MB. Please upload a smaller file.`);
      return;
    }
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const data = await detectDeepfake(mode === 'upload' ? file : url.trim());
      const decisiveVerdictRaw = typeof data.verdict === 'string' ? data.verdict.toUpperCase() : '';
      const verdictFromLegacy = typeof data.legacy_verdict === 'string' ? data.legacy_verdict : data.verdict;
      const verdict =
        decisiveVerdictRaw === 'AI GENERATED'
          ? 'fake'
          : decisiveVerdictRaw === 'REAL'
            ? 'real'
            : decisiveVerdictRaw === 'UNCERTAIN'
              ? 'suspicious'
              : verdictFromLegacy === 'fake'
                ? 'fake'
                : verdictFromLegacy === 'suspicious'
                  ? 'suspicious'
                  : verdictFromLegacy === 'unverified'
                    ? 'unverified'
                    : 'real';
      const normalizedDecisiveVerdict: 'REAL' | 'AI GENERATED' | 'UNCERTAIN' =
        decisiveVerdictRaw === 'REAL' || decisiveVerdictRaw === 'AI GENERATED' || decisiveVerdictRaw === 'UNCERTAIN'
          ? decisiveVerdictRaw
          : verdict === 'fake'
            ? 'AI GENERATED'
            : verdict === 'real'
              ? 'REAL'
              : 'UNCERTAIN';
      const normalizedVerdictColor: 'green' | 'red' | 'yellow' =
        data.verdict_color === 'green' || data.verdict_color === 'red' || data.verdict_color === 'yellow'
          ? data.verdict_color
          : normalizedDecisiveVerdict === 'REAL'
            ? 'green'
            : normalizedDecisiveVerdict === 'AI GENERATED'
              ? 'red'
              : 'yellow';
      const normalizedReason =
        typeof data.verdict_reason === 'string' && data.verdict_reason.trim()
          ? data.verdict_reason
          : normalizedDecisiveVerdict === 'REAL'
            ? 'Signals mostly align with authentic image characteristics.'
            : normalizedDecisiveVerdict === 'AI GENERATED'
              ? 'ML and forensic indicators align with synthetic image patterns.'
              : 'Signals conflict or confidence is insufficient for a reliable determination.';
      recordUserActivity(
        'deepfake',
        verdict === 'fake' ? 'dangerous' : verdict === 'real' ? 'safe' : 'suspicious',
        data.details || 'Deepfake analysis completed.'
      );
      const calibRaw = Number(data.confidence_percent ?? data.confidenceScore ?? data.confidence ?? 0.55);
      const calibrationPct = Math.round(calibRaw <= 1 ? calibRaw * 100 : calibRaw);
      const signals: DetectionSignalRow[] = Array.isArray(data.detectionSignals)
        ? data.detectionSignals.map((row: { signal?: string; score?: number; detail?: string }) => ({
            signal: String(row.signal ?? ''),
            score: Number(row.score ?? 0),
            detail: String(row.detail ?? ''),
          }))
        : [];
      const indicators: string[] = Array.isArray(data.suspiciousIndicators)
        ? data.suspiciousIndicators.map((x: unknown) => String(x))
        : [];
      const chips = [...(data.findings || []), ...indicators].filter(Boolean);
      setResult({
        verdict,
        decisiveVerdict: normalizedDecisiveVerdict,
        verdictColor: normalizedVerdictColor,
        verdictReason: normalizedReason,
        assessment: typeof data.assessment === 'string' ? data.assessment : undefined,
        confidence: Math.min(100, Math.max(0, calibrationPct)),
        aiProbability: Math.min(100, Math.max(0, Number(data.aiProbability ?? 0))),
        manipulationRisk: Math.min(100, Math.max(0, Number(data.manipulationRisk ?? 0))),
        confidenceLevel: typeof data.confidenceLevel === 'string' ? data.confidenceLevel : undefined,
        detectionSignals: signals,
        metadataStatus: typeof data.metadataStatus === 'string' ? data.metadataStatus : undefined,
        suspiciousIndicators: indicators,
        reason: data.details || 'Forensic fusion analysis complete.',
        manipulation: chips.length ? chips : data.recommendations || [],
        action: t(data.englishSummary || 'Verify before sharing.', data.hindiSummary || 'साझा करने से पहले सत्यापित करें।'),
        context: `${data.details} Source: ${data.mediaUrl || (file?.name || 'unknown')}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deepfake analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  const verdictConf = result?.verdict ? verdictConfig[result.verdict] : null;
  const decisiveBadgeClass =
    result?.verdictColor === 'green'
      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
      : result?.verdictColor === 'red'
        ? 'bg-red-500/15 border-red-400/40 text-red-300'
        : 'bg-amber-500/15 border-amber-400/40 text-amber-300';

  return (
    <div className="min-h-screen bg-veyron-navy pt-16 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-32 right-1/3 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <CyberGrid />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <motion.div whileHover={{ scale: 1.1, rotate: 10 }} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-4 flex items-center justify-center shadow-cyber-lg">
              <Eye className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="font-grotesk text-4xl font-bold text-white mb-2">{t('Deepfake Detector', 'डीपफेक डिटेक्टर')}</h1>
              <p className="text-lg text-slate-300">{t('AI-Powered Media Authentication', 'AI-संचालित मीडिया प्रमाणीकरण')}</p>
            </div>
          </div>

          <GlassmorphicPanel hover={false} className="!p-4 !bg-blue-500/10 !border-blue-500/30">
            <div className="flex gap-4">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300 space-y-1">
                <p className="font-semibold text-blue-300">{t('About This Detector', 'इस डिटेक्टर के बारे में')}</p>
                <p>{t('Multi-signal forensic screen for still images (metadata, compression, texture, spectrum). Video files should be framed as keyframes — upload a sharp still for best results.', 'स्थिर छवियों के लिए बहु-संकेत फॉरेंसिक स्क्रीन (मेटाडेटा, संपीड़न, बनावट, स्पेक्ट्रम)। वीडियो के लिए स्पष्ट फ्रेम अपलोड करें।')}</p>
                <p className="text-yellow-300 text-xs mt-2">{t('⚠️ Advisory analysis only—not certified forensic proof. Uncertain cases are labeled inconclusive.', '⚠️ केवल सलाहकार विश्लेषण—प्रमाणित फॉरेंसिक प्रमाण नहीं। अनिश्चित मामले अनिर्णीत हो सकते हैं।')}</p>
              </div>
            </div>
          </GlassmorphicPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="inline-flex gap-2 p-1 bg-white/5 border border-cyan-500/20 rounded-xl">
            {[
              { mode: 'upload' as const, icon: Upload, en: 'Upload File', hi: 'फ़ाइल अपलोड' },
              { mode: 'link' as const, icon: Link, en: 'Paste URL', hi: 'URL डालें' },
            ].map((item) => (
              <motion.button
                key={item.mode}
                onClick={() => { setMode(item.mode); setResult(null); }}
                whileHover={{ scale: 1.05 }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === item.mode ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {t(item.en, item.hi)}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <GlassmorphicPanel hover={true} delay={0.2} className="!p-8">
            {mode === 'upload' ? (
              <div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); }} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl p-12 text-center transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 group-hover:from-cyan-500/10 transition-all" />
                  <div className="relative space-y-4">
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="flex justify-center">
                      <Upload className="w-12 h-12 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                    </motion.div>
                    {file ? (
                      <div>
                        <p className="text-white font-semibold text-lg">{file.name}</p>
                        <p className="text-slate-400 text-sm mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-cyan-300 font-semibold text-lg">{t('Drag image or video here', 'छवि या वीडियो यहां लाएं')}</p>
                        <p className="text-slate-400 text-sm mt-2">{t('or click to browse', 'या चुनने के लिए क्लिक करें')}</p>
                        <p className="text-slate-500 text-xs mt-3">{t('Still images preferred — JPG • PNG • WEBP • HEIC may vary (max 25MB)', 'स्थिर छवि अनुशंसित — JPG • PNG • WEBP (अधिकतम 25MB)')}</p>
                      </div>
                    )}
                  </div>
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-slate-300 text-sm font-semibold block">{t('Paste image or video URL', 'छवि या वीडियो URL डालें')}</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setResult(null); }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-veyron-navy border border-cyan-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:shadow-glow-sm transition-all"
                />
              </div>
            )}
          </GlassmorphicPanel>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={analyze}
          disabled={loading || (mode === 'upload' ? !file : !url.trim())}
          whileHover={{ scale: 1.02 }}
          className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all shadow-cyber-lg hover:shadow-cyber-xl"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('Analyzing...', 'विश्लेषण हो रहा है...')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {t('Analyze Media', 'मीडिया विश्लेषण करें')}
            </>
          )}
        </motion.button>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </motion.p>
        )}

        {result && verdictConf && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mt-12">
            <GlassmorphicPanel hover={false}>
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl border ${verdictConf.bg}`}>
                    <verdictConf.icon className={`w-8 h-8 ${verdictConf.color}`} />
                  </div>
                  <div>
                    <h2 className={`font-grotesk text-3xl font-bold ${verdictConf.color} mb-2`}>{t(verdictConf.label, verdictConf.labelHi)}</h2>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold mb-3 ${decisiveBadgeClass}`}>
                      <span>{t('Final Verdict', 'अंतिम निर्णय')}:</span>
                      <span>{result.decisiveVerdict}</span>
                    </div>
                    <p className="text-slate-300 text-sm mb-3">{result.verdictReason}</p>
                    {result.assessment && assessmentLabels[result.assessment] && (
                      <p className="text-slate-400 text-sm mb-4">{t(assessmentLabels[result.assessment].en, assessmentLabels[result.assessment].hi)}</p>
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs uppercase tracking-wide text-slate-500 w-44 shrink-0">{t('AI probability index', 'AI संभाव्यता सूचकांक')}</span>
                        <div className="flex-1 min-w-[140px] h-2.5 bg-slate-800/50 rounded-full overflow-hidden border border-orange-500/20">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${result.aiProbability}%` }} transition={{ duration: 1.2, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400" />
                        </div>
                        <span className="text-orange-300 font-mono text-sm w-12">{result.aiProbability}%</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs uppercase tracking-wide text-slate-500 w-44 shrink-0">{t('Manipulation risk', 'छेड़छाड़ जोखिम')}</span>
                        <div className="flex-1 min-w-[140px] h-2.5 bg-slate-800/50 rounded-full overflow-hidden border border-violet-500/20">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${result.manipulationRisk}%` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.08 }} className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" />
                        </div>
                        <span className="text-violet-300 font-mono text-sm w-12">{result.manipulationRisk}%</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs uppercase tracking-wide text-slate-500 w-44 shrink-0">{t('Screening certainty', 'स्क्रीनिंग निश्चितता')}</span>
                        <div className="flex-1 min-w-[140px] h-2.5 bg-slate-800/50 rounded-full overflow-hidden border border-cyan-500/20">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }} className={`h-full rounded-full bg-gradient-to-r ${verdictConf.bar}`} />
                        </div>
                        <span className="text-cyan-300 font-mono text-sm w-12">{result.confidence}%</span>
                      </div>
                      {result.confidenceLevel && (
                        <p className="text-xs text-slate-500">
                          {t('Inter-signal agreement:', 'संकेतों में सहमति:')}{' '}
                          <span className="text-slate-300 font-semibold capitalize">{result.confidenceLevel}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 border-t border-slate-700/50 pt-6">
                {result.metadataStatus && metadataLabels[result.metadataStatus] && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-cyan-400 font-semibold shrink-0">{t('Metadata', 'मेटाडेटा')}:</span>
                    <span className="text-slate-300">{t(metadataLabels[result.metadataStatus].en, metadataLabels[result.metadataStatus].hi)}</span>
                  </div>
                )}
                <div>
                  <p className="text-cyan-300 text-sm font-semibold mb-2">{t('Analysis Details', 'विश्लेषण विवरण')}</p>
                  <p className="text-slate-300">{result.reason}</p>
                </div>

                {result.detectionSignals.length > 0 && (
                  <div>
                    <p className="text-cyan-300 text-sm font-semibold mb-3">{t('Signal breakdown', 'संकेत विवरण')}</p>
                    <div className="rounded-xl border border-slate-600/40 overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{t('Signal', 'संकेत')}</th>
                            <th className="px-3 py-2 font-semibold w-24">{t('Score', 'स्कोर')}</th>
                            <th className="px-3 py-2 font-semibold">{t('Notes', 'टिप्पणी')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {result.detectionSignals.map((row, i) => (
                            <tr key={`${row.signal}-${i}`} className="bg-slate-950/40 hover:bg-slate-900/60">
                              <td className="px-3 py-2 text-slate-200 font-mono">{row.signal}</td>
                              <td className="px-3 py-2 text-amber-300/90 font-mono">{row.score.toFixed(3)}</td>
                              <td className="px-3 py-2 text-slate-400">{row.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="px-3 py-2 text-[10px] text-slate-500 bg-slate-900/60 border-t border-slate-700/50">
                        {t('Scores near 1 lean synthetic/edited; near 0 lean authentic. 0.5 is neutral.', '1 के निकट संश्लेषित/संपादित; 0 के निकट प्रामाणिक। 0.5 तटस्थ।')}
                      </p>
                    </div>
                  </div>
                )}

                {result.manipulation.length > 0 && (
                  <div>
                    <p className="text-cyan-300 text-sm font-semibold mb-3">{t('Highlights & indicators', 'मुख्य संकेत')}</p>
                    <div className="flex flex-wrap gap-2">
                      {result.manipulation.map((m, i) => (
                        <span key={i} className="px-3 py-1.5 bg-slate-800/80 border border-cyan-500/25 text-cyan-100/90 text-xs rounded-lg font-medium max-w-full break-words">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <p className="text-cyan-300 text-sm font-semibold mb-2">{t('Recommended Action', 'अनुशंसित कार्रवाई')}</p>
                  <p className="text-slate-300">{result.action}</p>
                </div>
              </div>
            </GlassmorphicPanel>
          </motion.div>
        )}
      </div>
    </div>
  );
}
