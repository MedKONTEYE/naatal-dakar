const { ValidationError } = require('../utils/validation');

const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = 'Erreur interne du serveur';

  if (err instanceof ValidationError) {
    status = 400;
    message = err.message;
  } else if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    status = 400;
    message = 'Corps de requête JSON invalide';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Requête trop volumineuse';
  } else if (Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 500) {
    status = err.statusCode;
    message = err.expose === false ? 'Requête invalide' : (err.message || 'Requête invalide');
  }

  // Journalisation complète côté serveur, jamais renvoyée au client.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${status}`, err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json({ success: false, message });
};

module.exports = errorHandler;
