import {
  chatWithSaathi,
  checkEmail,
  scanLink,
  checkApp,
  detectDeepfake,
  getHelplines,
} from '../api';

describe('API client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls chat endpoint successfully', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Hello' }),
    });

    const res = await chatWithSaathi('Hi', [], 'English');
    expect(res.response).toBe('Hello');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-200 response', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Bad request' }),
    });
    await expect(checkEmail('bad-email')).rejects.toThrow('Bad request');
  });

  it('calls scan-link endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ verdict: 'safe' }) });
    const res = await scanLink('https://example.com');
    expect(res.verdict).toBe('safe');
  });

  it('calls check-app endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ verdict: 'official' }) });
    const res = await checkApp('UMANG');
    expect(res.verdict).toBe('official');
  });

  it('calls deepfake endpoint with url formdata', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ verdict: 'suspicious' }) });
    const res = await detectDeepfake('https://example.com/video.mp4');
    expect(res.verdict).toBe('suspicious');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/detect-deepfake',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls helplines endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ primaryAction: { number: '1930' } }) });
    const res = await getHelplines('upi_fraud', 'Maharashtra');
    expect(res.primaryAction.number).toBe('1930');
  });
});
