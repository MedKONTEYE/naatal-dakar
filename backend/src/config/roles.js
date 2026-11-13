// Référentiel central des rôles et permissions de la plateforme.
// Toute décision d'autorisation côté serveur s'appuie sur ce fichier.

const ROLES = ['super_admin', 'administrateur', 'gestionnaire', 'agent', 'utilisateur'];

const ROLE_LABELS = {
  super_admin: 'Super Administrateur',
  administrateur: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  agent: 'Agent',
  utilisateur: 'Utilisateur'
};

const ROLE_DESCRIPTIONS = {
  super_admin: 'Accès complet à toutes les fonctionnalités et à tous les paramètres.',
  administrateur: 'Accès complet aux paramètres, aux objectifs et aux données, avec gestion des utilisateurs de rang inférieur.',
  gestionnaire: 'Gestion des opérations et des activités de la mairie.',
  agent: 'Saisie et mise à jour des données de terrain.',
  utilisateur: 'Consultation des données de la plateforme.'
};

const PERMISSIONS = {
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

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

const ROLE_PERMISSIONS = {
  super_admin: [...ALL_PERMISSIONS],
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

// Hiérarchie : un acteur ne peut agir que sur un compte de rang strictement inférieur.
const ROLE_RANK = {
  super_admin: 5,
  administrateur: 4,
  gestionnaire: 3,
  agent: 2,
  utilisateur: 1
};

const isValidRole = (role) => ROLES.includes(role);

const normalizeOverrides = (value) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set(value.filter((item) => ALL_PERMISSIONS.includes(item)));
  return [...unique];
};

const effectivePermissions = (role, overrides = []) => {
  const base = ROLE_PERMISSIONS[role] || [];
  const extra = normalizeOverrides(overrides);
  return [...new Set([...base, ...extra])];
};

const hasPermission = (permissions, permission) => Array.isArray(permissions) && permissions.includes(permission);

const canManageTarget = (actor, target) => {
  if (!actor || !target) return false;
  if (actor.role === 'super_admin') return true;
  return (ROLE_RANK[actor.role] || 0) > (ROLE_RANK[target.role] || 0);
};

const canAssignRole = (actor, role) => {
  if (!actor || !isValidRole(role)) return false;
  if (actor.role === 'super_admin') return true;
  return (ROLE_RANK[role] || 0) < (ROLE_RANK[actor.role] || 0);
};

module.exports = {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  isValidRole,
  normalizeOverrides,
  effectivePermissions,
  hasPermission,
  canManageTarget,
  canAssignRole
};
