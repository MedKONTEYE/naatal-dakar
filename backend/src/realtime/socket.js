const { Server } = require('socket.io');
const { getPool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

let ioInstance = null;

// Un utilisateur peut être connecté depuis plusieurs onglets ou appareils.
// On compte les connexions actives pour ne signaler « hors ligne » qu'à la
// fermeture de la dernière session temps réel.
const activeConnections = new Map();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const userRoom = (email) => `user:${normalizeEmail(email)}`;

const isOnline = (email) => activeConnections.has(normalizeEmail(email));

const onlineEmails = () => [...activeConnections.keys()];

const getIO = () => ioInstance;

const emitToUser = (email, event, payload) => {
  const target = normalizeEmail(email);
  if (!target || !ioInstance) return;
  ioInstance.to(userRoom(target)).emit(event, payload);
};

// Les changements de présence ne sont diffusés qu'aux interlocuteurs directs :
// aucun utilisateur ne peut découvrir qui est en ligne en dehors de ses
// conversations.
const getPartnerEmails = async (email) => {
  const [rows] = await getPool().query(
    `SELECT DISTINCT other.user_email AS email
     FROM conversation_participants mine
     JOIN conversation_participants other
       ON other.conversation_id = mine.conversation_id
      AND other.user_email <> mine.user_email
     WHERE mine.user_email = ?`,
    [normalizeEmail(email)]
  );
  return rows.map((row) => row.email).filter(Boolean);
};

const notifyPresence = async (email, online) => {
  try {
    const partners = await getPartnerEmails(email);
    for (const partner of partners) {
      emitToUser(partner, 'presence:update', { email: normalizeEmail(email), online });
    }
  } catch (error) {
    console.error('Diffusion de présence impossible :', error.message);
  }
};

const authenticateSocket = async (socket, next) => {
  try {
    const authToken = socket.handshake.auth && socket.handshake.auth.token;
    const header = socket.handshake.headers.authorization || '';
    const token = authToken || (header.startsWith('Bearer ') ? header.slice(7).trim() : null);

    if (!token) return next(new Error('unauthorized'));

    const payload = verifyToken(token);
    const email = normalizeEmail(payload.sub);
    if (!email || email.length > 190) return next(new Error('unauthorized'));

    const [rows] = await getPool().query(
      `SELECT email, nom, role, actif, token_version AS tokenVersion
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0 || !rows[0].actif) return next(new Error('unauthorized'));
    if (Number(payload.ver) !== Number(rows[0].tokenVersion)) {
      return next(new Error('unauthorized'));
    }

    socket.data.user = {
      email: rows[0].email,
      nom: rows[0].nom,
      role: rows[0].role
    };
    return next();
  } catch (error) {
    return next(new Error('unauthorized'));
  }
};

const initSocket = (server, allowedOrigins = []) => {
  if (ioInstance) return ioInstance;

  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 20000,
    pingTimeout: 25000,
    maxHttpBufferSize: 1e6
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const email = normalizeEmail(socket.data.user.email);
    socket.join(userRoom(email));

    const previousCount = activeConnections.get(email) || 0;
    activeConnections.set(email, previousCount + 1);

    socket.emit('presence:ready', { email, online: true });

    if (previousCount === 0) {
      notifyPresence(email, true);
    }

    // Le nouvel onglet reçoit l'état courant de ses interlocuteurs.
    getPartnerEmails(email)
      .then((partners) => {
        partners.forEach((partner) => {
          socket.emit('presence:update', { email: partner, online: isOnline(partner) });
        });
      })
      .catch(() => {});

    socket.on('disconnect', () => {
      const remaining = (activeConnections.get(email) || 1) - 1;
      if (remaining > 0) {
        activeConnections.set(email, remaining);
        return;
      }
      activeConnections.delete(email);
      notifyPresence(email, false);
    });
  });

  ioInstance = io;
  return io;
};

const closeRealtime = async () => {
  if (!ioInstance) return;
  await new Promise((resolve) => {
    ioInstance.close(() => resolve());
  });
  ioInstance = null;
  activeConnections.clear();
};

// Une désactivation, une suppression ou un changement d'email doit couper
// immédiatement les sessions temps réel de l'utilisateur concerné.
const disconnectUser = (email) => {
  if (!ioInstance) return;
  ioInstance.in(userRoom(email)).disconnectSockets(true);
};

module.exports = {
  initSocket,
  closeRealtime,
  disconnectUser,
  getIO,
  emitToUser,
  isOnline,
  onlineEmails,
  getPartnerEmails
};
