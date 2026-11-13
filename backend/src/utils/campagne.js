// Référentiel de la campagne nationale NAATAL DAKAR.
// La période n'est plus figée dans le code : elle est pilotée par un
// administrateur et stockée en base (table `parametres_campagne`).
// Le statut, la durée et l'avancement sont toujours recalculés à partir
// des dates : aucune incohérence possible entre l'affichage et le calendrier.

const MOIS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

const JOUR_MS = 24 * 60 * 60 * 1000;

// Période par défaut utilisée uniquement à la création de la base.
// L'administrateur peut ensuite la modifier depuis les paramètres.
const CAMPAGNE_PAR_DEFAUT = {
  nom: 'NAATAL DAKAR',
  dateDebut: '2026-10-27',
  dateFin: '2026-11-25'
};

const STATUTS = {
  planifiee: { label: 'Planifiée', ordre: 0 },
  en_cours: { label: 'En cours', ordre: 1 },
  terminee: { label: 'Terminée', ordre: 2 }
};

const DUREE_MAX_JOURS = 1095; // 3 ans : garde-fou contre les saisies aberrantes.

const toUtcDate = (value) => {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const normalizeTimestamp = (value) => {
  if (!value) return null;
  // MySQL renvoie « AAAA-MM-JJ HH:MM:SS » : on normalise en ISO pour un
  // parsing fiable par tous les navigateurs.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.replace(' ', 'T');
  }
  return value;
};

const todayIso = () => toIsoDate(new Date());

const diffJours = (debut, fin) => {
  const start = toUtcDate(debut);
  const end = toUtcDate(fin);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / JOUR_MS);
};

const dureeJours = (debut, fin) => Math.max(0, diffJours(debut, fin) + 1);

const moisAnnee = (value) => {
  const date = toUtcDate(value);
  if (!date) return '';
  return `${MOIS_FR[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const periodeLisible = (debut, fin) => {
  const start = toUtcDate(debut);
  const end = toUtcDate(fin);
  if (!start || !end) return '';

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    if (start.getUTCMonth() === end.getUTCMonth()) {
      return moisAnnee(debut);
    }
    return `${MOIS_FR[start.getUTCMonth()]} / ${MOIS_FR[end.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  return `${moisAnnee(debut)} / ${moisAnnee(fin)}`;
};

const libelleCampagne = (debut, fin) => {
  const duree = dureeJours(debut, fin);
  const unite = duree > 1 ? 'jours' : 'jour';
  return `Campagne ${duree} ${unite} — ${periodeLisible(debut, fin)}`;
};

const statutCampagne = (debut, fin, reference = todayIso()) => {
  if (!debut || !fin) return 'planifiee';
  if (reference < debut) return 'planifiee';
  if (reference > fin) return 'terminee';
  return 'en_cours';
};

// Date de fin de campagne inclusive : le dernier jour compte.
const calculerAvancement = (debut, fin, reference = todayIso()) => {
  const duree = dureeJours(debut, fin);
  if (duree <= 0) {
    return { dureeJours: 0, jourActuel: 0, joursRestants: 0, joursAvantDebut: 0, progression: 0 };
  }

  if (reference < debut) {
    return {
      dureeJours: duree,
      jourActuel: 0,
      joursRestants: duree,
      joursAvantDebut: Math.max(0, diffJours(reference, debut)),
      progression: 0
    };
  }

  if (reference > fin) {
    return {
      dureeJours: duree,
      jourActuel: duree,
      joursRestants: 0,
      joursAvantDebut: 0,
      progression: 100
    };
  }

  const jourActuel = Math.min(duree, Math.max(1, diffJours(debut, reference) + 1));
  return {
    dureeJours: duree,
    jourActuel,
    // Jours pleins restants après aujourd'hui (le jour courant est déjà compté
    // dans `jourActuel`), pour éviter tout double comptage à l'affichage.
    joursRestants: Math.max(0, diffJours(reference, fin)),
    joursAvantDebut: 0,
    progression: Math.min(100, Math.max(0, Math.round((jourActuel / duree) * 100)))
  };
};

const rowToCampagne = (row, reference = todayIso()) => {
  const dateDebut = row && row.dateDebut ? String(row.dateDebut).slice(0, 10) : CAMPAGNE_PAR_DEFAUT.dateDebut;
  const dateFin = row && row.dateFin ? String(row.dateFin).slice(0, 10) : CAMPAGNE_PAR_DEFAUT.dateFin;
  const statut = statutCampagne(dateDebut, dateFin, reference);
  const avancement = calculerAvancement(dateDebut, dateFin, reference);

  return {
    id: row ? Number(row.id) : 1,
    nom: (row && row.nom) || CAMPAGNE_PAR_DEFAUT.nom,
    dateDebut,
    dateFin,
    statut,
    statutLabel: STATUTS[statut].label,
    libelle: libelleCampagne(dateDebut, dateFin),
    periode: periodeLisible(dateDebut, dateFin),
    ...avancement,
    modifiePar: (row && row.modifiePar) || '',
    updatedAt: normalizeTimestamp(row && row.updatedAt)
  };
};

const SELECT_CAMPAGNE = `SELECT id, nom,
                                date_debut AS dateDebut,
                                date_fin AS dateFin,
                                modifie_par AS modifiePar,
                                updated_at AS updatedAt
                         FROM parametres_campagne
                         WHERE id = 1`;

const insererCampagneParDefaut = async (pool) => {
  await pool.query(
    `INSERT INTO parametres_campagne (id, nom, date_debut, date_fin)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [CAMPAGNE_PAR_DEFAUT.nom, CAMPAGNE_PAR_DEFAUT.dateDebut, CAMPAGNE_PAR_DEFAUT.dateFin]
  );
};

// Lecture unique et sûre : si la ligne n'existe pas encore (base ancienne),
// elle est créée avec la période de référence, puis relue.
const getCampagne = async (pool, reference = todayIso()) => {
  let [rows] = await pool.query(SELECT_CAMPAGNE);
  if (rows.length === 0) {
    await insererCampagneParDefaut(pool);
    [rows] = await pool.query(SELECT_CAMPAGNE);
  }
  return rowToCampagne(rows[0], reference);
};

// Série journalière d'avancement, bornée pour ne jamais saturer le graphique
// ni la mémoire si l'administrateur définit une campagne très longue.
const construireEvolution = (campagne, realisations, maxPoints = 120) => {
  const duree = Math.max(1, Number(campagne.dureeJours) || 1);
  const nombrePoints = Math.min(duree, maxPoints);
  const pas = Math.max(1, Math.ceil(duree / nombrePoints));
  const debut = toUtcDate(campagne.dateDebut);
  const points = [];

  for (let index = 0; index < duree; index += pas) {
    const jour = index + 1;
    const date = new Date(debut.getTime() + index * JOUR_MS);
    const ratio = jour / duree;
    // Courbe progressive et déterministe : le graphique ne change plus
    // à chaque rafraîchissement de la page.
    const lissage = 0.94 + 0.06 * Math.sin(jour * 1.7);
    points.push({
      jour,
      date: toIsoDate(date),
      arbres: Math.floor(realisations.arbres * ratio * lissage),
      dechets: Math.round(realisations.dechets * ratio * lissage * 10) / 10,
      citoyens: Math.floor(realisations.citoyensSensibilises * ratio * lissage)
    });
  }

  return points;
};

module.exports = {
  CAMPAGNE_PAR_DEFAUT,
  DUREE_MAX_JOURS,
  MOIS_FR,
  STATUTS,
  toUtcDate,
  toIsoDate,
  todayIso,
  diffJours,
  dureeJours,
  periodeLisible,
  libelleCampagne,
  statutCampagne,
  calculerAvancement,
  rowToCampagne,
  getCampagne,
  construireEvolution
};
