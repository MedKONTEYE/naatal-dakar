const { getPool } = require('../config/db');
const { rowToIntervention, rowToPlantation } = require('../utils/mappers');
const { getCampagne } = require('../utils/campagne');
const { getObjectifs } = require('../utils/parametres');

const getReports = async (req, res, next) => {
  try {
    const pool = getPool();
    const [interventionRows, plantationRows, objectifs, campagne] = await Promise.all([
      pool.query('SELECT * FROM interventions ORDER BY id ASC'),
      pool.query(`SELECT id, site, espece, arbres_plantes AS arbresPlantes,
                         arbres_survivants AS arbresSurvivants,
                         arbres_non_survivants AS arbresNonSurvivants,
                         date_plantation AS datePlantation, responsable, entretien
                  FROM plantations ORDER BY id ASC`),
      getObjectifs(pool),
      getCampagne(pool)
    ]);

    const interventions = interventionRows[0].map(rowToIntervention);
    const plantations = plantationRows[0].map(rowToPlantation);

    const arbresInterventions = interventions
      .filter((i) => i.pilier === 'reverdissement')
      .reduce((sum, i) => sum + Number(i.realisations.arbres || 0), 0);
    const arbresPlantations = plantations.reduce((sum, p) => sum + p.arbresPlantes, 0);
    const dechetsRealises = interventions
      .filter((i) => i.pilier === 'salubrite')
      .reduce((sum, i) => sum + Number(i.realisations.tonnes || 0), 0);
    const citoyensRealises = interventions
      .filter((i) => i.pilier === 'mobilisation')
      .reduce((sum, i) => sum + Number(i.realisations.citoyens || 0), 0);

    const realisations = {
      arbres: arbresInterventions + arbresPlantations,
      dechets: Math.round(dechetsRealises * 10) / 10,
      citoyensSensibilises: citoyensRealises,
      participantsActifs: Math.floor(citoyensRealises * 0.25)
    };

    const parPilier = {
      reverdissement: {
        objectif: objectifs.arbres,
        realise: arbresInterventions + arbresPlantations,
        interventions: interventions.filter((i) => i.pilier === 'reverdissement').length
      },
      salubrite: {
        objectif: objectifs.dechets,
        realise: dechetsRealises,
        interventions: interventions.filter((i) => i.pilier === 'salubrite').length
      },
      mobilisation: {
        objectif: objectifs.citoyensSensibilises,
        realise: citoyensRealises,
        interventions: interventions.filter((i) => i.pilier === 'mobilisation').length
      }
    };

    const parQuartier = {};
    interventions.forEach((item) => {
      if (!parQuartier[item.quartier]) {
        parQuartier[item.quartier] = { interventions: 0, terminees: 0 };
      }
      parQuartier[item.quartier].interventions++;
      if (item.statut === 'terminee') parQuartier[item.quartier].terminees++;
    });

    res.json({
      success: true,
      dataType: 'mysql',
      campagne,
      objectifs,
      realisations,
      parPilier,
      parQuartier: Object.entries(parQuartier).map(([quartier, data]) => ({ quartier, ...data })),
      activitesTerminees: interventions.filter((i) => i.statut === 'terminee').length,
      totalInterventions: interventions.length,
      objectifsRestants: {
        arbres: Math.max(0, objectifs.arbres - parPilier.reverdissement.realise),
        dechets: Math.max(0, objectifs.dechets - parPilier.salubrite.realise),
        citoyens: Math.max(0, objectifs.citoyensSensibilises - parPilier.mobilisation.realise)
      },
      periode: campagne.libelle,
      note: 'Rapport basé sur les données MySQL. Distinguer données simulées des données réelles.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReports };
