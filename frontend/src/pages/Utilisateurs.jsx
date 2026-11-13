import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Users,
  ShieldCheck,
  UserCog,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  Eye,
  Pencil,
  Trash2,
  KeyRound,
  Power,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import Modal from '../components/Modal';
import {
  ROLE_OPTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_BADGES,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  assignableRoles,
  canManageUser,
  roleLabel
} from '../utils/roles';

const LIMIT = 20;

const emptyForm = {
  nom: '',
  email: '',
  telephone: '',
  role: 'utilisateur',
  actif: true,
  password: '',
  permissionsSupplementaires: []
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return 'Jamais';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const initials = (name) => String(name || '?')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_BADGES[role] || ROLE_BADGES.utilisateur}`}>
    {roleLabel(role)}
  </span>
);

const StatusBadge = ({ actif }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
    actif
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-red-50 text-red-700 border-red-200'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${actif ? 'bg-green-500' : 'bg-red-500'}`} />
    {actif ? 'Actif' : 'Désactivé'}
  </span>
);

const StatCard = ({ label, value, icon: Icon, tone }) => {
  const tones = {
    green: 'bg-naatal-green-light text-naatal-green-dark',
    dark: 'bg-naatal-green-dark text-white',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700'
  };

  return (
    <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${tones[tone] || tones.green}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
      </div>
    </div>
  );
};

const Field = ({ label, hint, children, className = '' }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green focus:border-transparent';

const IconAction = ({ icon: Icon, label, onClick, tone = 'gray', disabled, spin }) => {
  const tones = {
    gray: 'text-gray-600 hover:bg-gray-100',
    green: 'text-naatal-green hover:bg-naatal-green-light',
    blue: 'text-blue-600 hover:bg-blue-50',
    amber: 'text-amber-600 hover:bg-amber-50',
    red: 'text-red-600 hover:bg-red-50'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${tones[tone] || tones.gray}`}
    >
      <Icon size={17} className={spin ? 'animate-spin' : ''} />
    </button>
  );
};

const Utilisateurs = () => {
  const { user: currentUser, can, isSuperAdmin, applySession } = useAuth();
  const { revision, notifyChange } = useDataSync();
  const canRead = can('users.read');
  const canManage = can('users.manage');
  const canDelete = can('users.delete');

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [filters, setFilters] = useState({ q: '', role: '', statut: 'tous' });
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [roleForm, setRoleForm] = useState({ role: 'utilisateur' });
  const [submitting, setSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const requestRef = useRef(0);

  const notify = (type, text) => setFeedback({ type, text });

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const fetchUsers = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/users', {
        params: {
          q: filters.q || undefined,
          role: filters.role || undefined,
          statut: filters.statut,
          page,
          limit: LIMIT
        }
      });
      if (requestId !== requestRef.current) return;
      setUsers(response.data.data || []);
      setStats(response.data.stats || null);
      setTotal(response.data.total || 0);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.response?.data?.message || 'Impossible de charger les utilisateurs.');
      setUsers([]);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [filters.q, filters.role, filters.statut, page]);

  useEffect(() => {
    if (!canRead) return undefined;
    const timer = setTimeout(fetchUsers, filters.q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchUsers, canRead, filters.q, revision]);

  const availableRoles = useMemo(() => assignableRoles(currentUser), [currentUser]);

  const canManageThis = useCallback(
    (target) => canManage && canManageUser(currentUser, target),
    [canManage, currentUser]
  );

  const isSelf = (target) => currentUser?.email === target?.email;

  const openModal = (type, target = null, initialRole = null) => {
    setModal(type);
    setSelected(target);
    setGeneratedPassword('');
    setCopied(false);

    if (type === 'create') {
      const preferred = availableRoles.find((option) => option.value === 'agent')
        || availableRoles.find((option) => option.value === 'utilisateur')
        || availableRoles[availableRoles.length - 1];
      setForm({ ...emptyForm, role: preferred?.value || 'utilisateur' });
    }
    if (type === 'edit' && target) {
      setForm({
        nom: target.nom || '',
        email: target.email || '',
        telephone: target.telephone || '',
        role: target.role,
        actif: Boolean(target.actif),
        password: '',
        permissionsSupplementaires: target.permissionsSupplementaires || []
      });
    }
    if (type === 'role' && target) {
      setRoleForm({ role: initialRole || target.role });
    }
  };

  const closeModal = () => {
    setModal(null);
    setSelected(null);
    setSubmitting(false);
  };

  const errorMessage = (err, fallback) => err.response?.data?.message || fallback;

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        nom: form.nom,
        email: form.email,
        telephone: form.telephone,
        role: form.role,
        actif: form.actif
      };
      if (form.password) payload.password = form.password;
      if (isSuperAdmin && form.role !== 'super_admin') {
        payload.permissionsSupplementaires = form.permissionsSupplementaires;
      }

      const response = await axios.post('/api/users', payload);
      closeModal();
      notify('success', `Utilisateur « ${response.data.user.nom} » créé.`);
      if (response.data.temporaryPassword) {
        setGeneratedPassword(response.data.temporaryPassword);
        setModal('password');
      }
      notifyChange();
    } catch (err) {
      notify('error', errorMessage(err, 'Création impossible.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      const payload = {
        nom: form.nom,
        email: form.email,
        telephone: form.telephone,
        role: form.role,
        actif: form.actif
      };
      if (isSuperAdmin && form.role !== 'super_admin') {
        payload.permissionsSupplementaires = form.permissionsSupplementaires;
      }

      const response = await axios.put(`/api/users/${encodeURIComponent(selected.email)}`, payload);
      if (response.data.token) {
        applySession(response.data.token, response.data.user);
      }
      closeModal();
      notify('success', response.data.message || 'Utilisateur mis à jour.');
      notifyChange();
    } catch (err) {
      notify('error', errorMessage(err, 'Mise à jour impossible.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRole = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      await axios.patch(`/api/users/${encodeURIComponent(selected.email)}/role`, { role: roleForm.role });
      closeModal();
      notify('success', `Rôle de ${selected.nom} modifié en ${roleLabel(roleForm.role)}.`);
      notifyChange();
    } catch (err) {
      notify('error', errorMessage(err, 'Changement de rôle impossible.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const next = !selected.actif;
      await axios.patch(`/api/users/${encodeURIComponent(selected.email)}/status`, { actif: next });
      closeModal();
      notify('success', next ? `Compte de ${selected.nom} activé.` : `Compte de ${selected.nom} désactivé.`);
      notifyChange();
    } catch (err) {
      notify('error', errorMessage(err, 'Changement de statut impossible.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const response = await axios.post(`/api/users/${encodeURIComponent(selected.email)}/reset-password`, {});
      closeModal();
      notify('success', `Mot de passe de ${selected.nom} réinitialisé.`);
      if (response.data.temporaryPassword) {
        setGeneratedPassword(response.data.temporaryPassword);
        setModal('password');
      }
      notifyChange();
    } catch (err) {
      notify('error', errorMessage(err, 'Réinitialisation impossible.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await axios.delete(`/api/users/${encodeURIComponent(selected.email)}`);
      closeModal();
      notify('success', 'Utilisateur supprimé.');
      notifyChange();
    } catch (err) {
      notify('error', errorMessage(err, 'Suppression impossible.'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setCopied(false);
    }
  };

  const toggleOverride = (permission) => {
    setForm((previous) => {
      const current = previous.permissionsSupplementaires || [];
      const next = current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission];
      return { ...previous, permissionsSupplementaires: next };
    });
  };

  const baseRolePermissions = ROLE_PERMISSIONS[form.role] || [];
  const overridablePermissions = Object.keys(PERMISSION_LABELS).filter(
    (permission) => !baseRolePermissions.includes(permission)
  );

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (!canRead) {
    return (
      <div className="bg-white rounded-xl p-8 card-shadow border border-gray-100 text-center max-w-lg mx-auto mt-10">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Lock size={26} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Accès refusé</h1>
        <p className="text-sm text-gray-600 mt-2">
          Vous n'avez pas la permission de consulter la gestion des utilisateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-gray-600 mt-1">
            Comptes, rôles, permissions et accès à la plateforme.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => openModal('create')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark transition-colors font-medium"
          >
            <UserPlus size={18} />
            Ajouter un utilisateur
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? <Check size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
          <p className="flex-1">{feedback.text}</p>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Fermer le message">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={fetchUsers} className="inline-flex items-center gap-1 font-medium">
            <RefreshCw size={15} /> Réessayer
          </button>
        </div>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Utilisateurs" value={stats?.total} icon={Users} tone="green" />
        <StatCard label="Administrateurs" value={stats?.administrateurs} icon={ShieldCheck} tone="dark" />
        <StatCard label="Agents" value={stats?.agents} icon={UserCog} tone="blue" />
        <StatCard label="Comptes actifs" value={stats?.actifs} icon={UserCheck} tone="emerald" />
        <StatCard label="Comptes désactivés" value={stats?.inactifs} icon={UserX} tone="red" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Rechercher par nom, email ou téléphone..."
              value={filters.q}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, q: event.target.value });
              }}
              className={`${inputClass} pl-10`}
            />
          </div>
          <select
            value={filters.role}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, role: event.target.value });
            }}
            className={inputClass}
            aria-label="Filtrer par rôle"
          >
            <option value="">Tous les rôles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.statut}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, statut: event.target.value });
            }}
            className={inputClass}
            aria-label="Filtrer par statut"
          >
            <option value="tous">Tous les statuts</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Désactivés</option>
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nom complet</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Téléphone</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium hidden xl:table-cell">Créé le</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <span className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-naatal-green align-middle mr-2" />
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Aucun utilisateur ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                users.map((item) => {
                  const manageable = canManageThis(item);
                  const self = isSelf(item);
                  return (
                    <tr key={item.email} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-naatal-green-light text-naatal-green-dark flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(item.nom)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {item.nom} {self && <span className="text-xs font-normal text-gray-500">(vous)</span>}
                            </p>
                            <p className="text-xs text-gray-500 truncate sm:hidden">{item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.email}</td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{item.telephone || '—'}</td>
                      <td className="px-4 py-3">
                        {manageable && !self ? (
                          <select
                            value={item.role}
                            onChange={(event) => openModal('role', item, event.target.value)}
                            className="text-xs border border-gray-200 rounded-full px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-naatal-green max-w-[170px]"
                            aria-label={`Rôle de ${item.nom}`}
                          >
                            {availableRoles.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge role={item.role} />
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge actif={item.actif} /></td>
                      <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconAction icon={Eye} label="Voir" tone="gray" onClick={() => openModal('view', item)} />
                          <IconAction
                            icon={Pencil}
                            label="Modifier"
                            tone="green"
                            disabled={!manageable}
                            onClick={() => openModal('edit', item)}
                          />
                          <IconAction
                            icon={ShieldCheck}
                            label="Changer le rôle"
                            tone="blue"
                            disabled={!manageable || self}
                            onClick={() => openModal('role', item)}
                          />
                          <IconAction
                            icon={KeyRound}
                            label="Réinitialiser le mot de passe"
                            tone="amber"
                            disabled={!manageable || self}
                            onClick={() => openModal('reset', item)}
                          />
                          <IconAction
                            icon={Power}
                            label={item.actif ? 'Désactiver le compte' : 'Activer le compte'}
                            tone={item.actif ? 'red' : 'green'}
                            disabled={!manageable || self}
                            onClick={() => openModal('status', item)}
                          />
                          <IconAction
                            icon={Trash2}
                            label="Supprimer"
                            tone="red"
                            disabled={!canDelete || !manageable || self}
                            onClick={() => openModal('delete', item)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
          <p>
            {total === 0 ? 'Aucun résultat' : `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} sur ${total}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3">Page {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Création / modification */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        title={modal === 'create' ? 'Ajouter un utilisateur' : "Modifier l'utilisateur"}
        subtitle={modal === 'create' ? 'Le compte pourra se connecter dès sa création.' : selected?.email}
        onClose={closeModal}
        size="lg"
        footer={
          <>
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              form="user-form"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-naatal-green text-white font-medium hover:bg-naatal-green-dark disabled:opacity-60"
            >
              {submitting ? 'Enregistrement...' : (modal === 'create' ? 'Créer le compte' : 'Mettre à jour')}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={modal === 'create' ? handleCreate : handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom complet" className="sm:col-span-2">
              <input
                type="text"
                required
                minLength={2}
                maxLength={150}
                value={form.nom}
                onChange={(event) => setForm({ ...form, nom: event.target.value })}
                className={inputClass}
                placeholder="Ex. Amina Diallo"
              />
            </Field>
            <Field label="Adresse email">
              <input
                type="email"
                required
                maxLength={190}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClass}
                placeholder="prenom.nom@naatal.dakar"
              />
            </Field>
            <Field label="Téléphone">
              <input
                type="tel"
                maxLength={30}
                value={form.telephone}
                onChange={(event) => setForm({ ...form, telephone: event.target.value })}
                className={inputClass}
                placeholder="+221 77 000 00 00"
              />
            </Field>
            <Field label="Rôle" hint={ROLE_DESCRIPTIONS[form.role]}>
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value, permissionsSupplementaires: [] })}
                className={inputClass}
                disabled={modal === 'edit' && isSelf(selected)}
              >
                {availableRoles.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Statut du compte">
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.actif}
                  disabled={modal === 'edit' && isSelf(selected)}
                  onChange={(event) => setForm({ ...form, actif: event.target.checked })}
                  className="rounded border-gray-300 text-naatal-green focus:ring-naatal-green"
                />
                <span className="text-sm text-gray-700">{form.actif ? 'Compte actif' : 'Compte désactivé'}</span>
              </label>
            </Field>
          </div>

          {modal === 'create' && (
            <Field
              label="Mot de passe initial"
              hint="Laisser vide pour générer automatiquement un mot de passe temporaire sécurisé."
            >
              <input
                type="password"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className={inputClass}
                placeholder="Optionnel — généré si vide"
              />
            </Field>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Permissions du rôle {roleLabel(form.role)}</p>
            <div className="flex flex-wrap gap-1.5">
              {(ROLE_PERMISSIONS[form.role] || []).map((permission) => (
                <span key={permission} className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-600">
                  {PERMISSION_LABELS[permission]}
                </span>
              ))}
            </div>
          </div>

          {isSuperAdmin && form.role !== 'super_admin' && overridablePermissions.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800 mb-2">
                Permissions supplémentaires (réservées au super administrateur)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {overridablePermissions.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={(form.permissionsSupplementaires || []).includes(permission)}
                      onChange={() => toggleOverride(permission)}
                      className="rounded border-gray-300 text-naatal-green focus:ring-naatal-green"
                    />
                    {PERMISSION_LABELS[permission]}
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Détails */}
      <Modal
        open={modal === 'view'}
        title="Détails de l'utilisateur"
        onClose={closeModal}
        size="md"
        footer={
          <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Fermer
          </button>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-naatal-green-light text-naatal-green-dark flex items-center justify-center text-lg font-bold">
                {initials(selected.nom)}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{selected.nom}</p>
                <p className="text-sm text-gray-600">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Rôle</p>
                <div className="mt-1"><RoleBadge role={selected.role} /></div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Statut</p>
                <div className="mt-1"><StatusBadge actif={selected.actif} /></div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Téléphone</p>
                <p className="text-sm text-gray-900 mt-1">{selected.telephone || '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Créé le</p>
                <p className="text-sm text-gray-900 mt-1">{formatDate(selected.createdAt)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Dernière connexion</p>
                <p className="text-sm text-gray-900 mt-1">{formatDateTime(selected.derniereConnexion)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Permissions effectives</p>
              <div className="flex flex-wrap gap-1.5">
                {(selected.permissions || []).map((permission) => (
                  <span key={permission} className="px-2.5 py-1 rounded-full bg-naatal-green-light text-naatal-green-dark text-xs">
                    {PERMISSION_LABELS[permission] || permission}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Changement de rôle */}
      <Modal
        open={modal === 'role'}
        title="Changer le rôle"
        subtitle={selected?.nom}
        onClose={closeModal}
        footer={
          <>
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              form="role-form"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-naatal-green text-white font-medium hover:bg-naatal-green-dark disabled:opacity-60"
            >
              {submitting ? 'Enregistrement...' : 'Confirmer le rôle'}
            </button>
          </>
        }
      >
        <form id="role-form" onSubmit={handleRole} className="space-y-4">
          <Field label="Nouveau rôle">
            <select
              value={roleForm.role}
              onChange={(event) => setRoleForm({ role: event.target.value })}
              className={inputClass}
            >
              {availableRoles.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">{ROLE_DESCRIPTIONS[roleForm.role]}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(ROLE_PERMISSIONS[roleForm.role] || []).map((permission) => (
                <span key={permission} className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-600">
                  {PERMISSION_LABELS[permission]}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Le changement de rôle révoque immédiatement la session en cours de cet utilisateur.
          </p>
        </form>
      </Modal>

      {/* Activation / désactivation */}
      <Modal
        open={modal === 'status'}
        title={selected?.actif ? 'Désactiver le compte' : 'Activer le compte'}
        subtitle={selected?.nom}
        onClose={closeModal}
        size="sm"
        footer={
          <>
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleStatus}
              disabled={submitting}
              className={`px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60 ${
                selected?.actif ? 'bg-red-600 hover:bg-red-700' : 'bg-naatal-green hover:bg-naatal-green-dark'
              }`}
            >
              {submitting ? 'Traitement...' : (selected?.actif ? 'Désactiver' : 'Activer')}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          {selected?.actif
            ? `${selected?.nom} ne pourra plus se connecter et ses sessions actives seront révoquées immédiatement.`
            : `${selected?.nom} pourra de nouveau se connecter à la plateforme.`}
        </p>
      </Modal>

      {/* Réinitialisation */}
      <Modal
        open={modal === 'reset'}
        title="Réinitialiser le mot de passe"
        subtitle={selected?.nom}
        onClose={closeModal}
        size="sm"
        footer={
          <>
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-60"
            >
              {submitting ? 'Réinitialisation...' : 'Réinitialiser'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Un mot de passe temporaire fort sera généré et affiché une seule fois. Toutes les sessions
          de cet utilisateur seront révoquées. Communiquez-lui le mot de passe par un canal sûr.
        </p>
      </Modal>

      {/* Mot de passe temporaire */}
      <Modal
        open={modal === 'password'}
        title="Mot de passe temporaire"
        subtitle="Affiché une seule fois"
        onClose={closeModal}
        size="sm"
        footer={
          <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg bg-naatal-green text-white font-medium hover:bg-naatal-green-dark">
            J'ai noté le mot de passe
          </button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
            <code className="flex-1 text-sm font-mono break-all text-gray-900">{generatedPassword}</code>
            <button
              type="button"
              onClick={copyPassword}
              className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-naatal-green"
              title="Copier"
              aria-label="Copier le mot de passe"
            >
              {copied ? <Check size={17} className="text-green-600" /> : <Copy size={17} />}
            </button>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Ce mot de passe ne sera plus affiché. Demandez à l'utilisateur de le changer après sa
            première connexion.
          </p>
        </div>
      </Modal>

      {/* Suppression */}
      <Modal
        open={modal === 'delete'}
        title="Supprimer l'utilisateur"
        subtitle={selected?.nom}
        onClose={closeModal}
        size="sm"
        footer={
          <>
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm text-gray-700">
            Cette action est irréversible. Le compte de <strong>{selected?.nom}</strong> et son accès
            à la plateforme seront définitivement supprimés.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Utilisateurs;
