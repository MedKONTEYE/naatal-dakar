const bcrypt = require('bcryptjs');
const { objectifs, interventions, plantations, arbres, equipes, campagnes } = require('../utils/demoData');
const { password: validatePassword } = require('../utils/validation');

const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

const isEmpty = async (pool, table) => {
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0].total) === 0;
};

const seedDatabase = async (pool) => {
  const seed = async (table, insert) => {
    if (await isEmpty(pool, table)) {
      await insert();
      return true;
    }
    return false;
  };

  let inserted = false;

  inserted = (await seed('objectifs', () => pool.query(
    `INSERT INTO objectifs (id, arbres, survie_cible, dechets, citoyens_sensibilises, participants_actifs)
     VALUES (1, ?, ?, ?, ?, ?)`,
    [objectifs.arbres, objectifs.survieCible, objectifs.dechets, objectifs.citoyensSensibilises, objectifs.participantsActifs]
  ))) || inserted;

  inserted = (await seed('interventions', () => Promise.all(interventions.map((item) => pool.query(
    `INSERT INTO interventions
       (id, titre, description, pilier, quartier, \`date\`, responsable, statut, objectifs, realisations, coord)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.titre,
      item.description || '',
      item.pilier,
      item.quartier,
      item.date,
      item.responsable || '',
      item.statut || 'planifiee',
      JSON.stringify(item.objectifs || {}),
      JSON.stringify(item.realisations || {}),
      JSON.stringify(item.coord || null)
    ]
  ))))) || inserted;

  inserted = (await seed('plantations', () => Promise.all(plantations.map((item) => pool.query(
    `INSERT INTO plantations
       (id, site, espece, arbres_plantes, arbres_survivants, arbres_non_survivants, date_plantation, responsable, entretien)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.site,
      item.espece || '',
      item.arbresPlantes,
      item.arbresSurvivants,
      item.arbresNonSurvivants,
      item.datePlantation,
      item.responsable || '',
      item.entretien || 'a_faire'
    ]
  ))))) || inserted;

  inserted = (await seed('arbres', () => Promise.all(arbres.map((item) => pool.query(
    `INSERT INTO arbres
       (id, code, espece, nom_scientifique, site, quartier, adresse, coord, date_plantation,
        hauteur, diametre_tronc, etat, entretien, responsable, dernier_entretien, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.code || item.id,
      item.espece,
      item.nomScientifique || '',
      item.site || '',
      item.quartier || '',
      item.adresse || '',
      JSON.stringify(item.coord || null),
      item.datePlantation,
      item.hauteur,
      item.diametreTronc,
      item.etat || '',
      item.entretien || '',
      item.responsable || '',
      item.dernierEntretien,
      item.notes || ''
    ]
  ))))) || inserted;

  inserted = (await seed('equipes', () => Promise.all(equipes.map((item) => pool.query(
    `INSERT INTO equipes
       (id, nom, description, zone, responsable, membres, activites_attribuees, statut,
        code_invitation, code_invitation_actif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      item.id,
      item.nom,
      item.description || '',
      item.zone || '',
      item.responsable || '',
      item.membres,
      item.activitesAttribuees,
      item.statut || 'en_preparation',
      item.codeInvitation
    ]
  ))))) || inserted;

  inserted = (await seed('campagnes', () => Promise.all(campagnes.map((item) => pool.query(
    `INSERT INTO campagnes (id, nom, type, public_cible, participants, date_debut, date_fin, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.nom,
      item.type || '',
      item.public || '',
      item.participants,
      item.dateDebut,
      item.dateFin,
      item.statut || 'planifiee'
    ]
  ))))) || inserted;

  inserted = (await seed('utilisateurs', async () => {
    const email = String(process.env.ADMIN_EMAIL || 'admin@naatal.dakar').trim().toLowerCase();
    const rawPassword = process.env.ADMIN_PASSWORD;
    const nom = String(process.env.ADMIN_NAME || 'Administrateur NAATAL').trim();

    if (!rawPassword) {
      throw new Error(
        'ADMIN_PASSWORD est requis pour créer le compte administrateur initial. ' +
        'Définissez un mot de passe fort dans backend/.env.'
      );
    }

    try {
      validatePassword(rawPassword, { field: 'ADMIN_PASSWORD' });
    } catch (error) {
      throw new Error(`ADMIN_PASSWORD invalide : ${error.message}`);
    }

    const motDePasse = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

    await pool.query(
      `INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif)
       VALUES (?, ?, ?, 'super_admin', 1)`,
      [nom, email, motDePasse]
    );
    console.log(`👤 Compte administrateur créé : ${email}`);
  })) || inserted;

  return inserted;
};

module.exports = { seedDatabase };
