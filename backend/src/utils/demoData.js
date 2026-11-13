const objectifs = {
  arbres: 30000,
  survieCible: 80,
  dechets: 450,
  citoyensSensibilises: 100000,
  participantsActifs: 25000
};

let interventions = [
  {
    id: 'INT-001',
    titre: 'Plantation communautaire Medina',
    description: 'Campagne de reverdissement avec les habitants',
    pilier: 'reverdissement',
    quartier: 'Medina',
    date: '2026-10-28',
    responsable: 'Equipe Verte Medina',
    statut: 'en_cours',
    objectifs: { arbres: 500 },
    realisations: { arbres: 320 },
    coord: [14.676, -17.446]
  },
  {
    id: 'INT-002',
    titre: 'Nettoyage Marché Sandaga',
    description: 'Operation de salubrite',
    pilier: 'salubrite',
    quartier: 'Marché Sandaga',
    date: '2026-10-29',
    responsable: 'Brigade Proprete Centre',
    statut: 'en_cours',
    objectifs: { tonnes: 15 },
    realisations: { tonnes: 12 },
    coord: [14.672, -17.438]
  },
  {
    id: 'INT-003',
    titre: 'Sensibilisation Lycee Fann',
    description: 'Sensibilisation environnementale',
    pilier: 'mobilisation',
    quartier: 'Fann',
    date: '2026-10-30',
    responsable: 'Cellule Education',
    statut: 'terminee',
    objectifs: { citoyens: 450 },
    realisations: { citoyens: 480 },
    coord: [14.693, -17.467]
  },
  {
    id: 'INT-004',
    titre: 'Reverdissement VDN',
    description: 'Plantation le long de la VDN',
    pilier: 'reverdissement',
    quartier: 'VDN',
    date: '2026-11-01',
    responsable: 'Equipe Verte VDN',
    statut: 'planifiee',
    objectifs: { arbres: 800 },
    realisations: { arbres: 0 },
    coord: [14.732, -17.457]
  },
  {
    id: 'INT-005',
    titre: 'Nettoyage Baie de Hann',
    description: 'Nettoyage de la baie',
    pilier: 'salubrite',
    quartier: 'Baie de Hann',
    date: '2026-11-02',
    responsable: 'Brigade Côtière',
    statut: 'en_cours',
    objectifs: { tonnes: 35 },
    realisations: { tonnes: 18 },
    coord: [14.725, -17.432]
  },
  {
    id: 'INT-006',
    titre: 'Sensibilisation Grand Yoff',
    description: 'Caravane citoyenne',
    pilier: 'mobilisation',
    quartier: 'Grand Yoff',
    date: '2026-10-31',
    responsable: 'Cellule Mobilisation',
    statut: 'terminee',
    objectifs: { citoyens: 600 },
    realisations: { citoyens: 650 },
    coord: [14.752, -17.454]
  },
  {
    id: 'INT-007',
    titre: 'Plantation Parc de Hann',
    description: 'Renforcement du couvert forestier',
    pilier: 'reverdissement',
    quartier: 'Parc de Hann',
    date: '2026-11-03',
    responsable: 'Equipe Foresterie',
    statut: 'planifiee',
    objectifs: { arbres: 1200 },
    realisations: { arbres: 0 },
    coord: [14.722, -17.435]
  },
  {
    id: 'INT-008',
    titre: 'Nettoyage Corniche Ouest',
    description: 'Nettoyage du front de mer',
    pilier: 'salubrite',
    quartier: 'Corniche Ouest',
    date: '2026-11-04',
    responsable: 'Brigade Littorale',
    statut: 'planifiee',
    objectifs: { tonnes: 20 },
    realisations: { tonnes: 0 },
    coord: [14.665, -17.435]
  },
  {
    id: 'INT-009',
    titre: 'Sensibilisation Marché Tilène',
    description: 'Sensibilisation des commerçants',
    pilier: 'mobilisation',
    quartier: 'Marché Tilène',
    date: '2026-11-05',
    responsable: 'Cellule Commerce Vert',
    statut: 'planifiee',
    objectifs: { citoyens: 300 },
    realisations: { citoyens: 0 },
    coord: [14.687, -17.448]
  },
  {
    id: 'INT-010',
    titre: 'Plantation Biscuiterie',
    description: 'Reverdissement urbain',
    pilier: 'reverdissement',
    quartier: 'Biscuiterie',
    date: '2026-11-06',
    responsable: 'Equipe Verte Biscuiterie',
    statut: 'planifiee',
    objectifs: { arbres: 600 },
    realisations: { arbres: 0 },
    coord: [14.701, -17.451]
  }
];

const plantations = [
  { id: 'PL-001', site: 'Medina - Place communale', espece: 'Neem, Cassia', arbresPlantes: 320, arbresSurvivants: 285, arbresNonSurvivants: 35, datePlantation: '2026-10-28', responsable: 'Equipe Verte Medina', entretien: 'en_cours' },
  { id: 'PL-002', site: 'Fann Residence', espece: 'Acacia, Albizia', arbresPlantes: 150, arbresSurvivants: 138, arbresNonSurvivants: 12, datePlantation: '2026-10-25', responsable: 'Equipe Verte Fann', entretien: 'a_faire' }
];

// Arbres individuels identifiables par QR code.
// Le champ `code` est le contenu encodé dans le QR code collé sur l'arbre.
const arbres = [
  {
    id: 'ARB-001',
    code: 'https://naatal.dakar/arbre/ARB-001',
    espece: 'Neem',
    nomScientifique: 'Azadirachta indica',
    site: 'Medina - Place communale',
    quartier: 'Medina',
    adresse: 'Place communale, face à la mosquée',
    coord: [14.676, -17.446],
    datePlantation: '2026-10-28',
    hauteur: 3.2,
    diametreTronc: 18,
    etat: 'bon',
    entretien: 'a_jour',
    responsable: 'Equipe Verte Medina',
    dernierEntretien: '2026-11-12',
    notes: 'Arrosage hebdomadaire effectué, tuteurage en place.'
  },
  {
    id: 'ARB-002',
    code: 'https://naatal.dakar/arbre/ARB-002',
    espece: 'Cassia',
    nomScientifique: 'Cassia siamea',
    site: 'Medina - Place communale',
    quartier: 'Medina',
    adresse: 'Place communale, allée est',
    coord: [14.6768, -17.4452],
    datePlantation: '2026-10-28',
    hauteur: 2.7,
    diametreTronc: 14,
    etat: 'moyen',
    entretien: 'a_faire',
    responsable: 'Equipe Verte Medina',
    dernierEntretien: '2026-11-05',
    notes: 'Feuillage clairsemé, prévoir un arrosage supplémentaire.'
  },
  {
    id: 'ARB-003',
    code: 'https://naatal.dakar/arbre/ARB-003',
    espece: 'Acacia',
    nomScientifique: 'Acacia senegalensis',
    site: 'Fann Residence',
    quartier: 'Fann',
    adresse: 'Avenue Cheikh Anta Diop, côté résidence',
    coord: [14.693, -17.467],
    datePlantation: '2026-10-25',
    hauteur: 4.1,
    diametreTronc: 22,
    etat: 'bon',
    entretien: 'a_jour',
    responsable: 'Equipe Verte Fann',
    dernierEntretien: '2026-11-14',
    notes: 'Bonne reprise, protection anti-bétail installée.'
  },
  {
    id: 'ARB-004',
    code: 'https://naatal.dakar/arbre/ARB-004',
    espece: 'Albizia',
    nomScientifique: 'Albizia lebbeck',
    site: 'Fann Residence',
    quartier: 'Fann',
    adresse: 'Rue de Fann, près du jardin public',
    coord: [14.6924, -17.4662],
    datePlantation: '2026-10-25',
    hauteur: 2.4,
    diametreTronc: 12,
    etat: 'faible',
    entretien: 'a_faire',
    responsable: 'Equipe Verte Fann',
    dernierEntretien: '2026-11-02',
    notes: 'Attaque de pucerons signalée, traitement à prévoir.'
  },
  {
    id: 'ARB-005',
    code: 'https://naatal.dakar/arbre/ARB-005',
    espece: 'Manguier',
    nomScientifique: 'Mangifera indica',
    site: 'VDN - Tronçon Nord',
    quartier: 'VDN',
    adresse: 'Voie de Dégagement Nord, terre-plein central',
    coord: [14.732, -17.457],
    datePlantation: '2026-11-01',
    hauteur: 3.6,
    diametreTronc: 20,
    etat: 'bon',
    entretien: 'a_jour',
    responsable: 'Equipe Verte VDN',
    dernierEntretien: '2026-11-16',
    notes: 'Arbre vigoureux, paillage réalisé.'
  },
  {
    id: 'ARB-006',
    code: 'https://naatal.dakar/arbre/ARB-006',
    espece: 'Baobab',
    nomScientifique: 'Adansonia digitata',
    site: 'Parc de Hann',
    quartier: 'Parc de Hann',
    adresse: 'Entrée principale du parc, à gauche',
    coord: [14.722, -17.435],
    datePlantation: '2026-11-03',
    hauteur: 1.9,
    diametreTronc: 10,
    etat: 'moyen',
    entretien: 'a_faire',
    responsable: 'Equipe Foresterie',
    dernierEntretien: '2026-11-10',
    notes: 'Jeune plant, protection renforcée nécessaire.'
  }
];

const equipes = [
  { id: 'EQ-001', nom: 'Equipe Verte Medina', description: 'Plantation et entretien des arbres dans le quartier de la Medina.', zone: 'Medina', responsable: 'Mamadou Diop (fictif)', membres: 12, activitesAttribuees: 3, statut: 'mobilisee', codeInvitation: 'NDK-EQ001' },
  { id: 'EQ-002', nom: 'Brigade Proprete Centre', description: 'Nettoyage et sensibilisation à la salubrité dans le centre-ville.', zone: 'Centre-ville', responsable: 'Aissatou Ndiaye (fictive)', membres: 15, activitesAttribuees: 2, statut: 'mobilisee', codeInvitation: 'NDK-EQ002' },
  { id: 'EQ-003', nom: 'Cellule Mobilisation', description: 'Caravanes et actions de mobilisation citoyenne à Grand Dakar.', zone: 'Grand Dakar', responsable: 'Ousmane Fall (fictif)', membres: 8, activitesAttribuees: 4, statut: 'mobilisee', codeInvitation: 'NDK-EQ003' },
  { id: 'EQ-004', nom: 'Brigade Côtière', description: 'Protection du littoral et nettoyage de la baie de Hann.', zone: 'Baie de Hann/Corniche', responsable: 'Fatou Sarr (fictive)', membres: 10, activitesAttribuees: 2, statut: 'en_preparation', codeInvitation: 'NDK-EQ004' }
];

const campagnes = [
  { id: 'CAM-001', nom: 'Semaine Environnementale Ecoles', type: 'sensibilisation', public: 'Ecoles primaires/secondaires', participants: 1130, dateDebut: '2026-10-27', dateFin: '2026-10-31', statut: 'en_cours' },
  { id: 'CAM-002', nom: 'Caravane Citoyenne Grand Yoff', type: 'caravane', public: 'Grand public', participants: 650, dateDebut: '2026-10-31', dateFin: '2026-10-31', statut: 'terminee' }
];

module.exports = {
  objectifs,
  interventions,
  plantations,
  arbres,
  equipes,
  campagnes,
  getRealisations: () => {
    let arbres = 0, dechets = 0, citoyens = 0;
    interventions.forEach(i => {
      if (i.realisations.arbres) arbres += i.realisations.arbres;
      if (i.realisations.tonnes) dechets += i.realisations.tonnes;
      if (i.realisations.citoyens) citoyens += i.realisations.citoyens;
    });
    plantations.forEach(p => { arbres += p.arbresPlantes; });
    return {
      arbres: Math.min(arbres, objectifs.arbres),
      dechets: Math.min(Math.round(dechets * 10) / 10, objectifs.dechets),
      citoyensSensibilises: Math.min(citoyens, objectifs.citoyensSensibilises),
      participantsActifs: Math.min(Math.floor(citoyens * 0.25), objectifs.participantsActifs)
    };
  }
};
