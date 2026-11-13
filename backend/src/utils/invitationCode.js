const crypto = require('crypto');

// Alphabet sans caractères ambigus (0/O, 1/I/L) pour faciliter la saisie
// et la communication du code par le responsable de l'équipe.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_PREFIX = 'NDK-';

const generateInvitationCode = () => {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let suffix = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    suffix += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return `${CODE_PREFIX}${suffix}`;
};

// Génère un code unique en vérifiant son absence en base. La contrainte
// UNIQUE sur equipes.code_invitation reste la garantie finale côté MySQL.
const generateUniqueTeamCode = async (pool, { maxAttempts = 25 } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateInvitationCode();
    const [rows] = await pool.query(
      'SELECT id FROM equipes WHERE code_invitation = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error('Impossible de générer un code d’invitation unique');
};

module.exports = {
  generateInvitationCode,
  generateUniqueTeamCode,
  CODE_PREFIX,
  CODE_LENGTH
};
