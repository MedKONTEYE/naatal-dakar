const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 20000;

const normalizeKeyPart = (value) => String(value || '').trim().toLowerCase().slice(0, 190);

const createRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = 100,
  message = 'Trop de requêtes. Veuillez réessayer plus tard.',
  keyGenerator
} = {}) => {
  const entries = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
    if (entries.size > MAX_TRACKED_KEYS) {
      let toDelete = entries.size - MAX_TRACKED_KEYS;
      for (const key of entries.keys()) {
        entries.delete(key);
        if (--toDelete <= 0) break;
      }
    }
  };

  const timer = setInterval(cleanup, Math.min(windowMs, 60 * 1000));
  if (typeof timer.unref === 'function') timer.unref();

  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    const key = keyGenerator ? keyGenerator(req) : req.ip;
    if (!key) return next();

    const now = Date.now();
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }

    return next();
  };
};

const apiLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_MAX) || 300
});

const loginLimiter = createRateLimiter({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  message: 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.',
  keyGenerator: (req) => `${req.ip}:${normalizeKeyPart(req.body && req.body.email)}`
});

const writeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: 'Trop d’opérations d’écriture. Veuillez réessayer plus tard.',
  keyGenerator: (req) => `${req.ip}:${req.user ? req.user.email : 'anonymous'}`
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Trop de créations de compte. Veuillez réessayer dans une heure.',
  keyGenerator: (req) => `${req.ip}:${normalizeKeyPart(req.body && req.body.email)}`
});

// Vérification et adhésion par code d'invitation : limite les tentatives de
// devinette de code tout en laissant la vérification automatique confortable.
const joinTeamLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Trop de tentatives avec un code d’invitation. Veuillez réessayer plus tard.',
  keyGenerator: (req) => `${req.ip}:${req.user ? req.user.email : 'anonymous'}`
});

// Messagerie : limite les envois massifs sans gêner une conversation normale.
const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.MESSAGE_RATE_LIMIT_MAX) || 40,
  message: 'Trop de messages envoyés en peu de temps. Veuillez patienter un instant.',
  keyGenerator: (req) => `${req.ip}:${req.user ? req.user.email : 'anonymous'}`
});

const conversationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.CONVERSATION_RATE_LIMIT_MAX) || 40,
  message: 'Trop de nouvelles conversations créées. Veuillez réessayer plus tard.',
  keyGenerator: (req) => `${req.ip}:${req.user ? req.user.email : 'anonymous'}`
});

const searchUsersLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: 'Trop de recherches d’utilisateurs. Veuillez réessayer plus tard.',
  keyGenerator: (req) => `${req.ip}:${req.user ? req.user.email : 'anonymous'}`
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  loginLimiter,
  registerLimiter,
  writeLimiter,
  joinTeamLimiter,
  messageLimiter,
  conversationLimiter,
  searchUsersLimiter
};
