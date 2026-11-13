// Référentiel des rôles et permissions, aligné sur backend/src/config/roles.js.
// Il sert uniquement à l'affichage : l'autorisation réelle est toujours
// recalculée et vérifiée côté serveur.

export const ROLE_LABELS = {
  super_admin: 'Super Administrateur',
  administrateur: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  agent: 'Agent',
  utilisateur: 'Utilisateur'
};

export const ROLE_DESCRIPTIONS = {
  super_admin: 'Accès complet à toutes les fonctionnalités et à tous les paramètres.',
  administrateur: 'Accès complet aux paramètres, aux objectifs et aux données, avec gestion des utilisateurs de rang inférieur.',
  gestionnaire: 'Gestion des opérations et des activités de la mairie.',
  agent: 'Saisie et mise à jour des données de terrain.',
  utilisateur: 'Consultation des données de la plateforme.'
};

export const ROLE_OPTIONS = [
  { value: 'super_admin', label: ROLE_LABELS.super_admin },
  { value: 'administrateur', label: ROLE_LABELS.administrateur },
  { value: 'gestionnaire', label: ROLE_LABELS.gestionnaire },
  { value: 'agent', label: ROLE_LABELS.agent },
  { value: 'utilisateur', label: ROLE_LABELS.utilisateur }
];

export const PERMISSION_LABELS = {
  'users.read': 'Consulter les utilisateurs',
  'users.manage': 'Créer et modifier les utilisateurs',
  'users.delete': 'Supprimer les utilisateurs',
  'users.roles': 'Attribuer tous les rôles',
  'settings.manage': 'Gérer les paramètres',
  'teams.manage': 'Gérer les équipes et leurs clés d’invitation',
  'operations.read': 'Consulter les données',
  'operations.write': 'Créer et modifier les données',
  'operations.delete': 'Supprimer les données'
};

export const ROLE_PERMISSIONS = {
  super_admin: Object.keys(PERMISSION_LABELS),
  administrateur: [
    'users.read',
    'users.manage',
    'users.delete',
    'settings.manage',
    'teams.manage',
    'operations.read',
    'operations.write',
    'operations.delete'
  ],
  gestionnaire: ['operations.read', 'operations.write', 'operations.delete'],
  agent: ['operations.read', 'operations.write'],
  utilisateur: ['operations.read']
};

export const ROLE_RANK = {
  super_admin: 5,
  administrateur: 4,
  gestionnaire: 3,
  agent: 2,
  utilisateur: 1
};

export const ROLE_BADGES = {
  super_admin: 'bg-naatal-green-dark text-white border-naatal-green-dark',
  administrateur: 'bg-naatal-green-light text-naatal-green-dark border-green-200',
  gestionnaire: 'bg-blue-50 text-blue-700 border-blue-200',
  agent: 'bg-amber-50 text-amber-800 border-amber-200',
  utilisateur: 'bg-gray-100 text-gray-700 border-gray-200'
};

export const roleLabel = (role) => ROLE_LABELS[role] || role;

export const rolePermissions = (role) => ROLE_PERMISSIONS[role] || [];

export const canManageUser = (actor, target) => {
  if (!actor || !target) return false;
  if (actor.role === 'super_admin') return true;
  return (ROLE_RANK[actor.role] || 0) > (ROLE_RANK[target.role] || 0);
};

export const assignableRoles = (actor) => {
  if (!actor) return [];
  if (actor.role === 'super_admin') return ROLE_OPTIONS;
  return ROLE_OPTIONS.filter((option) => (ROLE_RANK[option.value] || 0) < (ROLE_RANK[actor.role] || 0));
};
