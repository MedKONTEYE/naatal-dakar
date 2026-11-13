const WEAK_JWT_SECRETS = new Set([
  'change-this-secret-in-production',
  'secret',
  'jwt-secret',
  'naatal',
  'password',
  'changeme',
  'dev-secret'
]);

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '');
  if (!secret) {
    throw new Error('JWT_SECRET manquant dans le fichier .env');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET trop court : utilisez au moins 32 caractères aléatoires');
  }
  if (WEAK_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET utilise une valeur par défaut connue : générez un secret aléatoire');
  }
  return secret;
};

const JWT_ISSUER = 'naatal-dakar';
const JWT_AUDIENCE = 'naatal-dakar-web';
const JWT_ALGORITHM = 'HS256';

const assertSecurityConfig = () => {
  getJwtSecret();
  const jwtExpiresIn = String(process.env.JWT_EXPIRES_IN || '24h').trim();
  if (!/^\d{1,3}(s|m|h|d)$/.test(jwtExpiresIn)) {
    throw new Error('JWT_EXPIRES_IN invalide : utilisez un format comme 30m, 12h ou 7d');
  }
  const value = Number(jwtExpiresIn.slice(0, -1));
  const unit = jwtExpiresIn.slice(-1);
  const seconds = value * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  if (seconds > 7 * 86400) {
    throw new Error('JWT_EXPIRES_IN ne doit pas dépasser 7 jours');
  }
};

module.exports = {
  assertSecurityConfig,
  getJwtSecret,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_ALGORITHM
};
