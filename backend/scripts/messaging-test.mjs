import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { io } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = process.env.MESSAGING_TEST_URL || `http://localhost:${process.env.PORT || 5000}`;
const PASSWORD = 'Test!Pass1234';
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const users = {
  a: { nom: 'Test Messagerie A', email: `messagerie.test.a.${runId}@naatal.test` },
  b: { nom: 'Test Messagerie B', email: `messagerie.test.b.${runId}@naatal.test` },
  c: { nom: 'Test Messagerie C', email: `messagerie.test.c.${runId}@naatal.test` }
};

const results = [];
const sockets = [];
let conversationId = null;
let firstMessageId = null;

const log = (message) => console.log(`• ${message}`);
const pass = (message) => {
  results.push(message);
  console.log(`  ✓ ${message}`);
};

const api = async (url, { method = 'GET', token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const expectStatus = (response, expected, label) => {
  assert.equal(response.status, expected, `${label} : statut ${response.status} (${JSON.stringify(response.data)})`);
};

const connectSocket = async (token, label) => {
  const socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 8000
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} : connexion Socket.IO expirée`)), 8000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(new Error(`${label} : connexion Socket.IO refusée (${error.message})`));
    });
  });
  return socket;
};

const waitForEvent = (socket, event, predicate = () => true, timeout = 8000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    socket.off(event, handler);
    reject(new Error(`Événement ${event} non reçu dans les ${timeout} ms`));
  }, timeout);

  const handler = (payload) => {
    if (!predicate(payload)) return;
    clearTimeout(timer);
    socket.off(event, handler);
    resolve(payload);
  };

  socket.on(event, handler);
});

const registerAndLogin = async (user) => {
  const registration = await api('/api/auth/register', {
    method: 'POST',
    body: {
      nom: user.nom,
      email: user.email,
      telephone: '',
      password: PASSWORD,
      confirmPassword: PASSWORD
    }
  });
  expectStatus(registration, 201, `Inscription ${user.nom}`);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: user.email, password: PASSWORD }
  });
  expectStatus(login, 200, `Connexion ${user.nom}`);
  return login.data.token;
};

const cleanup = async () => {
  sockets.forEach((socket) => {
    try {
      socket.disconnect();
    } catch (error) {
      // Rien à faire.
    }
  });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'naatal_dakar'
  });

  try {
    if (conversationId) {
      await connection.query('DELETE FROM conversations WHERE id = ?', [conversationId]);
    }
    await connection.query(
      'DELETE FROM utilisateurs WHERE email IN (?, ?, ?)',
      [users.a.email, users.b.email, users.c.email]
    );
  } finally {
    await connection.end();
  }
};

const main = async () => {
  console.log(`\nTest de la messagerie NaataL — ${BASE_URL}\n`);

  const tokenA = await registerAndLogin(users.a);
  const tokenB = await registerAndLogin(users.b);
  const tokenC = await registerAndLogin(users.c);
  pass('Trois comptes de test créés et connectés par l’API');

  const socketA = await connectSocket(tokenA, 'Socket A');
  const socketB = await connectSocket(tokenB, 'Socket B');
  await connectSocket(tokenC, 'Socket C');
  pass('Sockets authentifiés pour A, B et C');

  const search = await api(`/api/messages/users?q=${encodeURIComponent('Messagerie B')}`, { token: tokenA });
  expectStatus(search, 200, 'Recherche utilisateur');
  assert.ok(search.data.data.some((user) => user.email === users.b.email), 'B doit apparaître dans la recherche');
  pass('A retrouve B par son nom');

  const selfConversation = await api('/api/messages/conversations', {
    method: 'POST',
    token: tokenA,
    body: { email: users.a.email }
  });
  expectStatus(selfConversation, 400, 'Conversation avec soi-même');
  pass('Une conversation avec soi-même est refusée');

  const created = await api('/api/messages/conversations', {
    method: 'POST',
    token: tokenA,
    body: { email: users.b.email }
  });
  expectStatus(created, 201, 'Création de conversation');
  conversationId = created.data.data.id;
  assert.ok(conversationId, 'Identifiant de conversation attendu');
  assert.equal(created.data.data.participant.email, users.b.email);
  pass(`Conversation privée créée (#${conversationId})`);

  const duplicate = await api('/api/messages/conversations', {
    method: 'POST',
    token: tokenB,
    body: { email: users.a.email }
  });
  expectStatus(duplicate, 201, 'Conversation existante');
  assert.equal(duplicate.data.data.id, conversationId, 'La conversation ne doit pas être dupliquée');
  pass('Aucune conversation en double (A→B et B→A réutilisent la même)');

  const conversationsA = await api('/api/messages/conversations', { token: tokenA });
  expectStatus(conversationsA, 200, 'Liste des conversations A');
  const listed = conversationsA.data.data.find((conversation) => conversation.id === conversationId);
  assert.ok(listed, 'La conversation doit apparaître dans la liste de A');
  assert.equal(listed.online, true, 'B doit être signalé en ligne');
  pass('La liste des conversations affiche B en ligne');

  const messagePromise = waitForEvent(socketB, 'message:new', (payload) => payload?.message?.content?.includes('Bonjour B'));
  const sent = await api(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: { content: 'Bonjour B, ceci est un test temps réel.' }
  });
  expectStatus(sent, 201, 'Envoi message A→B');
  firstMessageId = sent.data.data.id;

  const received = await messagePromise;
  assert.equal(received.message.senderEmail, users.a.email);
  assert.equal(received.message.content, 'Bonjour B, ceci est un test temps réel.');
  pass('B reçoit le message de A instantanément via Socket.IO');

  const conversationsB = await api('/api/messages/conversations', { token: tokenB });
  expectStatus(conversationsB, 200, 'Liste des conversations B');
  const unreadConversation = conversationsB.data.data.find((conversation) => conversation.id === conversationId);
  assert.equal(unreadConversation.unreadCount, 1, 'B doit avoir un message non lu');
  pass('Le compteur de messages non lus de B vaut 1');

  const historyB = await api(`/api/messages/conversations/${conversationId}/messages`, { token: tokenB });
  expectStatus(historyB, 200, 'Historique B');
  const firstMessage = historyB.data.data.messages.find((message) => message.id === firstMessageId);
  assert.ok(firstMessage, 'Le message doit être présent dans l’historique');
  assert.equal(firstMessage.lu, false, 'Le message ne doit pas encore être lu');
  pass('B consulte l’historique et retrouve le message');

  const readPromise = waitForEvent(socketA, 'conversation:read', (payload) => payload?.conversationId === conversationId);
  const read = await api(`/api/messages/conversations/${conversationId}/read`, {
    method: 'POST',
    token: tokenB
  });
  expectStatus(read, 200, 'Marquage comme lu');
  await readPromise;
  pass('L’accusé de lecture est transmis à A en temps réel');

  const conversationsBAfterRead = await api('/api/messages/conversations', { token: tokenB });
  const readConversation = conversationsBAfterRead.data.data.find((conversation) => conversation.id === conversationId);
  assert.equal(readConversation.unreadCount, 0, 'Le compteur doit revenir à zéro');
  pass('Le compteur de non lus de B revient à 0');

  const historyAAfterRead = await api(`/api/messages/conversations/${conversationId}/messages`, { token: tokenA });
  const readMessage = historyAAfterRead.data.data.messages.find((message) => message.id === firstMessageId);
  assert.equal(readMessage.lu, true, 'Le message doit être marqué lu');
  pass('A voit que son message a été lu');

  const replyPromise = waitForEvent(socketA, 'message:new', (payload) => payload?.message?.senderEmail === users.b.email);
  const reply = await api(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: tokenB,
    body: { content: 'Bonjour A, réponse de B.' }
  });
  expectStatus(reply, 201, 'Réponse B→A');
  await replyPromise;
  pass('A reçoit la réponse de B instantanément');

  socketB.disconnect();
  const logout = await api('/api/auth/logout', { method: 'POST', token: tokenB });
  expectStatus(logout, 200, 'Déconnexion B');

  const loginB = await api('/api/auth/login', {
    method: 'POST',
    body: { email: users.b.email, password: PASSWORD }
  });
  expectStatus(loginB, 200, 'Reconnexion B');
  const tokenB2 = loginB.data.token;
  const socketB2 = await connectSocket(tokenB2, 'Socket B (reconnexion)');

  const historyAfterReconnect = await api(`/api/messages/conversations/${conversationId}/messages`, { token: tokenB2 });
  expectStatus(historyAfterReconnect, 200, 'Historique après reconnexion');
  assert.ok(historyAfterReconnect.data.data.messages.length >= 2, 'L’historique doit être conservé');
  pass('B retrouve tout l’historique après déconnexion / reconnexion');

  const outsiderRead = await api(`/api/messages/conversations/${conversationId}/messages`, { token: tokenC });
  expectStatus(outsiderRead, 404, 'Accès extérieur à la conversation');
  const outsiderSend = await api(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: tokenC,
    body: { content: 'Intrusion' }
  });
  expectStatus(outsiderSend, 404, 'Envoi par un non-membre');
  pass('Un utilisateur extérieur ne peut ni lire ni écrire dans la conversation');

  const deletedPromise = waitForEvent(socketB2, 'message:deleted', (payload) => payload?.messageId === firstMessageId);
  const deletion = await api(`/api/messages/${firstMessageId}`, { method: 'DELETE', token: tokenA });
  expectStatus(deletion, 200, 'Suppression par l’auteur');
  await deletedPromise;
  pass('La suppression est diffusée à B en temps réel');

  const historyAfterDelete = await api(`/api/messages/conversations/${conversationId}/messages`, { token: tokenB2 });
  const deletedMessage = historyAfterDelete.data.data.messages.find((message) => message.id === firstMessageId);
  assert.equal(deletedMessage.isDeleted, true);
  assert.equal(deletedMessage.content, null);
  pass('Le message supprimé est remplacé par « Message supprimé »');

  const forbiddenDelete = await api(`/api/messages/${firstMessageId}`, { method: 'DELETE', token: tokenB2 });
  expectStatus(forbiddenDelete, 403, 'Suppression par l’interlocuteur');
  pass('B ne peut pas supprimer le message de A');

  const pagination = await api(`/api/messages/conversations/${conversationId}/messages?limit=1`, { token: tokenA });
  expectStatus(pagination, 200, 'Pagination');
  assert.equal(pagination.data.data.messages.length, 1);
  assert.equal(pagination.data.data.hasMore, true);
  const older = await api(
    `/api/messages/conversations/${conversationId}/messages?limit=10&before=${pagination.data.data.messages[0].id}`,
    { token: tokenA }
  );
  expectStatus(older, 200, 'Chargement des anciens messages');
  assert.ok(older.data.data.messages.length >= 1);
  pass('La pagination charge les anciens messages sans doublon');

  const offlinePromise = waitForEvent(
    socketA,
    'presence:update',
    (payload) => payload?.email === users.b.email && payload?.online === false
  );
  socketB2.disconnect();
  await offlinePromise;
  pass('La présence hors ligne est diffusée aux interlocuteurs');

  const emptyMessage = await api(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: { content: '   ' }
  });
  expectStatus(emptyMessage, 400, 'Message vide');
  pass('Un message vide est refusé');

  const htmlMessage = await api(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: tokenA,
    body: { content: '<script>alert(1)</script>' }
  });
  expectStatus(htmlMessage, 400, 'Message HTML');
  pass('Un message contenant du HTML est refusé');

  const unauthenticated = await api('/api/messages/conversations');
  expectStatus(unauthenticated, 401, 'Accès sans jeton');
  pass('Les API de messagerie exigent une authentification');

  const badSocket = io(BASE_URL, { auth: { token: 'jeton-invalide' }, transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Le serveur aurait dû refuser la connexion')), 5000);
    badSocket.once('connect', () => {
      clearTimeout(timer);
      badSocket.disconnect();
      reject(new Error('Une connexion Socket.IO avec un jeton invalide a été acceptée'));
    });
    badSocket.once('connect_error', () => {
      clearTimeout(timer);
      badSocket.disconnect();
      resolve();
    });
  });
  pass('Socket.IO refuse un jeton invalide');

  console.log(`\n${results.length} contrôles réussis.\n`);
};

try {
  await main();
} catch (error) {
  console.error('\n✗ Échec du test :', error.message);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    console.log('Nettoyage des comptes et conversations de test effectué.');
  } catch (error) {
    console.error('Nettoyage impossible :', error.message);
    process.exitCode = 1;
  }
}
