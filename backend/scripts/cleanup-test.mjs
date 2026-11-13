const { getPool, initDb } = require('./src/config/db');
(async () => {
  await initDb();
  const pool = getPool();
  const [rows] = await pool.query("SELECT id, site FROM plantations WHERE site LIKE '%script%' OR site LIKE '%<%'");
  console.log('lignes suspectes:', rows);
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const [res] = await pool.query('DELETE FROM plantations WHERE id IN (?)', [ids]);
    console.log('supprimees:', res.affectedRows);
  }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
