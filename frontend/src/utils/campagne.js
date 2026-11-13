// Utilitaires d'affichage de la campagne.
// Le backend reste la source de vérité (libellé, statut, durée) ; ces fonctions
// servent à l'aperçu immédiat du formulaire administrateur.

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

const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const parseDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateFr = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  const jour = String(date.getUTCDate()).padStart(2, '0');
  return `${jour} ${MOIS_FR[date.getUTCMonth()].toLowerCase()} ${date.getUTCFullYear()}`;
};

export const formatDateShortFr = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
};

export const diffJours = (debut, fin) => {
  const start = parseDateOnly(debut);
  const end = parseDateOnly(fin);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / JOUR_MS);
};

export const calculerDureeJours = (debut, fin) => Math.max(0, diffJours(debut, fin) + 1);

export const periodeLisible = (debut, fin) => {
  const start = parseDateOnly(debut);
  const end = parseDateOnly(fin);
  if (!start || !end) return '';

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    if (start.getUTCMonth() === end.getUTCMonth()) {
      return `${MOIS_FR[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
    }
    return `${MOIS_FR[start.getUTCMonth()]} / ${MOIS_FR[end.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  return `${MOIS_FR[start.getUTCMonth()]} ${start.getUTCFullYear()} / ${MOIS_FR[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
};

export const libelleCampagne = (debut, fin) => {
  const duree = calculerDureeJours(debut, fin);
  if (!duree) return '';
  return `Campagne ${duree} ${duree > 1 ? 'jours' : 'jour'} — ${periodeLisible(debut, fin)}`;
};

export const statutCampagne = (debut, fin) => {
  if (!debut || !fin) return 'planifiee';
  const reference = todayIso();
  if (reference < debut) return 'planifiee';
  if (reference > fin) return 'terminee';
  return 'en_cours';
};

export const STATUT_LABELS = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée'
};

export const STATUT_STYLES = {
  planifiee: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_cours: 'bg-green-100 text-green-800 border-green-200',
  terminee: 'bg-gray-100 text-gray-700 border-gray-200'
};

// Aperçu local utilisé dans le formulaire : aucune écriture tant que
// l'administrateur n'a pas validé explicitement.
export const computeCampagnePreview = (dateDebut, dateFin) => {
  if (!dateDebut || !dateFin) return null;
  if (dateFin < dateDebut) {
    return { error: 'La date de fin doit être égale ou postérieure à la date de début.' };
  }
  const dureeJours = calculerDureeJours(dateDebut, dateFin);
  return {
    dureeJours,
    libelle: libelleCampagne(dateDebut, dateFin),
    periode: periodeLisible(dateDebut, dateFin),
    statut: statutCampagne(dateDebut, dateFin)
  };
};

export const formatHorodatage = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
