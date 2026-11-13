const express = require('express');
const router = express.Router();
const {
  listConversations,
  searchUsers,
  createConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  deleteMessage
} = require('../controllers/messagesController');
const { requireAuth } = require('../middleware/auth');
const {
  messageLimiter,
  conversationLimiter,
  searchUsersLimiter,
  writeLimiter
} = require('../middleware/rateLimit');

router.use(requireAuth);

// Recherche d'utilisateurs et conversations.
router.get('/users', searchUsersLimiter, searchUsers);
router.get('/conversations', listConversations);
router.post('/conversations', conversationLimiter, createConversation);

// Historique paginé, envoi, accusé de lecture et suppression.
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/messages', messageLimiter, sendMessage);
router.post('/conversations/:id/read', writeLimiter, markConversationRead);
router.delete('/:id', messageLimiter, deleteMessage);

module.exports = router;
