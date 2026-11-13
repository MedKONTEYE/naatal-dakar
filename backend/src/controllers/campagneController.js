const { getPool } = require('../config/db');
const {
  DUREE_MAX_JOURS,
  dureeJours,
  getCampagne,
  rowToCampagne
} = require('../utils/campagne');
const { ValidationError, dateOnly, text } = require('../utils/validation');

const SELECT_CAMPAGNE = `SELECT id, nom,
                                date_debut AS dateDebut,
                                date_fin AS dateFin,
                                modifie_par AS modifiePar,
                                updated_at AS updatedAt
                         FROM parametres_campagne
                         WHERE id = 1`;

// Lecture publique : la période de campagne est une information institutionnelle
// consultable par tous les agents, y compris en lecture seule.
const readCampagne = async (req, res, next) => {
  try {
    const campagne = await getCampagne(getPool());
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, campagne });
  } catch (error) {
    next(error);
  }
};

// Écriture réservée aux titulaires de la permission « settings.manage »
// (administrateur et super administrateur). Le contrôle est refait côté
// serveur à chaque requête, indépendamment de l'interface.
const updateCampagne = async (req, res, next) => {
  try {
    const pool = getPool();
    const body = req.body || {};
    const actuelle = await getCampagne(pool);

    const dateDebut = dateOnly(body.dateDebut, { field: 'Date de début', required: true });
    const dateFin = dateOnly(body.dateFin, { field: 'Date de fin', required: true });

    if (dateFin < dateDebut) {
      throw new ValidationError('La date de fin doit être égale ou postérieure à la date de début');
    }

    const duree = dureeJours(dateDebut, dateFin);
    if (duree > DUREE_MAX_JOURS) {
      throw new ValidationError(`La durée de la campagne ne doit pas dépasser ${DUREE_MAX_JOURS} jours`);
    }

    const nom = text(body.nom, {
      field: 'Nom de la campagne',
      min: 1,
      max: 255,
      required: false,
      fallback: actuelle.nom
    });

    const auteur = req.user ? `${req.user.nom} (${req.user.role})` : 'Administrateur';

    await pool.query(
      `INSERT INTO parametres_campagne (id, nom, date_debut, date_fin, modifie_par)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nom = VALUES(nom),
         date_debut = VALUES(date_debut),
         date_fin = VALUES(date_fin),
         modifie_par = VALUES(modifie_par)`,
      [nom, dateDebut, dateFin, auteur]
    );

    const [rows] = await pool.query(SELECT_CAMPAGNE);
    const campagne = rowToCampagne(rows[0]);

    res.json({
      success: true,
      message: `Période de campagne mise à jour : ${campagne.libelle}.`,
      campagne
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { readCampagne, updateCampagne };
