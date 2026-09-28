const events = new Set(['page_view', 'start_clicked', 'game_started', 'game_finished', 'share_clicked']);
const numbers = new Set(['score', 'level', 'correct', 'duration_ms']);
const flags = new Set(['challenge', 'challenge_beaten']);
const visitorKey = '123-analytics-visitor-v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAnalytics(config, env = globalThis) {
  const noop = { track() { return false; }, enabled: false };
  try {
    if (!config.enabled || !/^phc_[a-zA-Z0-9]+$/.test(config.projectToken) ||
      !['https://eu.i.posthog.com', 'https://us.i.posthog.com'].includes(config.apiHost) ||
      env.location.origin !== config.allowedOrigin || env.navigator.doNotTrack === '1' ||
      env.navigator.globalPrivacyControl === true || !env.crypto?.randomUUID || !env.fetch) return noop;

    const now = env.Date.now();
    let visitor;
    try { visitor = JSON.parse(env.localStorage.getItem(visitorKey)); } catch {}
    if (!visitor || !uuid.test(visitor.id) || !Number.isFinite(visitor.createdAt) ||
      visitor.createdAt > now || now - visitor.createdAt > 90 * 86400000) {
      visitor = { id: env.crypto.randomUUID(), createdAt: now };
      try { env.localStorage.setItem(visitorKey, JSON.stringify(visitor)); } catch {}
    }
    const pageId = env.crypto.randomUUID();
    const returning = now - visitor.createdAt >= 86400000;
    let viewed = false;

    return {
      enabled: true,
      track(event, data = {}) {
        try {
          if (!events.has(event) || (event === 'page_view' && viewed)) return false;
          if (event === 'page_view') viewed = true;
          const properties = {
            app: 'bir-eki-ush', schema_version: 1, page_id: pageId,
            returning_visitor: returning,
            $process_person_profile: false, $geoip_disable: true, $ip: '0.0.0.0',
          };
          // Allowlist deliberately excludes names, URLs (including challenge names),
          // form values, referrers, user agents and arbitrary event properties.
          for (const [key, value] of Object.entries(data)) {
            if (numbers.has(key) && Number.isFinite(value) && value >= 0) properties[key] = Math.round(value);
            if (flags.has(key) && typeof value === 'boolean') properties[key] = value;
            if (key === 'reason' && ['wrong', 'timeout'].includes(value)) properties.reason = value;
            if (key === 'round_id' && uuid.test(value)) properties.round_id = value;
          }
          const payload = {
            api_key: config.projectToken, event, distinct_id: visitor.id,
            timestamp: new env.Date().toISOString(), properties,
          };
          // No await in the game loop. Analytics failure never delays a question.
          Promise.resolve(env.fetch(`${config.apiHost}/i/v0/e/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
          })).catch(() => {});
          return true;
        } catch { return false; }
      },
    };
  } catch { return noop; }
}
