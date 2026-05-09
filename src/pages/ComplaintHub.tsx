import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, MapPin, Clock, ExternalLink, Copy, CheckCircle, Loader2, Phone, ChevronDown, ChevronUp, Mail, Navigation } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { getCyberCell, getHelplines } from '../api';

const portals = [
  {
    id: 'cybercrime',
    name: 'National Cyber Crime Reporting Portal',
    shortName: 'cybercrime.gov.in',
    url: 'https://cybercrime.gov.in',
    icon: '🚔',
    color: 'border-red-500/30',
    badge: 'PRIMARY',
    badgeColor: 'bg-red-500/20 text-red-400',
    useCase: 'All cyber crimes — FIR, online fraud, sextortion, fake apps, data theft',
    steps: ['Visit cybercrime.gov.in', 'Click "Report Cyber Crime"', 'Select complaint type', 'Fill in details and upload evidence', 'Note your complaint number (SIR No.)'],
    phone: null,
  },
  {
    id: 'helpline',
    name: 'National Cyber Crime Helpline',
    shortName: '1930',
    url: 'tel:1930',
    icon: '📞',
    color: 'border-orange-500/30',
    badge: 'CALL NOW',
    badgeColor: 'bg-orange-500/20 text-orange-400',
    useCase: 'Financial fraud only — call within 60 minutes for highest recovery chance',
    steps: ['Call 1930 immediately', 'Have your transaction ID and bank account ready', 'Request freezing of fraudster\'s account', 'Get your reference number', 'Follow up with cybercrime.gov.in complaint'],
    phone: '1930',
  },
  {
    id: 'npci',
    name: 'NPCI UPI Dispute Redressal',
    shortName: 'npci.org.in',
    url: 'https://www.npci.org.in/what-we-do/upi/dispute-redressal-mechanism',
    icon: '💠',
    color: 'border-indigo-500/30',
    badge: 'UPI',
    badgeColor: 'bg-indigo-500/20 text-indigo-300',
    useCase: 'UPI fraud transaction disputes and escalation support',
    steps: ['Visit NPCI UPI dispute page', 'Use your bank/PSP complaint reference', 'Submit UPI transaction details', 'Track complaint through PSP/bank and NPCI route'],
    phone: null,
  },
  {
    id: 'rbi',
    name: 'RBI Complaint Management System',
    shortName: 'cms.rbi.org.in',
    url: 'https://cms.rbi.org.in',
    icon: '🏦',
    color: 'border-blue-500/30',
    badge: 'BANKING',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    useCase: 'UPI fraud, unauthorized bank transactions, banker misconduct',
    steps: ['Visit cms.rbi.org.in', 'Select "Lodge a Complaint"', 'Choose complaint category: "Digital Transactions"', 'Fill bank details and fraud amount', 'Attach screenshots and transaction proof'],
    phone: null,
  },
  {
    id: 'googleplay',
    name: 'Google Play — Report Harmful App',
    shortName: 'play.google.com',
    url: 'https://support.google.com/googleplay/android-developer/contact/policy_violation_report',
    icon: '📲',
    color: 'border-emerald-500/30',
    badge: 'APP REPORT',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    useCase: 'Report fake/malicious Android apps and impersonation apps',
    steps: ['Open Google Play policy violation report form', 'Share app link/package and evidence', 'Describe fraud behavior', 'Submit and keep report reference'],
    phone: null,
  },
  {
    id: 'certin',
    name: 'CERT-In',
    shortName: 'cert-in.org.in',
    url: 'https://www.cert-in.org.in',
    icon: '🔐',
    color: 'border-cyan-500/30',
    badge: 'TECHNICAL',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
    useCase: 'Malware, phishing websites, data breaches, ransomware, hacking',
    steps: ['Visit cert-in.org.in', 'Click "Report Incident"', 'Fill incident report form', 'Upload technical evidence', 'CERT-In investigates and takedowns phishing sites'],
    phone: null,
  },
  {
    id: 'ncw',
    name: 'National Commission for Women',
    shortName: 'ncw.nic.in',
    url: 'https://ncw.nic.in',
    icon: '🆘',
    color: 'border-rose-500/30',
    badge: 'WOMEN SUPPORT',
    badgeColor: 'bg-rose-500/20 text-rose-300',
    useCase: 'Women-focused abuse, harassment, blackmail and online exploitation support',
    steps: ['Visit ncw.nic.in', 'Open complaint registration section', 'Submit abuse/harassment details', 'Attach screenshots and evidence'],
    phone: null,
  },
  {
    id: 'trai',
    name: 'TRAI DND / Telecom Complaints',
    shortName: 'trai.gov.in',
    url: 'https://www.trai.gov.in',
    icon: '📡',
    color: 'border-teal-500/30',
    badge: 'TELECOM',
    badgeColor: 'bg-teal-500/20 text-teal-400',
    useCase: 'SIM swap fraud, spam calls, unwanted commercial SMS',
    steps: ['Call 1909 or SMS "START DND" to 1909', 'For SIM swap fraud — file at cybercrime.gov.in AND visit your telecom store', 'Report spam calls via TRAI DND app', 'File formal complaint on trai.gov.in'],
    phone: '1909',
  },
  {
    id: 'consumer',
    name: 'National Consumer Helpline',
    shortName: 'consumerhelpline.gov.in',
    url: 'https://consumerhelpline.gov.in',
    icon: '🛒',
    color: 'border-yellow-500/30',
    badge: 'CONSUMER',
    badgeColor: 'bg-yellow-500/20 text-yellow-400',
    useCase: 'Fake e-commerce, online shopping fraud, fake delivery, app overcharging',
    steps: ['Call 1800-11-4000 (toll free)', 'Or visit consumerhelpline.gov.in', 'Select "E-Commerce" category', 'Fill details with screenshots', 'Track status online'],
    phone: '1800-11-4000',
  },
  {
    id: 'sachet',
    name: 'SACHET Portal — RBI',
    shortName: 'sachet.rbi.org.in',
    url: 'https://sachet.rbi.org.in',
    icon: '💰',
    color: 'border-green-500/30',
    badge: 'LOAN FRAUD',
    badgeColor: 'bg-green-500/20 text-green-400',
    useCase: 'Unauthorized loan apps, illegal money lending, predatory interest, loan harassment',
    steps: ['Visit sachet.rbi.org.in', 'Click "Complaint against unauthorized entity"', 'Enter loan app name or company', 'Describe harassment or fraud', 'RBI takes action against illegal lenders'],
    phone: null,
  },
  {
    id: 'ncpcr',
    name: 'NCPCR — Child Safety',
    shortName: 'ncpcr.gov.in',
    url: 'https://ncpcr.gov.in',
    icon: '👶',
    color: 'border-pink-500/30',
    badge: 'CHILD',
    badgeColor: 'bg-pink-500/20 text-pink-400',
    useCase: 'Online child abuse, CSAM, child trafficking online, cyber bullying of minors',
    steps: ['Visit ncpcr.gov.in', 'Use e-Baal Nidan portal for online complaints', 'Attach evidence carefully', 'NCPCR coordinates with cyber police'],
    phone: '1098',
  },
];

const FINANCIAL_INCIDENTS = new Set(['upi_fraud', 'loan_fraud']);

const CATEGORY_PORTAL_IDS: Record<string, string[]> = {
  upi_fraud: ['cybercrime', 'rbi', 'npci'],
  fake_app: ['cybercrime', 'googleplay', 'certin'],
  deepfake: ['cybercrime', 'certin'],
  sextortion: ['cybercrime', 'ncw', 'ncpcr'],
  job_scam: ['cybercrime', 'consumer'],
  loan_fraud: ['cybercrime', 'rbi'],
};

function generateDraft(incident: string): string {
  const templates: Record<string, string> = {
    financial: `To,
The Station House Officer,
Cyber Crime Police Station

Subject: Complaint Regarding Online Financial Fraud

Respected Sir/Madam,

I, [YOUR FULL NAME], aged [AGE], residing at [YOUR ADDRESS], hereby lodge a formal complaint regarding online financial fraud committed against me on [DATE].

[DESCRIBE YOUR INCIDENT IN DETAIL]

Amount lost: Rs. [AMOUNT]
Transaction Reference: [ID IF ANY]
Fraudster Contact: [PHONE/EMAIL IF KNOWN]

I request you to:
1. Register an FIR
2. Initiate recovery proceedings
3. Take legal action against perpetrators

Yours faithfully,
[YOUR NAME] | [DATE] | [PHONE]`,
    general: `To,
The Station House Officer,
Cyber Crime Police Station

Subject: Complaint Regarding Cyber Crime

Respected Sir/Madam,

I, [YOUR FULL NAME], residing at [YOUR ADDRESS], wish to report the following cyber crime incident:

Date of Incident: [DATE]
Nature of Crime: [DESCRIBE WHAT HAPPENED]
Evidence Available: [LIST SCREENSHOTS, RECORDINGS, ETC.]

I request immediate action and registration of an FIR.

Yours faithfully,
[YOUR NAME] | [DATE] | [CONTACT]`,
  };
  return incident.toLowerCase().includes('money') || incident.toLowerCase().includes('upi') || incident.toLowerCase().includes('bank')
    ? templates.financial
    : templates.general;
}

interface CyberOffice {
  city: string;
  address: string;
  phone: string;
  email: string;
  lat?: number;
  lng?: number;
  distanceKm?: number | null;
  googleMapsLink?: string;
}

interface CyberCellData {
  state: string;
  type: string;
  region: string;
  hq: CyberOffice;
  nearestOffice: CyberOffice;
  offices: CyberOffice[];
  states: string[];
  metadata?: { source?: string; sourceUrl?: string; lastVerified?: string };
}

export default function ComplaintHub() {
  const [expandedPortal, setExpandedPortal] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [incidentType, setIncidentType] = useState('upi_fraud');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [helplineLoading, setHelplineLoading] = useState(false);
  const [helplineError, setHelplineError] = useState('');
  const [helplineData, setHelplineData] = useState<{
    portals?: Array<{ name: string; url: string; purpose: string; stepByStep: string[] }>;
    nearestCyberCell?: { state?: string; address?: string; phone?: string; email?: string; googleMapsLink?: string };
  } | null>(null);
  const [cyberCell, setCyberCell] = useState<CyberCellData | null>(null);
  const [cyberCellLoading, setCyberCellLoading] = useState(false);
  const [cyberCellError, setCyberCellError] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { t } = useLang();

  useEffect(() => {
    let active = true;
    async function fetchHelplines() {
      setHelplineLoading(true);
      setHelplineError('');
      try {
        const data = await getHelplines(incidentType, selectedState);
        if (active) {
          setHelplineData(data);
        }
      } catch (err) {
        if (active) {
          setHelplineError(t('Could not load live helplines right now. Showing built-in guidance.', 'लाइव हेल्पलाइन अभी लोड नहीं हो सकी। बिल्ट-इन गाइडेंस दिखाया जा रहा है।'));
          setHelplineData(null);
        }
      } finally {
        if (active) {
          setHelplineLoading(false);
        }
      }
    }
    void fetchHelplines();
    return () => {
      active = false;
    };
  }, [incidentType, selectedState]);

  useEffect(() => {
    let active = true;
    async function fetchCyberCell() {
      setCyberCellLoading(true);
      setCyberCellError('');
      try {
        const data = await getCyberCell({
          state: selectedState,
          lat: coords?.lat,
          lng: coords?.lng,
        });
        if (active) {
          setCyberCell(data);
          if (data?.state) {
            setSelectedState(data.state);
          }
        }
      } catch (err) {
        if (active) {
          setCyberCellError(t('Could not fetch cyber cell details. You can still use complaint portals below.', 'साइबर सेल विवरण नहीं मिल सका। आप नीचे शिकायत पोर्टल का उपयोग कर सकते हैं।'));
          setCyberCell(null);
        }
      } finally {
        if (active) {
          setCyberCellLoading(false);
        }
      }
    }
    void fetchCyberCell();
    return () => {
      active = false;
    };
  }, [selectedState, coords?.lat, coords?.lng]);

  function detectLocation() {
    if (!navigator.geolocation) {
      setCyberCellError('Geolocation is not available in this browser.');
      return;
    }
    setCyberCellLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setCyberCellLoading(false);
      },
      () => {
        setCyberCellError('Location permission denied. Select your state manually.');
        setCyberCellLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function generateComplaint() {
    if (!incidentDesc.trim()) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    setDraft(generateDraft(incidentDesc));
    setGenerating(false);
  }

  function copy() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dynamicPortals = helplineData?.portals?.length
    ? helplineData.portals.map((p, idx) => ({
      id: `api_${idx}`,
      name: p.name,
      shortName: p.name,
      url: p.url,
      icon: '🛡️',
      color: 'border-cyan-500/30',
      badge: 'LIVE',
      badgeColor: 'bg-cyan-500/20 text-cyan-400',
      useCase: p.purpose,
      steps: p.stepByStep,
      phone: p.url.startsWith('tel:') ? p.url.replace('tel:', '') : null,
    }))
    : portals;
  const filteredPortals = dynamicPortals.filter((portal) => {
    if (portal.id.startsWith('api_')) {
      const info = `${portal.name} ${portal.shortName} ${portal.useCase}`.toLowerCase();
      if (info.includes('cybercrime.gov.in') || info.includes('cyber crime reporting portal')) return true;
      if (FINANCIAL_INCIDENTS.has(incidentType) && (info.includes('rbi') || info.includes('ombudsman'))) return true;

      if (incidentType === 'upi_fraud') {
        return (info.includes('upi') || info.includes('npci') || info.includes('rbi') || info.includes('ombudsman')) && !info.includes('trai');
      }
      if (incidentType === 'fake_app') {
        return (info.includes('google play') || info.includes('play store') || info.includes('cert') || info.includes('malware')) && !info.includes('rbi') && !info.includes('bank');
      }
      if (incidentType === 'deepfake') {
        return (info.includes('deepfake') || info.includes('cert')) && !info.includes('rbi') && !info.includes('bank') && !info.includes('trai');
      }
      if (incidentType === 'sextortion') {
        return info.includes('sextortion') || info.includes('abuse') || info.includes('women') || info.includes('blackmail');
      }
      if (incidentType === 'job_scam') {
        return info.includes('job') || info.includes('consumer') || info.includes('scam');
      }
      if (incidentType === 'loan_fraud') {
        return info.includes('loan') || info.includes('rbi') || info.includes('ombudsman');
      }
      return true;
    }

    const allowed = new Set(CATEGORY_PORTAL_IDS[incidentType] || ['cybercrime']);
    if (portal.id === 'cybercrime') return true;
    if (FINANCIAL_INCIDENTS.has(incidentType) && portal.id === 'rbi') return true;
    return allowed.has(portal.id);
  });
  const stateCell = cyberCell?.nearestOffice;
  const mapSrc = stateCell?.lat && stateCell?.lng
    ? `https://www.google.com/maps?q=${stateCell.lat},${stateCell.lng}&z=12&output=embed`
    : '';

  return (
    <div className="min-h-screen bg-[#060d1f] pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-white">{t('Official Complaint & Legal Hub', 'आधिकारिक शिकायत केंद्र')}</h1>
            <p className="text-slate-500">{t('Smart guided complaint center — not just links', 'स्मार्ट गाइडेड शिकायत केंद्र')}</p>
          </div>
        </div>

        {/* Time Alert */}
        <div className="bg-white/5 backdrop-blur-xl border border-red-500/40 rounded-xl p-4 mb-8 flex items-center gap-3">
          <Clock className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm font-medium">
            {t(
              'Financial fraud? Call 1930 within the first 60 minutes — highest recovery chance.',
              'वित्तीय धोखाधड़ी? पहले 60 मिनट में 1930 पर कॉल करें — सबसे ज्यादा रिकवरी की संभावना।'
            )}
          </p>
          <a href="tel:1930" className="ml-auto flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-all">
            {t('Call 1930', '1930 कॉल करें')}
          </a>
        </div>

        {/* Complaint Portals */}
        <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white mb-4">{t('Complaint Portals', 'शिकायत पोर्टल')}</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
            className="bg-[#060d1f] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
          >
            <option value="upi_fraud">UPI Fraud</option>
            <option value="fake_app">Fake App</option>
            <option value="deepfake">Deepfake</option>
            <option value="sextortion">Sextortion</option>
            <option value="job_scam">Job Scam</option>
            <option value="loan_fraud">Loan Fraud</option>
          </select>
          {helplineLoading && <span className="text-slate-400 text-sm">{t('Loading helplines...', 'हेल्पलाइन लोड हो रही हैं...')}</span>}
          {helplineError && <span className="text-yellow-300 text-sm">{helplineError}</span>}
        </div>
        <div className="space-y-3 mb-12">
          {filteredPortals.map((portal) => (
            <motion.div
              key={portal.id}
              whileHover={{ rotateX: -2, rotateY: 2 }}
              style={{ transformStyle: 'preserve-3d' }}
              className={`bg-white/5 backdrop-blur-xl border ${portal.color} rounded-2xl overflow-hidden transition-all`}
            >
              <button
                onClick={() => setExpandedPortal(expandedPortal === portal.id ? null : portal.id)}
                className="w-full flex items-center gap-4 p-4 text-left"
              >
                <span className="text-2xl">{portal.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-semibold text-sm">{portal.shortName}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${portal.badgeColor}`}>{portal.badge}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{portal.useCase}</p>
                </div>
                <div className="flex items-center gap-2">
                  {portal.phone && (
                    <a href={`tel:${portal.phone}`} onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {expandedPortal === portal.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>

              {expandedPortal === portal.id && (
                <div className="px-4 pb-4 border-t border-white/5 pt-4">
                  <p className="text-cyan-400 text-sm font-semibold mb-2">{t('How to file:', 'कैसे दर्ज करें:')}</p>
                  <ol className="space-y-2 mb-4">
                    {portal.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-400">
                        <span className="text-cyan-500 font-bold flex-shrink-0">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <a
                    href={portal.url}
                    target={portal.url.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium rounded-xl hover:bg-cyan-500/20 transition-all"
                  >
                    {portal.url.startsWith('http') ? (
                      <><ExternalLink className="w-4 h-4" /> {t('Open Portal', 'पोर्टल खोलें')}</>
                    ) : (
                      <><Phone className="w-4 h-4" /> {t('Call Now', 'अभी कॉल करें')}</>
                    )}
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* State Cyber Cell Locator */}
        <div className="mb-12">
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            {t('Nearest State Cyber Cell', 'निकटतम राज्य साइबर सेल')}
          </h2>
          <div className="bg-white/5 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5">
            <div className="mb-4">
              <label className="text-slate-400 text-sm font-medium block mb-2">{t('Select your state', 'अपना राज्य चुनें')}</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-[#060d1f] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 w-full sm:w-auto"
              >
                {(cyberCell?.states?.length ? cyberCell.states : [selectedState]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={detectLocation}
                disabled={cyberCellLoading}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-semibold rounded-xl hover:bg-cyan-500/20 disabled:opacity-60 transition-all"
              >
                {cyberCellLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {t('Use My Location', 'मेरी लोकेशन')}
              </button>
              {cyberCellError && <p className="text-red-300 text-sm mt-3">{cyberCellError}</p>}
            </div>

            {stateCell && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-white/10">
                  <div>
                    <p className="text-white font-semibold">{cyberCell?.state} Cyber Cell</p>
                    <p className="text-slate-500 text-sm">
                      {stateCell.city}{stateCell.distanceKm != null ? ` - ${stateCell.distanceKm} km away` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`tel:${stateCell.phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-sm font-semibold">
                      <Phone className="w-4 h-4" /> Call
                    </a>
                    <a href={`mailto:${stateCell.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl text-sm font-semibold">
                      <Mail className="w-4 h-4" /> Email
                    </a>
                    <a href={stateCell.googleMapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl text-sm font-semibold">
                      <MapPin className="w-4 h-4" /> Directions
                    </a>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-1">{t('Address', 'पता')}</p>
                  <p className="text-white text-sm">{stateCell.address}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">{t('Phone', 'फोन')}</p>
                  <a href={`tel:${stateCell.phone}`} className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">{stateCell.phone}</a>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">{t('Email', 'ईमेल')}</p>
                  <a href={`mailto:${stateCell.email}`} className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors truncate block">{stateCell.email}</a>
                </div>
                <div>
                  <a
                    href={stateCell.googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-teal-400 text-sm hover:text-teal-300 transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    {t('Get Directions', 'दिशा-निर्देश पाएं')}
                  </a>
                </div>
                </div>
                {mapSrc && (
                  <iframe
                    title="Nearest cyber cell map"
                    src={mapSrc}
                    className="w-full h-64 rounded-xl border border-slate-700/50"
                    loading="lazy"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Auto Complaint Generator */}
        <div>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            {t('Auto Complaint Draft Generator', 'स्वचालित शिकायत ड्राफ्ट')}
          </h2>
          <div className="bg-white/5 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 mb-4">
            <label className="text-slate-400 text-sm font-medium block mb-2">
              {t('Describe your incident briefly', 'अपनी घटना संक्षेप में बताएं')}
            </label>
            <textarea
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              placeholder={t('e.g., I received a UPI fraud call and lost Rs. 50,000...', 'जैसे: मुझे UPI धोखाधड़ी का कॉल आया और Rs. 50,000 गए...')}
              rows={3}
              className="w-full bg-[#060d1f] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
            />
          </div>
          <button
            onClick={generateComplaint}
            disabled={generating || !incidentDesc.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-[#060d1f] font-bold rounded-xl transition-all mb-6"
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" />{t('Generating...', 'बन रहा है...')}</> : <>{t('Generate Draft', 'ड्राफ्ट बनाएं')}</>}
          </button>

          {draft && (
            <div>
              <div className="bg-white/5 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-5 mb-4">
                <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{draft}</pre>
              </div>
              <div className="flex gap-3">
                <button onClick={copy} className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#060d1f] font-bold rounded-xl transition-all text-sm">
                  {copied ? <><CheckCircle className="w-4 h-4" />{t('Copied!', 'कॉपी हुआ!')}</> : <><Copy className="w-4 h-4" />{t('Copy', 'कॉपी करें')}</>}
                </button>
                <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#0a1628] border border-cyan-500/30 text-cyan-400 font-semibold rounded-xl hover:bg-cyan-500/10 transition-all text-sm">
                  <ExternalLink className="w-4 h-4" /> {t('Submit on cybercrime.gov.in', 'cybercrime.gov.in पर जमा करें')}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
