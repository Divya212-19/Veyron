/*
  # Veyron Platform Database Schema

  1. New Tables
    - `scan_results` — stores link/app/deepfake scan results per session
      - `id` (uuid, pk)
      - `session_id` (text) — anonymous session identifier
      - `scan_type` (text) — 'link', 'app', 'deepfake', 'spam'
      - `input_value` (text) — URL, phone, app name, etc.
      - `verdict` (text) — 'safe', 'suspicious', 'dangerous', 'fake', 'real'
      - `confidence` (numeric) — 0-100
      - `details` (jsonb) — full result data
      - `created_at` (timestamptz)
    - `chat_sessions` — stores CyberSaathi chat history
      - `id` (uuid, pk)
      - `session_id` (text)
      - `messages` (jsonb) — array of {role, content, timestamp}
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `emergency_reports` — stores anonymized emergency incident data
      - `id` (uuid, pk)
      - `session_id` (text)
      - `incident_type` (text)
      - `description` (text)
      - `state` (text)
      - `complaint_draft` (text)
      - `created_at` (timestamptz)
    - `scam_alerts` — regional scam alerts by state
      - `id` (uuid, pk)
      - `state` (text)
      - `scam_type` (text)
      - `title` (text)
      - `description` (text)
      - `severity` (text) — 'low', 'medium', 'high', 'critical'
      - `active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Anonymous session-based access for scan_results and chat_sessions
    - Insert-only for emergency_reports (no user reads)
    - Public read for scam_alerts
*/

CREATE TABLE IF NOT EXISTS scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  scan_type text NOT NULL,
  input_value text NOT NULL,
  verdict text NOT NULL,
  confidence numeric DEFAULT 0,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert scan results"
  ON scan_results FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Session owner can read own scan results"
  ON scan_results FOR SELECT
  TO anon, authenticated
  USING (session_id = current_setting('app.session_id', true));

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  messages jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert chat sessions"
  ON chat_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Session owner can read own chat"
  ON chat_sessions FOR SELECT
  TO anon, authenticated
  USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "Session owner can update own chat"
  ON chat_sessions FOR UPDATE
  TO anon, authenticated
  USING (session_id = current_setting('app.session_id', true))
  WITH CHECK (session_id = current_setting('app.session_id', true));

CREATE TABLE IF NOT EXISTS emergency_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  incident_type text NOT NULL,
  description text DEFAULT '',
  state text DEFAULT '',
  complaint_draft text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert emergency reports"
  ON emergency_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS scam_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'National',
  scam_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scam_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active scam alerts"
  ON scam_alerts FOR SELECT
  TO anon, authenticated
  USING (active = true);

INSERT INTO scam_alerts (state, scam_type, title, description, severity) VALUES
  ('National', 'UPI Fraud', 'Fake UPI QR Code Scam Surge', 'Fraudsters are sending fake QR codes claiming to send you money. Scanning these drains your account instead.', 'critical'),
  ('Maharashtra', 'Job Scam', 'Fake WFH Job Offers on WhatsApp', 'Victims receive WhatsApp messages promising Rs 5000/day for simple tasks. Initial small payments are made before a large deposit is demanded.', 'high'),
  ('Delhi', 'OTP Fraud', 'Fake Bank KYC Update Calls', 'Callers posing as bank officials request OTP for "KYC update". Over 200 cases reported this week.', 'critical'),
  ('Karnataka', 'Investment Fraud', 'Fake Crypto Trading App Scam', 'A fake trading app showing guaranteed returns has defrauded over 150 people in Bengaluru. App name: "CryptoProfit India".', 'high'),
  ('UP', 'Loan App', 'Predatory Loan App Harassment', 'Multiple reports of fake loan apps accessing contacts and sending morphed images to contacts for recovery harassment.', 'critical'),
  ('Tamil Nadu', 'Sextortion', 'Video Call Blackmail Gang Active', 'Organized gang using fake social media profiles to initiate video calls and then extort money using recordings.', 'high');
