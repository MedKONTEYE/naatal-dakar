const { getPool } = require('../config/db');
const {
  text,
  email: validateEmail,
  integer
} = require('../utils/validation');
const { pairKeyFor } = require('../utils/conversations');
const { emitToUser, isOnline } = require('../realtime/socket');

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const readConversationId = (value) => integer(value, {
  field: 'Conversation',
  min: 1,
  max: 1000000000
});

const readMessageId = (value) => integer(value, {
  field: 'Message',
  min: 1,
  max: 1000000000
});

const getMembership = async (conversationId, userEmail) => {
  const [rows] = await getPool().query(
    `SELECT id, last_read_at AS lastReadAt
     FROM conversation_participants
     WHERE conversation_id = ? AND user_email = ?
     LIMIT 1`,
    [conversationId, userEmail]
  );
  return rows[0] || null;
};

const getParticipantEmails = async (conversationId) => {
  const [rows] = await getPool().query(
    'SELECT user_email AS email FROM conversation_participants WHERE conversation_id = ?',
    [conversationId]
  );
  return rows.map((row) => row.email).filter(Boolean);
};

const getOtherParticipant = async (conversationId, userEmail) => {
  const [rows] = await getPool().query(
    `SELECT user_email AS email
     FROM conversation_participants
     WHERE conversation_id = ? AND user_email <> ?
     LIMIT 1`,
    [conversationId, userEmail]
  );
  return rows[0] ? rows[0].email : null;
};

const CONVERSATION_SELECT = `
  SELECT
    c.id,
    UNIX_TIMESTAMP(c.updated_at) * 1000 AS updatedAtMs,
    UNIX_TIMESTAMP(cp.last_read_at) * 1000 AS lastReadAtMs,
    other.email AS participantEmail,
    other.nom AS participantNom,
    other.role AS participantRole,
    lm.id AS lastMessageId,
    lm.sender_id AS lastMessageSender,
    lm.content AS lastMessageContent,
    lm.is_deleted AS lastMessageDeleted,
    UNIX_TIMESTAMP(lm.created_at) * 1000 AS lastMessageAtMs,
    (
      SELECT COUNT(*)
      FROM messages unread
      WHERE unread.conversation_id = c.id
        AND unread.sender_id <> ?
        AND unread.is_deleted = 0
        AND (cp.last_read_at IS NULL OR unread.created_at > cp.last_read_at)
    ) AS unreadCount
  FROM conversations c
  JOIN conversation_participants cp
    ON cp.conversation_id = c.id AND cp.user_email = ?
  JOIN conversation_participants cpOther
    ON cpOther.conversation_id = c.id AND cpOther.user_email <> ?
  JOIN utilisateurs other ON other.email = cpOther.user_email
  LEFT JOIN messages lm ON lm.id = (
    SELECT lastMessage.id
    FROM messages lastMessage
    WHERE lastMessage.conversation_id = c.id
    ORDER BY lastMessage.id DESC
    LIMIT 1
  )
`;

const MESSAGE_SELECT = `
  SELECT
    m.id,
    m.conversation_id AS conversationId,
    m.sender_id AS senderEmail,
    u.nom AS senderNom,
    m.content,
    m.is_deleted AS isDeleted,
    UNIX_TIMESTAMP(m.created_at) * 1000 AS createdAtMs,
    UNIX_TIMESTAMP(m.updated_at) * 1000 AS updatedAtMs,
    CASE
      WHEN other.last_read_at IS NOT NULL AND m.created_at <= other.last_read_at THEN 1
      ELSE 0
    END AS lu
  FROM messages m
  JOIN utilisateurs u ON u.email = m.sender_id
  LEFT JOIN conversation_participants other
    ON other.conversation_id = m.conversation_id
   AND other.user_email <> ?
`;

const serializeConversation = (row) => ({
  id: Number(row.id),
  participant: {
    email: row.participantEmail,
    nom: row.participantNom,
    role: row.participantRole
  },
  lastMessage: row.lastMessageId
    ? {
        id: Number(row.lastMessageId),
        senderEmail: row.lastMessageSender,
        content: Number(row.lastMessageDeleted) ? null : row.lastMessageContent,
        isDeleted: Boolean(Number(row.lastMessageDeleted)),
        createdAt: Number(row.lastMessageAtMs) || null
      }
    : null,
  unreadCount: Number(row.unreadCount) || 0,
  online: isOnline(row.participantEmail),
  lastReadAt: Number(row.lastReadAtMs) || null,
  updatedAt: Number(row.updatedAtMs) || null
});

const serializeMessage = (row) => ({
  id: Number(row.id),
  conversationId: Number(row.conversationId),
  senderEmail: row.senderEmail,
  senderNom: row.senderNom,
  content: Number(row.isDeleted) ? null : row.content,
  isDeleted: Boolean(Number(row.isDeleted)),
  createdAt: Number(row.createdAtMs) || null,
  updatedAt: Number(row.updatedAtMs) || null,
  lu: Boolean(Number(row.lu))
});

const getConversationSummary = async (conversationId, userEmail) => {
  const [rows] = await getPool().query(
    `${CONVERSATION_SELECT} WHERE c.id = ? LIMIT 1`,
    [userEmail, userEmail, userEmail, conversationId]
  );
  return rows[0] ? serializeConversation(rows[0]) : null;
};

// GET /api/messages/conversations
const listConversations = async (req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `${CONVERSATION_SELECT}
       ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.id DESC`,
      [req.user.email, req.user.email, req.user.email]
    );
    return res.json({ success: true, data: rows.map(serializeConversation) });
  } catch (error) {
    return next(error);
  }
};

// GET /api/messages/users?q=...
// Recherche limitée aux comptes actifs. Aucune donnée sensible (mot de passe,
// permissions, téléphone) n'est exposée. La recherche exige au moins deux
// caractères pour éviter l'énumération massive des comptes.
const searchUsers = async (req, res, next) => {
  try {
    const query = text(req.query.q, {
      field: 'Recherche',
      min: 0,
      max: 100,
      fallback: ''
    });

    if (query.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    // Les caractères % et _ sont traités littéralement : impossible d'utiliser
    // des jokers pour énumérer l'ensemble des comptes.
    const escaped = query.trim().replace(/[!%_]/g, '!$&');
    const pattern = `%${escaped}%`;
    const [rows] = await getPool().query(
      `SELECT email, nom, role
       FROM utilisateurs
       WHERE actif = 1
         AND email <> ?
         AND (nom LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!')
       ORDER BY nom ASC, email ASC
       LIMIT 20`,
      [req.user.email, pattern, pattern]
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({
        email: row.email,
        nom: row.nom,
        role: row.role,
        online: isOnline(row.email)
      }))
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/messages/conversations
const createConversation = async (req, res, next) => {
  let connection;
  try {
    const targetEmail = validateEmail(req.body.email, { field: 'Destinataire' });

    if (targetEmail === req.user.email) {
      return fail(res, 400, 'Vous ne pouvez pas démarrer une conversation avec vous-même');
    }

    const [targetRows] = await getPool().query(
      'SELECT email, nom, role, actif FROM utilisateurs WHERE email = ? LIMIT 1',
      [targetEmail]
    );
    if (targetRows.length === 0 || !targetRows[0].actif) {
      return fail(res, 404, 'Utilisateur introuvable ou compte désactivé');
    }

    const pairKey = pairKeyFor(req.user.email, targetEmail);
    const pool = getPool();
    connection = await pool.getConnection();

    await connection.beginTransaction();
    const [insert] = await connection.query(
      `INSERT INTO conversations (pair_key)
       VALUES (?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), updated_at = updated_at`,
      [pairKey]
    );
    const conversationId = Number(insert.insertId);

    await connection.query(
      `INSERT IGNORE INTO conversation_participants (conversation_id, user_email)
       VALUES (?, ?), (?, ?)`,
      [conversationId, req.user.email, conversationId, targetEmail]
    );

    await connection.commit();
    connection.release();
    connection = null;

    const conversation = await getConversationSummary(conversationId, req.user.email);
    if (!conversation) {
      return fail(res, 500, 'Conversation indisponible');
    }

    emitToUser(req.user.email, 'conversation:new', { conversationId });
    emitToUser(targetEmail, 'conversation:new', { conversationId });

    return res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // La connexion sera libérée dans tous les cas.
      }
      connection.release();
    }
    return next(error);
  }
};

// GET /api/messages/conversations/:id/messages?before=...&limit=...
const listMessages = async (req, res, next) => {
  try {
    const conversationId = readConversationId(req.params.id);
    const membership = await getMembership(conversationId, req.user.email);
    if (!membership) {
      return fail(res, 404, 'Conversation introuvable');
    }

    const limit = integer(req.query.limit, {
      field: 'Limite',
      min: 1,
      max: MAX_PAGE_SIZE,
      fallback: DEFAULT_PAGE_SIZE
    });
    const before = integer(req.query.before, {
      field: 'Curseur',
      min: 1,
      max: 1000000000,
      fallback: null
    });

    const params = [req.user.email, conversationId];
    let cursor = '';
    if (before) {
      cursor = 'AND m.id < ?';
      params.push(before);
    }
    params.push(limit + 1);

    const [rows] = await getPool().query(
      `${MESSAGE_SELECT}
       WHERE m.conversation_id = ? ${cursor}
       ORDER BY m.id DESC
       LIMIT ?`,
      params
    );

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    const conversation = await getConversationSummary(conversationId, req.user.email);

    return res.json({
      success: true,
      data: {
        messages: page.map(serializeMessage),
        hasMore,
        conversationId,
        conversation
      }
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/messages/conversations/:id/messages
const sendMessage = async (req, res, next) => {
  try {
    const conversationId = readConversationId(req.params.id);
    const membership = await getMembership(conversationId, req.user.email);
    if (!membership) {
      return fail(res, 404, 'Conversation introuvable');
    }

    const content = text(req.body.content, {
      field: 'Message',
      min: 1,
      max: MAX_MESSAGE_LENGTH,
      required: true
    });

    const pool = getPool();
    const [insert] = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, is_deleted)
       VALUES (?, ?, ?, 0)`,
      [conversationId, req.user.email, content]
    );

    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [conversationId]);

    const [rows] = await pool.query(
      `${MESSAGE_SELECT} WHERE m.conversation_id = ? AND m.id = ? LIMIT 1`,
      [req.user.email, conversationId, insert.insertId]
    );

    const message = serializeMessage(rows[0]);
    const participants = await getParticipantEmails(conversationId);
    participants.forEach((participant) => {
      emitToUser(participant, 'message:new', { message, conversationId });
    });

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return next(error);
  }
};

// POST /api/messages/conversations/:id/read
const markConversationRead = async (req, res, next) => {
  try {
    const conversationId = readConversationId(req.params.id);
    const membership = await getMembership(conversationId, req.user.email);
    if (!membership) {
      return fail(res, 404, 'Conversation introuvable');
    }

    await getPool().query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = ? AND user_email = ?`,
      [conversationId, req.user.email]
    );

    const otherEmail = await getOtherParticipant(conversationId, req.user.email);
    if (otherEmail) {
      emitToUser(otherEmail, 'conversation:read', {
        conversationId,
        readerEmail: req.user.email,
        readAt: Date.now()
      });
    }

    return res.json({ success: true, message: 'Conversation marquée comme lue' });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/messages/:id
// Règle : seul l'auteur peut supprimer son message. La suppression est logique
// afin que l'interlocuteur voie « Message supprimé » sans casser l'historique.
const deleteMessage = async (req, res, next) => {
  try {
    const messageId = readMessageId(req.params.id);
    const [rows] = await getPool().query(
      'SELECT id, conversation_id AS conversationId, sender_id AS senderId, is_deleted AS isDeleted FROM messages WHERE id = ? LIMIT 1',
      [messageId]
    );

    if (rows.length === 0) {
      return fail(res, 404, 'Message introuvable');
    }

    const message = rows[0];
    const membership = await getMembership(message.conversationId, req.user.email);
    if (!membership) {
      return fail(res, 404, 'Message introuvable');
    }
    if (message.senderId !== req.user.email) {
      return fail(res, 403, 'Vous ne pouvez supprimer que vos propres messages');
    }

    if (!Number(message.isDeleted)) {
      await getPool().query(
        `UPDATE messages
         SET is_deleted = 1, content = '', updated_at = NOW()
         WHERE id = ?`,
        [messageId]
      );
      await getPool().query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
        [message.conversationId]
      );
    }

    const participants = await getParticipantEmails(message.conversationId);
    participants.forEach((participant) => {
      emitToUser(participant, 'message:deleted', {
        messageId: Number(messageId),
        conversationId: Number(message.conversationId),
        deletedBy: req.user.email,
        updatedAt: Date.now()
      });
    });

    return res.json({ success: true, message: 'Message supprimé' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listConversations,
  searchUsers,
  createConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  deleteMessage,
  MAX_MESSAGE_LENGTH
};
