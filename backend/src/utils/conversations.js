const crypto = require('crypto');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

// Empreinte déterministe de la paire d'utilisateurs. L'ordre alphabétique
// garantit que A→B et B→A produisent exactement la même clé.
const pairKeyFor = (firstEmail, secondEmail) => {
  const pair = [normalizeEmail(firstEmail), normalizeEmail(secondEmail)].sort();
  return crypto.createHash('sha256').update(`${pair[0]}\n${pair[1]}`, 'utf8').digest('hex');
};

// L'email est la clé primaire de `utilisateurs` et les clés étrangères sont en
// ON UPDATE CASCADE. Après un changement d'adresse, les participants suivent
// automatiquement mais `pair_key` doit être recalculée pour continuer à
// empêcher la création d'un doublon.
const refreshPairKeysForUser = async (pool, email) => {
  const normalized = normalizeEmail(email);
  const [conversations] = await pool.query(
    `SELECT DISTINCT c.id
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE cp.user_email = ?`,
    [normalized]
  );

  for (const conversation of conversations) {
    const [participants] = await pool.query(
      'SELECT user_email AS email FROM conversation_participants WHERE conversation_id = ?',
      [conversation.id]
    );
    const emails = participants.map((participant) => participant.email).filter(Boolean);
    if (emails.length !== 2) continue;

    const nextKey = pairKeyFor(emails[0], emails[1]);
    try {
      await pool.query('UPDATE conversations SET pair_key = ? WHERE id = ?', [nextKey, conversation.id]);
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        // Une conversation équivalente existe déjà : on conserve l'ancienne
        // ligne plutôt que de casser la contrainte d'unicité.
        console.warn(`Clé de conversation en doublon ignorée pour #${conversation.id}`);
      } else {
        throw error;
      }
    }
  }
};

// Un compte supprimé ne doit pas laisser de conversation orpheline : les
// participants sont retirés par ON DELETE CASCADE, puis les conversations qui
// ne réunissent plus deux comptes sont nettoyées (les messages suivent).
const cleanupOrphanConversations = async (pool) => {
  await pool.query(
    `DELETE FROM conversations
     WHERE id IN (
       SELECT id FROM (
         SELECT c.id
         FROM conversations c
         LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
         GROUP BY c.id
         HAVING COUNT(cp.id) < 2
       ) AS conversations_orphelines
     )`
  );
};

module.exports = {
  normalizeEmail,
  pairKeyFor,
  refreshPairKeysForUser,
  cleanupOrphanConversations
};
