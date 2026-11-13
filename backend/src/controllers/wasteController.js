const { getPool } = require('../config/db');
const { rowToIntervention } = require('../utils/mappers');

const getWaste = async (req, res, next) => {
  try {
    const pool = getPool();
    const [interventionRows, equipeRows] = await Promise.all([
      pool.query("SELECT * FROM interventions WHERE pilier = 'salubrite' ORDER BY id ASC"),
      pool.query("SELECT COUNT(*) AS total FROM equipes WHERE statut = 'mobilisee'")
    ]);

    const nettoyages = interventionRows[0].map(rowToIntervention);
    const totalCollecte = nettoyages.reduce((sum, n) => sum + Number(n.realisations.tonnes || 0), 0);

    const parZone = {};
    nettoyages.forEach((n) => {
      if (!parZone[n.quartier]) parZone[n.quartier] = 0;
      parZone[n.quartier] += Number(n.realisations.tonnes || 0);
    });

    res.json({
      success: true,
      dataType: 'mysql',
      stats: {
        tonnesCollectees: Math.round(totalCollecte * 10) / 10,
        operations: nettoyages.length,
        enAttente: nettoyages.filter((n) => n.statut === 'planifiee').length,
        enCours: nettoyages.filter((n) => n.statut === 'en_cours').length,
        terminees: nettoyages.filter((n) => n.statut === 'terminee').length,
        equipesMobilisees: Number(equipeRows[0][0].total)
      },
      nettoyages,
      parZone: Object.entries(parZone).map(([zone, tonnes]) => ({ zone, tonnes })),
      note: 'Déchets collectés uniquement. Données de tri/valorisation non disponibles.'
    });
  } catch (error) {
    next(error);
  }
};

const createWaste = async (req, res, next) => {
  try {
    res.status(201).json({ success: true, dataType: 'mysql', message: 'Opération enregistrée' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWaste, createWaste };
