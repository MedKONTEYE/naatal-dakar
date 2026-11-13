const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { connectDB, closeDB } = require('./db');
const { seedDatabase } = require('./seed');

const run = async () => {
  try {
    const pool = await connectDB();
    const seeded = await seedDatabase(pool);
    if (!seeded) {
      console.log('ℹ️  La base contient déjà des données : aucune donnée de démonstration ajoutée.');
    }
    console.log('✅ Base de données prête.');
  } catch (error) {
    console.error('❌ Initialisation MySQL impossible :', error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
};

run();
