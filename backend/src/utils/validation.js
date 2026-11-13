class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.expose = true;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Z]{2,4}-\d{1,10}$/;
const INVITATION_CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;

const has = (object, field) => Object.prototype.hasOwnProperty.call(object, field);

// Balises HTML : aucun champ texte libre ne doit en contenir.
const HTML_TAG_PATTERN = /<[^>]*>/;
// Caractères de contrôle interdits (on conserve \t, \n et \r).
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const text = (value, { field, min = 1, max = 255, required = false, fallback = '' } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} doit être une chaîne de caractères`);
  }
  const cleaned = value.replace(CONTROL_CHARS_PATTERN, '').trim();
  if (HTML_TAG_PATTERN.test(cleaned)) {
    throw new ValidationError(`${field} ne doit pas contenir de balises HTML`);
  }
  if (cleaned.length < min) {
    throw new ValidationError(`${field} doit contenir au moins ${min} caractère${min > 1 ? 's' : ''}`);
  }
  if (cleaned.length > max) {
    throw new ValidationError(`${field} ne doit pas dépasser ${max} caractères`);
  }
  return cleaned;
};

const email = (value, { field = 'Email', required = true } = {}) => {
  const cleaned = text(value, { field, min: 3, max: 190, required }).toLowerCase();
  if (!EMAIL_PATTERN.test(cleaned)) {
    throw new ValidationError('Adresse email invalide');
  }
  return cleaned;
};

const oneOf = (value, allowed, { field, required = false, fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ValidationError(`${field} invalide`);
  }
  return value;
};

const dateOnly = (value, { field = 'Date', required = false, fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new ValidationError(`${field} doit être au format AAAA-MM-JJ`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${field} invalide`);
  }
  return value;
};

const integer = (value, { field, min = 0, max = 1000000000, required = false, fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${field} doit être un entier entre ${min} et ${max}`);
  }
  return parsed;
};

const decimal = (value, { field, min = 0, max = 1000000000, required = false, fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${field} doit être un nombre entre ${min} et ${max}`);
  }
  return parsed;
};

const plainObject = (value, { field, maxBytes = 10000, required = false, fallback = null } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field} doit être un objet JSON`);
  }
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new ValidationError(`${field} contient des données invalides`);
  }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new ValidationError(`${field} est trop volumineux`);
  }
  return value;
};

const coordinates = (value, { field = 'Coordonnées', required = false, fallback = null } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${field} sont requises`);
    return fallback;
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ValidationError(`${field} doivent être un tableau [latitude, longitude]`);
  }
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ValidationError(`${field} invalides`);
  }
  return [lat, lng];
};

const identifier = (value, { field = 'Identifiant', required = true } = {}) => {
  const cleaned = text(value, { field, min: 3, max: 20, required });
  if (!ID_PATTERN.test(cleaned)) {
    throw new ValidationError(`${field} invalide`);
  }
  return cleaned;
};

// Code d'invitation d'équipe : insensible à la casse et aux espaces de saisie.
const invitationCode = (value, { field = 'Code d’invitation', required = true } = {}) => {
  const cleaned = text(value, { field, min: 4, max: 20, required })
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!INVITATION_CODE_PATTERN.test(cleaned)) {
    throw new ValidationError(`${field} invalide`);
  }
  return cleaned;
};

const PHONE_PATTERN = /^[+0-9 ().-]{6,30}$/;

const telephone = (value, { field = 'Téléphone', required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return '';
  }
  const cleaned = text(value, { field, min: 6, max: 30, required });
  if (!PHONE_PATTERN.test(cleaned)) {
    throw new ValidationError(`${field} invalide (chiffres, espaces, +, -, . et parenthèses uniquement)`);
  }
  return cleaned;
};

const booleanFlag = (value, { field = 'Valeur', required = false, fallback = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} est requis`);
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw new ValidationError(`${field} doit être un booléen`);
};

const password = (value, { field = 'Mot de passe', required = true } = {}) => {
  if (typeof value !== 'string' || value.length === 0) {
    if (required) throw new ValidationError(`${field} est requis`);
    return '';
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes < 8) {
    throw new ValidationError(`${field} doit contenir au moins 8 caractères`);
  }
  if (bytes > 72) {
    throw new ValidationError(`${field} ne doit pas dépasser 72 octets`);
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new ValidationError(
      `${field} doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial`
    );
  }
  return value;
};

module.exports = {
  ValidationError,
  has,
  text,
  email,
  oneOf,
  dateOnly,
  integer,
  decimal,
  plainObject,
  coordinates,
  identifier,
  invitationCode,
  telephone,
  booleanFlag,
  password
};
