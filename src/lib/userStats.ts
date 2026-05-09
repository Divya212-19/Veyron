export type ToolKey = 'email' | 'link' | 'deepfake' | 'app';
export type VerdictLevel = 'safe' | 'suspicious' | 'dangerous';

export interface UserActivity {
  id: string;
  tool: ToolKey;
  verdict: VerdictLevel;
  summary: string;
  timestamp: string;
}

const STORAGE_KEY = 'veyron-user-activity-v1';

function readActivities(): UserActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeActivities(items: UserActivity[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
}

export function recordUserActivity(tool: ToolKey, verdict: VerdictLevel, summary: string) {
  const next: UserActivity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tool,
    verdict,
    summary,
    timestamp: new Date().toISOString(),
  };
  writeActivities([next, ...readActivities()]);
}

export function getUserActivity() {
  const all = readActivities().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const completedChecks = all.length;
  const suspiciousChecks = all.filter((a) => a.verdict === 'suspicious').length;
  const dangerousChecks = all.filter((a) => a.verdict === 'dangerous').length;

  const penalty = suspiciousChecks * 7 + dangerousChecks * 14;
  const safetyScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    safetyScore,
    completedChecks,
    suspiciousChecks,
    dangerousChecks,
    recent: all.slice(0, 6),
  };
}
