const { getPool } = require('../config/db');
const { rowToIntervention, rowToPlantation, rowToEquipe } = require('../utils/mappers');
const { construireEvolution, getCampagne } = require('../utils/campagne');
const { getProgramme, getObjectifs } = require('../utils/parametres');

const getRealisations = (interventions, plantations) => {
  let arbres = 0;
  let dechets = 0;
  let citoyens = 0;

  interventions.forEach((item) => {
    if (item.realisations.arbres) arbres += Number(item.realisations.arbres);
    if (item.realisations.tonnes) dechets += Number(item.realisations.tonnes);
    if (item.realisations.citoyens) citoyens += Number(item.realisations.citoyens);
  });
  plantations.forEach((item) => {
    arbres += item.arbresPlantes;
  });

  // Les réalisations sont des faits : elles ne sont jamais plafonnées par les
  // objectifs prévisionnels. Seule la barre de progression est plafonnée à 100 %.
  return {
    arbres,
    dechets: Math.round(dechets * 10) / 10,
    citoyensSensibilises: citoyens,
    participantsActifs: Math.floor(citoyens * 0.25)
  };
};

const getDashboard = async (req, res, next) => {
  try {
    const pool = getPool();
    const [interventionRows, plantationRows, objectifs, equipeRows, campagne, programme] = await Promise.all([
      pool.query('SELECT * FROM interventions ORDER BY id ASC'),
      pool.query(`SELECT id, site, espece, arbres_plantes AS arbresPlantes,
                         arbres_survivants AS arbresSurvivants,
                         arbres_non_survivants AS arbresNonSurvivants,
                         date_plantation AS datePlantation, responsable, entretien
                  FROM plantations ORDER BY id ASC`),
      getObjectifs(pool),
      pool.query(`SELECT id, nom, zone, responsable, membres,
                         activites_attribuees AS activitesAttribuees, statut
                  FROM equipes`),
      getCampagne(pool),
      getProgramme(pool)
    ]);

    const interventions = interventionRows[0].map(rowToIntervention);
    const plantations = plantationRows[0].map(rowToPlantation);
    const equipes = equipeRows[0].map(rowToEquipe);

    const realisations = getRealisations(interventions, plantations);

    const parPilier = {
      reverdissement: interventions.filter((i) => i.pilier === 'reverdissement').length,
      salubrite: interventions.filter((i) => i.pilier === 'salubrite').length,
      mobilisation: interventions.filter((i) => i.pilier === 'mobilisation').length
    };

    const parStatut = {
      planifiee: interventions.filter((i) => i.statut === 'planifiee').length,
      en_cours: interventions.filter((i) => i.statut === 'en_cours').length,
      terminee: interventions.filter((i) => i.statut === 'terminee').length,
      annulee: interventions.filter((i) => i.statut === 'annulee').length
    };

    const dernieresInterventions = [...interventions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const evolution = construireEvolution(campagne, realisations);

    res.json({
      success: true,
      dataType: 'mysql',
      campagne,
      programme,
      objectifs,
      realisations,
      parPilier,
      parStatut,
      dernieresInterventions,
      evolution,
      sitesAEntretenir: plantations.filter((p) => p.entretien === 'a_faire').length,
      equipesMobilisees: equipes.filter((e) => e.statut === 'mobilisee').length,
      totalEquipes: equipes.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
