const { getPool } = require('../config/db');
const { rowToIntervention, generateId } = require('../utils/mappers');
const {
  has,
  text,
  oneOf,
  dateOnly,
  plainObject,
  coordinates,
  identifier
} = require('../utils/validation');

const PILIERS = ['reverdissement', 'salubrite', 'mobilisation'];
const STATUTS = ['planifiee', 'en_cours', 'terminee', 'annulee'];

const readId = (value) => identifier(value, { field: 'Identifiant intervention' });

const readFilters = (query) => {
  const filters = {};
  if (query.pilier !== undefined) {
    filters.pilier = oneOf(query.pilier, PILIERS, { field: 'Pilier', required: true });
  }
  if (query.statut !== undefined) {
    filters.statut = oneOf(query.statut, STATUTS, { field: 'Statut', required: true });
  }
  if (query.quartier !== undefined) {
    filters.quartier = text(query.quartier, { field: 'Quartier', min: 1, max: 100 });
  }
  if (query.search !== undefined) {
    filters.search = text(query.search, { field: 'Recherche', min: 1, max: 100 });
  }
  return filters;
};

const readInterventionFields = (body, { partial = false } = {}) => {
  const fields = {};

  if (!partial || has(body, 'titre')) {
    fields.titre = text(body.titre, { field: 'Titre', min: 3, max: 255, required: true });
  }
  if (!partial || has(body, 'description')) {
    fields.description = text(body.description, { field: 'Description', min: 0, max: 5000, fallback: '' });
  }
  if (!partial || has(body, 'pilier')) {
    fields.pilier = oneOf(body.pilier, PILIERS, { field: 'Pilier', required: true });
  }
  if (!partial || has(body, 'quartier')) {
    fields.quartier = text(body.quartier, { field: 'Quartier', min: 2, max: 150, required: true });
  }
  if (!partial || has(body, 'date')) {
    fields.date = dateOnly(body.date, { field: 'Date', required: true });
  }
  if (!partial || has(body, 'responsable')) {
    fields.responsable = text(body.responsable, { field: 'Responsable', min: 0, max: 150, fallback: '' });
  }
  if (!partial || has(body, 'statut')) {
    fields.statut = oneOf(body.statut, STATUTS, { field: 'Statut', fallback: 'planifiee' });
  }
  if (!partial || has(body, 'objectifs')) {
    fields.objectifs = plainObject(body.objectifs, { field: 'Objectifs', maxBytes: 5000, fallback: {} });
  }
  if (!partial || has(body, 'realisations')) {
    fields.realisations = plainObject(body.realisations, { field: 'Réalisations', maxBytes: 5000, fallback: {} });
  }
  if (!partial || has(body, 'coord')) {
    fields.coord = coordinates(body.coord, { field: 'Coordonnées', fallback: [14.6937, -17.4441] });
  }

  return fields;
};

const getAllInterventions = async (req, res, next) => {
  try {
    const { pilier, statut, quartier, search } = readFilters(req.query);
    const conditions = [];
    const params = [];

    if (pilier) {
      conditions.push('pilier = ?');
      params.push(pilier);
    }
    if (statut) {
      conditions.push('statut = ?');
      params.push(statut);
    }
    if (quartier) {
      conditions.push('quartier LIKE ?');
      params.push(`%${quartier}%`);
    }
    if (search) {
      conditions.push('(titre LIKE ? OR quartier LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await getPool().query(
      `SELECT * FROM interventions ${where} ORDER BY id ASC`,
      params
    );

    const result = rows.map(rowToIntervention);
    res.json({ success: true, dataType: 'mysql', count: result.length, data: result });
  } catch (error) {
    next(error);
  }
};

const getInterventionById = async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    const [rows] = await getPool().query('SELECT * FROM interventions WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Intervention non trouvée' });
    }
    res.json({ success: true, dataType: 'mysql', data: rowToIntervention(rows[0]) });
  } catch (error) {
    next(error);
  }
};

const createIntervention = async (req, res, next) => {
  try {
    const fields = readInterventionFields(req.body);
    const id = await generateId('INT', 'interventions');
    const newIntervention = { id, ...fields };

    await getPool().query(
      `INSERT INTO interventions
         (id, titre, description, pilier, quartier, \`date\`, responsable, statut, objectifs, realisations, coord)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newIntervention.id,
        newIntervention.titre,
        newIntervention.description,
        newIntervention.pilier,
        newIntervention.quartier,
        newIntervention.date,
        newIntervention.responsable,
        newIntervention.statut,
        JSON.stringify(newIntervention.objectifs),
        JSON.stringify(newIntervention.realisations),
        JSON.stringify(newIntervention.coord)
      ]
    );

    res.status(201).json({ success: true, dataType: 'mysql', message: 'Intervention créée', data: newIntervention });
  } catch (error) {
    next(error);
  }
};

const updateIntervention = async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    const [rows] = await getPool().query('SELECT * FROM interventions WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Intervention non trouvée' });
    }

    const current = rowToIntervention(rows[0]);
    const fields = readInterventionFields(req.body, { partial: true });
    const jsonFields = ['objectifs', 'realisations', 'coord'];
    const names = Object.keys(fields);

    if (names.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
    }

    const assignments = names.map((field) => `\`${field}\` = ?`);
    const params = names.map((field) => (
      jsonFields.includes(field) ? JSON.stringify(fields[field]) : fields[field]
    ));
    params.push(id);

    await getPool().query(`UPDATE interventions SET ${assignments.join(', ')} WHERE id = ?`, params);

    res.json({
      success: true,
      dataType: 'mysql',
      message: 'Intervention mise à jour',
      data: { ...current, ...fields }
    });
  } catch (error) {
    next(error);
  }
};

const deleteIntervention = async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    const [result] = await getPool().query('DELETE FROM interventions WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Intervention non trouvée' });
    }
    res.json({ success: true, dataType: 'mysql', message: 'Intervention supprimée' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInterventions,
  getInterventionById,
  createIntervention,
  updateIntervention,
  deleteIntervention
};
