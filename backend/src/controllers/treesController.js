const { getPool } = require('../config/db');
const { rowToPlantation, rowToArbre, generateId } = require('../utils/mappers');
const { getCampagne } = require('../utils/campagne');
const { ValidationError, has, text, integer, dateOnly, oneOf } = require('../utils/validation');

const ARBRE_COLUMNS = `id, code, espece, nom_scientifique AS nomScientifique, site, quartier, adresse, coord,
  date_plantation AS datePlantation, hauteur, diametre_tronc AS diametreTronc, etat, entretien,
  responsable, dernier_entretien AS dernierEntretien, notes`;

const PLANTATION_COLUMNS = `id, site, espece, arbres_plantes AS arbresPlantes,
  arbres_survivants AS arbresSurvivants, arbres_non_survivants AS arbresNonSurvivants,
  date_plantation AS datePlantation, responsable, entretien`;

// Extrait un identifiant d'arbre à partir du contenu du QR code.
// Accepte "ARB-001", "NAATAL-DAKAR:TREE:ARB-001" ou une URL ".../arbre/ARB-001".
const normalizeTreeCode = (value) => {
  if (!value) return '';
  let raw = String(value).trim().slice(0, 255);
  try {
    raw = decodeURIComponent(raw);
  } catch (error) {
    // Contenu non encodé : on garde la valeur brute.
  }
  const match = raw.match(/ARB-[A-Za-z0-9-]+/i);
  return (match ? match[0] : raw).toUpperCase().slice(0, 255);
};

const withLocalisation = (arbre) => ({
  ...arbre,
  localisation: {
    quartier: arbre.quartier,
    adresse: arbre.adresse,
    coordonnees: arbre.coord ? { lat: arbre.coord[0], lng: arbre.coord[1] } : null,
    lienCarte: arbre.coord
      ? `https://www.openstreetmap.org/?mlat=${arbre.coord[0]}&mlon=${arbre.coord[1]}#map=18/${arbre.coord[0]}/${arbre.coord[1]}`
      : null
  }
});

const getArbres = async (req, res, next) => {
  try {
    const [rows] = await getPool().query(`SELECT ${ARBRE_COLUMNS} FROM arbres ORDER BY id ASC`);
    res.json({
      success: true,
      dataType: 'mysql',
      arbres: rows.map(rowToArbre).map(withLocalisation)
    });
  } catch (error) {
    next(error);
  }
};

const getArbreByCode = async (req, res, next) => {
  try {
    const code = normalizeTreeCode(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code QR manquant' });
    }

    // Recherche ciblée : évite de charger toute la table pour un simple scan.
    const [rows] = await getPool().query(
      `SELECT ${ARBRE_COLUMNS} FROM arbres
       WHERE id = ? OR code = ? OR code LIKE ? LIMIT 20`,
      [code, code, `%${code}%`]
    );

    const arbre = rows
      .map(rowToArbre)
      .find((item) => normalizeTreeCode(item.id) === code || normalizeTreeCode(item.code) === code);

    if (!arbre) {
      return res.status(404).json({
        success: false,
        message: 'Aucun arbre trouvé pour ce code QR'
      });
    }

    res.json({ success: true, dataType: 'mysql', arbre: withLocalisation(arbre) });
  } catch (error) {
    next(error);
  }
};

const getTrees = async (req, res, next) => {
  try {
    const [rows] = await getPool().query(`SELECT ${PLANTATION_COLUMNS} FROM plantations ORDER BY id ASC`);
    const plantations = rows.map(rowToPlantation);

    const totalPlantes = plantations.reduce((sum, p) => sum + p.arbresPlantes, 0);
    const totalSurvivants = plantations.reduce((sum, p) => sum + p.arbresSurvivants, 0);
    const totalNonSurvivants = plantations.reduce((sum, p) => sum + p.arbresNonSurvivants, 0);
    const tauxSurvie = totalPlantes > 0 ? Math.round((totalSurvivants / totalPlantes) * 100) : 0;
    const campagne = await getCampagne(getPool());

    res.json({
      success: true,
      dataType: 'mysql',
      stats: {
        arbresPlantes: totalPlantes,
        sites: plantations.length,
        arbresSurvivants: totalSurvivants,
        arbresNonSurvivants: totalNonSurvivants,
        arbresAEntretenir: plantations.filter((p) => p.entretien === 'a_faire').length,
        tauxSurvie,
        periodeMesure: `${campagne.periode} (données partielles)`,
        note: 'Taux de survie calculé sur données partielles - ne correspond pas à une évaluation à 12 mois'
      },
      plantations
    });
  } catch (error) {
    next(error);
  }
};

const ENTRETIEN_VALUES = ['a_faire', 'en_cours', 'termine'];

// Valeur explicite du corps de la requête, ou valeur actuelle de la ligne
// lors d'une modification. `has` permet de distinguer un champ absent d'un
// champ volontairement vidé.
const pick = (source, field, fallback) => (has(source, field) ? source[field] : fallback);

const parsePlantationPayload = (body, existing = null) => {
  const source = body || {};
  const current = existing || {};
  const creating = !existing;

  const site = text(pick(source, 'site', current.site), {
    field: 'Site',
    min: 2,
    max: 255,
    required: true
  });
  const espece = text(pick(source, 'espece', current.espece), {
    field: 'Espèce',
    min: 0,
    max: 255,
    fallback: 'Non spécifiée'
  });
  const arbresPlantes = integer(pick(source, 'arbresPlantes', current.arbresPlantes), {
    field: 'Nombre d’arbres plantés',
    min: 0,
    max: 1000000,
    required: true
  });
  const datePlantation = dateOnly(pick(source, 'datePlantation', current.datePlantation), {
    field: 'Date de plantation',
    fallback: creating ? new Date().toISOString().split('T')[0] : null
  });
  const responsable = text(pick(source, 'responsable', current.responsable), {
    field: 'Responsable',
    min: 0,
    max: 150,
    fallback: ''
  });
  const entretien = oneOf(pick(source, 'entretien', current.entretien), ENTRETIEN_VALUES, {
    field: 'Entretien',
    fallback: 'a_faire'
  }) || 'a_faire';

  const arbresSurvivants = integer(pick(source, 'arbresSurvivants', current.arbresSurvivants), {
    field: 'Arbres survivants',
    min: 0,
    max: arbresPlantes,
    fallback: 0
  });
  const arbresNonSurvivants = integer(
    pick(source, 'arbresNonSurvivants', current.arbresNonSurvivants),
    {
      field: 'Arbres non survivants',
      min: 0,
      max: arbresPlantes,
      fallback: creating ? Math.max(0, arbresPlantes - arbresSurvivants) : 0
    }
  );

  if (arbresSurvivants + arbresNonSurvivants > arbresPlantes) {
    throw new ValidationError(
      'La somme des arbres survivants et non survivants ne peut pas dépasser le nombre d’arbres plantés'
    );
  }

  return {
    site,
    espece,
    arbresPlantes,
    arbresSurvivants,
    arbresNonSurvivants,
    datePlantation,
    responsable,
    entretien
  };
};

const getPlantationById = async (id) => {
  const [rows] = await getPool().query(
    `SELECT ${PLANTATION_COLUMNS} FROM plantations WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows.length > 0 ? rowToPlantation(rows[0]) : null;
};

const createPlantation = async (req, res, next) => {
  try {
    const plantation = parsePlantationPayload(req.body);
    const id = await generateId('PL', 'plantations');

    await getPool().query(
      `INSERT INTO plantations
         (id, site, espece, arbres_plantes, arbres_survivants, arbres_non_survivants,
          date_plantation, responsable, entretien)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        plantation.site,
        plantation.espece,
        plantation.arbresPlantes,
        plantation.arbresSurvivants,
        plantation.arbresNonSurvivants,
        plantation.datePlantation,
        plantation.responsable,
        plantation.entretien
      ]
    );

    res.status(201).json({
      success: true,
      dataType: 'mysql',
      message: 'Plantation enregistrée',
      data: { id, ...plantation }
    });
  } catch (error) {
    next(error);
  }
};

const updatePlantation = async (req, res, next) => {
  try {
    const existing = await getPlantationById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Plantation introuvable' });
    }

    const plantation = parsePlantationPayload(req.body, existing);

    await getPool().query(
      `UPDATE plantations
          SET site = ?, espece = ?, arbres_plantes = ?, arbres_survivants = ?,
              arbres_non_survivants = ?, date_plantation = ?, responsable = ?, entretien = ?
        WHERE id = ?`,
      [
        plantation.site,
        plantation.espece,
        plantation.arbresPlantes,
        plantation.arbresSurvivants,
        plantation.arbresNonSurvivants,
        plantation.datePlantation,
        plantation.responsable,
        plantation.entretien,
        existing.id
      ]
    );

    res.json({
      success: true,
      dataType: 'mysql',
      message: 'Plantation mise à jour',
      data: { id: existing.id, ...plantation }
    });
  } catch (error) {
    next(error);
  }
};

const deletePlantation = async (req, res, next) => {
  try {
    const [result] = await getPool().query('DELETE FROM plantations WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Plantation introuvable' });
    }

    res.json({ success: true, dataType: 'mysql', message: 'Plantation supprimée' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTrees,
  getArbres,
  getArbreByCode,
  createPlantation,
  updatePlantation,
  deletePlantation
};
