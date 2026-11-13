const { getPool } = require('../config/db');
const { getCampagne } = require('../utils/campagne');
const { getProgramme, getObjectifs, rowToProgramme, rowToObjectifs } = require('../utils/parametres');
const {
  text,
  integer,
  decimal
} = require('../utils/validation');

const SELECT_PROGRAMME = `SELECT id, nom, sigle, coordination, initiative, description,
                                 modifie_par AS modifiePar, updated_at AS updatedAt
                          FROM parametres_programme
                          WHERE id = 1`;

const SELECT_OBJECTIFS = `SELECT arbres, survie_cible AS survieCible, dechets,
                                 citoyens_sensibilises AS citoyensSensibilises,
                                 participants_actifs AS participantsActifs,
                                 modifie_par AS modifiePar, updated_at AS updatedAt
                          FROM objectifs
                          WHERE id = 1`;

// GET /api/parametres — informations publiques du programme, objectifs et
// calendrier de campagne. Aucune donnée de permission n'est exposée ici.
const getParametres = async (req, res, next) => {
  try {
    const pool = getPool();
    const [programme, objectifs, campagne] = await Promise.all([
      getProgramme(pool),
      getObjectifs(pool),
      getCampagne(pool)
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, programme, objectifs, campagne });
  } catch (error) {
    next(error);
  }
};

const updateProgramme = async (req, res, next) => {
  try {
    const pool = getPool();
    const body = req.body || {};
    const actuel = await getProgramme(pool);

    const nom = text(body.nom !== undefined ? body.nom : actuel.nom, {
      field: 'Nom du programme',
      min: 2,
      max: 150,
      required: true
    });
    const sigle = text(body.sigle !== undefined ? body.sigle : actuel.sigle, {
      field: 'Sigle',
      min: 0,
      max: 30,
      fallback: ''
    });
    const coordination = text(body.coordination !== undefined ? body.coordination : actuel.coordination, {
      field: 'Coordination',
      min: 0,
      max: 255,
      fallback: ''
    });
    const initiative = text(body.initiative !== undefined ? body.initiative : actuel.initiative, {
      field: 'Initiative',
      min: 0,
      max: 150,
      fallback: ''
    });
    const description = text(body.description !== undefined ? body.description : actuel.description, {
      field: 'Description',
      min: 0,
      max: 2000,
      fallback: ''
    });

    const auteur = req.user ? `${req.user.nom} (${req.user.role})` : 'Administrateur';

    await pool.query(
      `INSERT INTO parametres_programme
         (id, nom, sigle, coordination, initiative, description, modifie_par)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nom = VALUES(nom),
         sigle = VALUES(sigle),
         coordination = VALUES(coordination),
         initiative = VALUES(initiative),
         description = VALUES(description),
         modifie_par = VALUES(modifie_par)`,
      [nom, sigle, coordination, initiative, description, auteur]
    );

    const [rows] = await pool.query(SELECT_PROGRAMME);
    const programme = rowToProgramme(rows[0]);

    res.json({
      success: true,
      message: 'Informations du programme mises à jour.',
      programme
    });
  } catch (error) {
    next(error);
  }
};

const updateObjectifs = async (req, res, next) => {
  try {
    const pool = getPool();
    const body = req.body || {};
    const actuel = await getObjectifs(pool);

    const arbres = integer(body.arbres !== undefined ? body.arbres : actuel.arbres, {
      field: 'Objectif arbres',
      min: 0,
      max: 100000000,
      required: true
    });
    const survieCible = integer(body.survieCible !== undefined ? body.survieCible : actuel.survieCible, {
      field: 'Taux de survie cible',
      min: 0,
      max: 100,
      required: true
    });
    const dechets = decimal(body.dechets !== undefined ? body.dechets : actuel.dechets, {
      field: 'Objectif déchets',
      min: 0,
      max: 99999999.99,
      required: true
    });
    const citoyensSensibilises = integer(
      body.citoyensSensibilises !== undefined ? body.citoyensSensibilises : actuel.citoyensSensibilises,
      { field: 'Objectif citoyens sensibilisés', min: 0, max: 100000000, required: true }
    );
    const participantsActifs = integer(
      body.participantsActifs !== undefined ? body.participantsActifs : actuel.participantsActifs,
      { field: 'Objectif participants actifs', min: 0, max: 100000000, required: true }
    );

    const auteur = req.user ? `${req.user.nom} (${req.user.role})` : 'Administrateur';

    await pool.query(
      `INSERT INTO objectifs
         (id, arbres, survie_cible, dechets, citoyens_sensibilises, participants_actifs, modifie_par)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         arbres = VALUES(arbres),
         survie_cible = VALUES(survie_cible),
         dechets = VALUES(dechets),
         citoyens_sensibilises = VALUES(citoyens_sensibilises),
         participants_actifs = VALUES(participants_actifs),
         modifie_par = VALUES(modifie_par)`,
      [arbres, survieCible, dechets, citoyensSensibilises, participantsActifs, auteur]
    );

    const [rows] = await pool.query(SELECT_OBJECTIFS);
    const objectifs = rowToObjectifs(rows[0]);

    res.json({
      success: true,
      message: 'Objectifs prévisionnels mis à jour.',
      objectifs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getParametres, updateProgramme, updateObjectifs };
