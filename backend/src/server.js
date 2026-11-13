const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, getPool, closeDB } = require('./config/db');
const { assertSecurityConfig } = require('./config/security');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const { initSocket, closeRealtime } = require('./realtime/socket');

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const interventionsRoutes = require('./routes/interventions');
const treesRoutes = require('./routes/trees');
const wasteRoutes = require('./routes/waste');
const citizensRoutes = require('./routes/citizens');
const teamsRoutes = require('./routes/teams');
const reportsRoutes = require('./routes/reports');
const campagneRoutes = require('./routes/campagne');
const parametresRoutes = require('./routes/parametres');
const usersRoutes = require('./routes/users');
const messagesRoutes = require('./routes/messages');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = String(process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Derrière un reverse proxy (Nginx, Traefik...), activez TRUST_PROXY=true
// pour que la limitation de débit utilise la bonne adresse IP.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.disable('x-powered-by');

// Middleware de sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' }
}));
app.use(cors({
  origin: (origin, callback) => {
    // Les appels serveur-à-serveur sans en-tête Origin restent autorisés.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, origin || true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.use(express.json({ limit: '100kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/api', apiLimiter);

// Toutes les réponses de l'API reflètent l'état courant de MySQL : on interdit
// au navigateur et aux proxys de réutiliser une réponse ancienne.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Routes
app.get('/api/health', async (req, res) => {
  let database = 'disconnected';
  try {
    await getPool().query('SELECT 1');
    database = 'connected';
  } catch (error) {
    database = 'disconnected';
  }

  res.json({
    success: true,
    message: 'NAATAL DAKAR API en fonctionnement',
    timestamp: new Date().toISOString(),
    database: { status: database }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/interventions', interventionsRoutes);
app.use('/api/trees', treesRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/citizens', citizensRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/campagne', campagneRoutes);
app.use('/api/parametres', parametresRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// Error handler (toujours en dernier)
app.use(errorHandler);

const start = async () => {
  try {
    assertSecurityConfig();
  } catch (error) {
    console.error(`❌ Configuration de sécurité invalide : ${error.message}`);
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (error) {
    console.error('❌ Initialisation de la base de données échouée :', error.message);
    console.error('   Vérifiez que MySQL est démarré, que les variables DB_* du fichier .env sont correctes');
    console.error('   et que ADMIN_PASSWORD est défini avec un mot de passe fort.');
    process.exit(1);
  }

  const server = http.createServer(app);

  // Socket.IO partage le même serveur HTTP que l'API : un seul port (5000) et
  // donc aucun réglage CORS supplémentaire côté navigateur en production.
  initSocket(server, allowedOrigins);

  server.listen(PORT, () => {
    console.log(`🚀 Serveur NAATAL DAKAR démarré sur http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💬 Messagerie temps réel: ws://localhost:${PORT}/socket.io`);
  });

  const shutdown = async () => {
    await closeRealtime();
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
};

if (require.main === module) {
  start();
}

module.exports = { app, start };
