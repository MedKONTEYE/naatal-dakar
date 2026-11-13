// Paramètres institutionnels du programme NAATAL DAKAR.
// Ligne unique (id = 1) : l'administrateur peut modifier librement les
// informations du programme et les objectifs prévisionnels.

const PROGRAMME_PAR_DEFAUT = {
  nom: 'NAATAL DAKAR',
  sigle: 'DPDD',
  coordination: 'Direction de la Planification et du Développement Durable',
  initiative: 'Ville de Dakar',
  description:
    "NAATAL DAKAR est l'initiative de la Ville de Dakar pour le reverdissement, " +
    'la salubrité et la mobilisation citoyenne en faveur d’un Dakar plus vert et plus propre.'
};

const OBJECTIFS_PAR_DEFAUT = {
  arbres: 30000,
  survieCible: 80,
  dechets: 450,
  citoyensSensibilises: 100000,
  participantsActifs: 25000
};

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

const normalizeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.replace(' ', 'T');
  }
  return value;
};

const rowToProgramme = (row) => ({
  id: row ? Number(row.id) : 1,
  nom: row ? row.nom || '' : PROGRAMME_PAR_DEFAUT.nom,
  sigle: row ? row.sigle || '' : PROGRAMME_PAR_DEFAUT.sigle,
  coordination: (row && row.coordination) || '',
  initiative: (row && row.initiative) || '',
  description: (row && row.description) || '',
  modifiePar: (row && row.modifiePar) || '',
  updatedAt: normalizeTimestamp(row && row.updatedAt)
});

const rowToObjectifs = (row) => ({
  arbres: row ? Number(row.arbres) : OBJECTIFS_PAR_DEFAUT.arbres,
  survieCible: row ? Number(row.survieCible) : OBJECTIFS_PAR_DEFAUT.survieCible,
  dechets: row ? Number(row.dechets) : OBJECTIFS_PAR_DEFAUT.dechets,
  citoyensSensibilises: row ? Number(row.citoyensSensibilises) : OBJECTIFS_PAR_DEFAUT.citoyensSensibilises,
  participantsActifs: row ? Number(row.participantsActifs) : OBJECTIFS_PAR_DEFAUT.participantsActifs,
  modifiePar: (row && row.modifiePar) || '',
  updatedAt: normalizeTimestamp(row && row.updatedAt)
});

const insererProgrammeParDefaut = async (pool) => {
  await pool.query(
    `INSERT INTO parametres_programme
       (id, nom, sigle, coordination, initiative, description)
     VALUES (1, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [
      PROGRAMME_PAR_DEFAUT.nom,
      PROGRAMME_PAR_DEFAUT.sigle,
      PROGRAMME_PAR_DEFAUT.coordination,
      PROGRAMME_PAR_DEFAUT.initiative,
      PROGRAMME_PAR_DEFAUT.description
    ]
  );
};

const insererObjectifsParDefaut = async (pool) => {
  await pool.query(
    `INSERT INTO objectifs
       (id, arbres, survie_cible, dechets, citoyens_sensibilises, participants_actifs)
     VALUES (1, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [
      OBJECTIFS_PAR_DEFAUT.arbres,
      OBJECTIFS_PAR_DEFAUT.survieCible,
      OBJECTIFS_PAR_DEFAUT.dechets,
      OBJECTIFS_PAR_DEFAUT.citoyensSensibilises,
      OBJECTIFS_PAR_DEFAUT.participantsActifs
    ]
  );
};

const getProgramme = async (pool) => {
  let [rows] = await pool.query(SELECT_PROGRAMME);
  if (rows.length === 0) {
    await insererProgrammeParDefaut(pool);
    [rows] = await pool.query(SELECT_PROGRAMME);
  }
  return rowToProgramme(rows[0]);
};

const getObjectifs = async (pool) => {
  let [rows] = await pool.query(SELECT_OBJECTIFS);
  if (rows.length === 0) {
    await insererObjectifsParDefaut(pool);
    [rows] = await pool.query(SELECT_OBJECTIFS);
  }
  return rowToObjectifs(rows[0]);
};

const ensureParametres = async (pool) => {
  await Promise.all([getProgramme(pool), getObjectifs(pool)]);
};

module.exports = {
  PROGRAMME_PAR_DEFAUT,
  OBJECTIFS_PAR_DEFAUT,
  rowToProgramme,
  rowToObjectifs,
  getProgramme,
  getObjectifs,
  ensureParametres
};
