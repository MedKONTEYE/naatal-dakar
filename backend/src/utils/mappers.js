const { getPool, parseJson } = require('../config/db');

const rowToObjectifs = (row) => ({
  arbres: Number(row.arbres),
  survieCible: Number(row.survieCible),
  dechets: Number(row.dechets),
  citoyensSensibilises: Number(row.citoyensSensibilises),
  participantsActifs: Number(row.participantsActifs)
});

const rowToIntervention = (row) => ({
  id: row.id,
  titre: row.titre,
  description: row.description || '',
  pilier: row.pilier,
  quartier: row.quartier,
  date: row.date,
  responsable: row.responsable || '',
  statut: row.statut,
  objectifs: parseJson(row.objectifs, {}),
  realisations: parseJson(row.realisations, {}),
  coord: parseJson(row.coord, [14.6937, -17.4441])
});

const rowToPlantation = (row) => ({
  id: row.id,
  site: row.site,
  espece: row.espece || '',
  arbresPlantes: Number(row.arbresPlantes),
  arbresSurvivants: Number(row.arbresSurvivants),
  arbresNonSurvivants: Number(row.arbresNonSurvivants),
  datePlantation: row.datePlantation,
  responsable: row.responsable || '',
  entretien: row.entretien
});

const rowToArbre = (row) => ({
  id: row.id,
  code: row.code,
  espece: row.espece,
  nomScientifique: row.nomScientifique || '',
  site: row.site || '',
  quartier: row.quartier || '',
  adresse: row.adresse || '',
  coord: parseJson(row.coord, null),
  datePlantation: row.datePlantation,
  hauteur: row.hauteur === null ? null : Number(row.hauteur),
  diametreTronc: row.diametreTronc === null ? null : Number(row.diametreTronc),
  etat: row.etat || '',
  entretien: row.entretien || '',
  responsable: row.responsable || '',
  dernierEntretien: row.dernierEntretien,
  notes: row.notes || ''
});

const rowToEquipe = (row) => ({
  id: row.id,
  nom: row.nom,
  description: row.description || '',
  zone: row.zone || '',
  responsable: row.responsable || '',
  membres: Number(row.membres),
  activitesAttribuees: Number(row.activitesAttribuees),
  statut: row.statut,
  codeInvitation: row.codeInvitation || '',
  codeInvitationActif:
    row.codeInvitationActif === undefined || row.codeInvitationActif === null
      ? true
      : Boolean(Number(row.codeInvitationActif)),
  codeInvitationExpireLe: row.codeInvitationExpireLe || null,
  codeInvitationExpire: Boolean(Number(row.codeInvitationExpire)),
  membresInscrits:
    row.membresInscrits === undefined || row.membresInscrits === null
      ? null
      : Number(row.membresInscrits),
  roleMembre: row.roleMembre || null,
  joinedAt: row.joinedAt || null
});

const rowToCampagne = (row) => ({
  id: row.id,
  nom: row.nom,
  type: row.type || '',
  public: row.publicCible || '',
  participants: Number(row.participants),
  dateDebut: row.dateDebut,
  dateFin: row.dateFin,
  statut: row.statut
});

const generateId = async (prefix, table) => {
  const [rows] = await getPool().query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED)) AS maxId
     FROM \`${table}\` WHERE id LIKE ?`,
    [`${prefix}-%`]
  );
  const next = (Number(rows[0] && rows[0].maxId) || 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
};

module.exports = {
  rowToObjectifs,
  rowToIntervention,
  rowToPlantation,
  rowToArbre,
  rowToEquipe,
  rowToCampagne,
  generateId
};
