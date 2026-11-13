import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCog,
  Plus,
  Lock,
  Pencil,
  Trash2,
  Users,
  Copy,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Power,
  PowerOff,
  UserPlus,
  UserMinus
} from 'lucide-react';
import axios from 'axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { roleLabel } from '../utils/roles';

const emptyForm = {
  nom: '',
  description: '',
  zone: '',
  responsable: '',
  membres: 0,
  activitesAttribuees: 0,
  statut: 'en_preparation'
};

const STATUS_OPTIONS = [
  { value: 'en_preparation', label: 'En préparation', badge: 'bg-yellow-100 text-yellow-700' },
  { value: 'mobilisee', label: 'Mobilisée', badge: 'bg-green-100 text-green-700' },
  { value: 'terminee', label: 'Terminée', badge: 'bg-gray-100 text-gray-600' }
];

const statusInfo = (value) =>
  STATUS_OPTIONS.find((option) => option.value === value) || STATUS_OPTIONS[0];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const Feedback = ({ status }) => {
  if (!status?.message) return null;
  const success = status.type === 'success';
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg p-3 border ${
        success
          ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-red-600 bg-red-50 border-red-200'
      }`}
    >
      {success ? (
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
      )}
      <span>{status.message}</span>
    </div>
  );
};

const Equipes = () => {
  const { can } = useAuth();
  const { revision, notifyChange } = useDataSync();
  const canManage = can('teams.manage');

  const [equipes, setEquipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  const [formModal, setFormModal] = useState({ open: false, team: null });
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [keyModal, setKeyModal] = useState({
    open: false,
    team: null,
    expireDansJours: 30,
    loading: false,
    error: ''
  });

  const [membersModal, setMembersModal] = useState({
    open: false,
    team: null,
    loading: false,
    members: [],
    error: '',
    message: '',
    email: '',
    adding: false
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await axios.get('/api/teams');
        if (!cancelled) setEquipes(response.data.data || []);
      } catch (error) {
        if (!cancelled) console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setFormModal({ open: true, team: null });
  };

  const openDeleteModal = (team) => {
    setDeleteError('');
    setDeleteTarget(team);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError('');
  };

  const openEdit = (team) => {
    setForm({
      nom: team.nom || '',
      description: team.description || '',
      zone: team.zone || '',
      responsable: team.responsable || '',
      membres: Number(team.membres) || 0,
      activitesAttribuees: Number(team.activitesAttribuees) || 0,
      statut: team.statut || 'en_preparation'
    });
    setFormError('');
    setFormModal({ open: true, team });
  };

  const closeForm = () => {
    if (saving) return;
    setFormModal({ open: false, team: null });
    setFormError('');
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = {
      ...form,
      membres: Number(form.membres) || 0,
      activitesAttribuees: Number(form.activitesAttribuees) || 0
    };

    try {
      if (formModal.team) {
        await axios.put(`/api/teams/${formModal.team.id}`, payload);
        setStatus({ type: 'success', message: 'Équipe mise à jour.' });
      } else {
        const response = await axios.post('/api/teams', payload);
        setStatus({
          type: 'success',
          message: `Équipe créée. Clé d’invitation : ${response.data.data.codeInvitation}`
        });
      }
      setFormModal({ open: false, team: null });
      setForm(emptyForm);
      notifyChange();
    } catch (error) {
      setFormError(error.response?.data?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await axios.delete(`/api/teams/${deleteTarget.id}`);
      setStatus({ type: 'success', message: `L’équipe ${deleteTarget.nom} a été supprimée.` });
      setDeleteTarget(null);
      notifyChange();
    } catch (error) {
      setDeleteError(error.response?.data?.message || 'Suppression impossible.');
    } finally {
      setDeleting(false);
    }
  };

  const copyText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus({ type: 'success', message: successMessage });
    } catch (error) {
      setStatus({ type: 'error', message: `Copie impossible. Valeur : ${value}` });
    }
  };

  const openKeyModal = (team) => {
    setKeyModal({
      open: true,
      team,
      expireDansJours: 30,
      loading: false,
      error: ''
    });
  };

  const closeKeyModal = () => {
    if (keyModal.loading) return;
    setKeyModal((value) => ({ ...value, open: false, team: null, error: '' }));
  };

  const handleRegenerateKey = async () => {
    if (!keyModal.team) return;
    setKeyModal((value) => ({ ...value, loading: true, error: '' }));
    try {
      const response = await axios.post(`/api/teams/${keyModal.team.id}/code`, {
        expireDansJours: Number(keyModal.expireDansJours) || 0
      });
      setKeyModal((value) => ({
        ...value,
        loading: false,
        team: { ...value.team, ...response.data.data }
      }));
      setStatus({ type: 'success', message: response.data.message });
      notifyChange();
    } catch (error) {
      setKeyModal((value) => ({
        ...value,
        loading: false,
        error: error.response?.data?.message || 'Génération de la clé impossible.'
      }));
    }
  };

  const handleToggleKey = async () => {
    if (!keyModal.team) return;
    const nextActif = !keyModal.team.codeInvitationActif;
    setKeyModal((value) => ({ ...value, loading: true, error: '' }));
    try {
      const response = await axios.patch(`/api/teams/${keyModal.team.id}/code`, {
        actif: nextActif
      });
      setKeyModal((value) => ({
        ...value,
        loading: false,
        team: { ...value.team, ...response.data.data }
      }));
      setStatus({ type: 'success', message: response.data.message });
      notifyChange();
    } catch (error) {
      setKeyModal((value) => ({
        ...value,
        loading: false,
        error: error.response?.data?.message || 'Mise à jour de la clé impossible.'
      }));
    }
  };

  const fetchMembers = async (teamId) => {
    const response = await axios.get(`/api/teams/${teamId}/membres`);
    const members = response.data.data || [];
    setMembersModal((value) =>
      value.team?.id === teamId ? { ...value, loading: false, members } : value
    );
    return members;
  };

  const openMembersModal = async (team) => {
    setMembersModal({
      open: true,
      team,
      loading: true,
      members: [],
      error: '',
      message: '',
      email: '',
      adding: false
    });
    try {
      await fetchMembers(team.id);
    } catch (error) {
      setMembersModal((value) => ({
        ...value,
        loading: false,
        error: error.response?.data?.message || 'Chargement des membres impossible.'
      }));
    }
  };

  const closeMembersModal = () => {
    if (membersModal.adding) return;
    setMembersModal((value) => ({ ...value, open: false, team: null }));
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!membersModal.team || !membersModal.email.trim()) return;
    setMembersModal((value) => ({ ...value, adding: true, error: '', message: '' }));
    try {
      const response = await axios.post(`/api/teams/${membersModal.team.id}/membres`, {
        email: membersModal.email.trim()
      });
      await fetchMembers(membersModal.team.id);
      setMembersModal((value) => ({
        ...value,
        adding: false,
        email: '',
        message: response.data.message || 'Membre ajouté.'
      }));
      notifyChange();
    } catch (error) {
      setMembersModal((value) => ({
        ...value,
        adding: false,
        error: error.response?.data?.message || 'Ajout du membre impossible.'
      }));
    }
  };

  const handleRoleChange = async (member, roleMembre) => {
    if (!membersModal.team) return;
    setMembersModal((value) => ({ ...value, error: '', message: '' }));
    try {
      await axios.patch(
        `/api/teams/${membersModal.team.id}/membres/${encodeURIComponent(member.email)}`,
        { roleMembre }
      );
      setMembersModal((value) => ({
        ...value,
        members: value.members.map((item) =>
          item.email === member.email ? { ...item, roleMembre } : item
        ),
        message: 'Rôle du membre mis à jour.'
      }));
    } catch (error) {
      setMembersModal((value) => ({
        ...value,
        error: error.response?.data?.message || 'Modification du rôle impossible.'
      }));
    }
  };

  const handleRemoveMember = async (member) => {
    if (!membersModal.team) return;
    const confirmed = window.confirm(
      `Retirer « ${member.nom} » de l’équipe « ${membersModal.team.nom} » ?`
    );
    if (!confirmed) return;

    setMembersModal((value) => ({ ...value, error: '', message: '' }));
    try {
      const response = await axios.delete(
        `/api/teams/${membersModal.team.id}/membres/${encodeURIComponent(member.email)}`
      );
      await fetchMembers(membersModal.team.id);
      setMembersModal((value) => ({
        ...value,
        message: response.data.message || 'Membre retiré.'
      }));
      notifyChange();
    } catch (error) {
      setMembersModal((value) => ({
        ...value,
        error: error.response?.data?.message || 'Retrait du membre impossible.'
      }));
    }
  };

  if (loading && equipes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Équipes et bénévoles</h1>
          <p className="text-gray-600 mt-1">
            {canManage
              ? 'Créez les équipes, gérez leurs clés d’invitation et leurs membres.'
              : 'Consultez les équipes et rejoignez celles qui vous intéressent.'}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark transition-colors font-medium"
          >
            <Plus size={18} />
            Créer une équipe
          </button>
        ) : (
          <Link
            to="/compte"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-naatal-green text-naatal-green-dark rounded-lg hover:bg-naatal-green-light transition-colors font-medium"
          >
            <UserPlus size={17} />
            Rejoindre une équipe
          </Link>
        )}
      </div>

      <Feedback status={status} />

      {equipes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
          Aucune équipe n’est enregistrée pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {equipes.map((equipe) => {
            const info = statusInfo(equipe.statut);
            const keyUsable = equipe.codeInvitationActif && !equipe.codeInvitationExpire;
            return (
              <div key={equipe.id} className="bg-white rounded-xl p-5 card-shadow border border-gray-100 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserCog className="text-naatal-green shrink-0" size={22} />
                    <h3 className="font-semibold text-gray-900 truncate">{equipe.nom}</h3>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs ${info.badge}`}>
                    {info.label}
                  </span>
                </div>

                {equipe.roleMembre && (
                  <span className="inline-flex self-start mb-2 px-2 py-1 rounded-full text-xs bg-naatal-green-light text-naatal-green-dark">
                    {equipe.roleMembre === 'responsable' ? 'Vous êtes responsable' : 'Vous êtes membre'}
                  </span>
                )}

                {equipe.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">{equipe.description}</p>
                )}

                <div className="space-y-1.5 text-sm flex-1">
                  <p className="text-gray-600"><span className="font-medium text-gray-700">Zone :</span> {equipe.zone || '—'}</p>
                  <p className="text-gray-600"><span className="font-medium text-gray-700">Responsable :</span> {equipe.responsable || '—'}</p>
                  <p className="text-gray-600"><span className="font-medium text-gray-700">Membres :</span> {equipe.membres}</p>
                  <p className="text-gray-600"><span className="font-medium text-gray-700">Activités attribuées :</span> {equipe.activitesAttribuees}</p>
                  <p className="text-xs text-gray-500">Comptes rattachés : {equipe.membresInscrits ?? 0}</p>
                </div>

                {canManage && (
                  <div className="mt-4 rounded-lg border border-naatal-green-light bg-naatal-cream p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-600">Clé d’invitation</span>
                      {equipe.codeInvitation ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            keyUsable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {equipe.codeInvitationExpire
                            ? 'Expirée'
                            : equipe.codeInvitationActif
                              ? 'Active'
                              : 'Désactivée'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500">Aucune</span>
                      )}
                    </div>

                    {equipe.codeInvitation ? (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-white border border-naatal-green-light text-sm font-semibold tracking-wide text-naatal-green-dark">
                            {equipe.codeInvitation}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(equipe.codeInvitation, `Clé de ${equipe.nom} copiée.`)
                            }
                            className="p-2 text-gray-500 hover:text-naatal-green-dark hover:bg-naatal-green-light rounded-lg transition-colors"
                            title="Copier la clé"
                            aria-label={`Copier la clé de ${equipe.nom}`}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-gray-500">
                            {equipe.codeInvitationExpireLe
                              ? `Expire le ${formatDate(equipe.codeInvitationExpireLe)}`
                              : 'Sans expiration'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openKeyModal(equipe)}
                            className="text-xs font-medium text-naatal-green-dark hover:underline"
                          >
                            Gérer la clé
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openKeyModal(equipe)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-naatal-green-dark hover:underline"
                      >
                        <KeyRound size={14} />
                        Générer une clé
                      </button>
                    )}
                  </div>
                )}

                {canManage && (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(equipe)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => openMembersModal(equipe)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Users size={14} />
                      Membres
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(equipe)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!canManage && (
        <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <Lock size={18} className="shrink-0 mt-0.5 text-gray-400" />
          <span>
            La création, la modification et la suppression des équipes ainsi que la gestion
            des clés d’invitation sont réservées aux administrateurs. Utilisez
            « Rejoindre une équipe » dans votre espace personnel pour adhérer avec un code.
          </span>
        </div>
      )}

      <Modal
        open={formModal.open}
        title={formModal.team ? 'Modifier l’équipe' : 'Créer une équipe'}
        subtitle={formModal.team ? formModal.team.nom : 'Renseignez les informations de la nouvelle équipe.'}
        onClose={closeForm}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="team-form"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : formModal.team ? 'Enregistrer' : 'Créer l’équipe'}
            </button>
          </>
        }
      >
        <form id="team-form" onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label htmlFor="team-nom" className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              id="team-nom"
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={form.nom}
              onChange={(event) => setForm({ ...form, nom: event.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
            />
          </div>

          <div>
            <label htmlFor="team-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="team-description"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green resize-y"
              placeholder="Missions et activités de l’équipe…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="team-zone" className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <input
                id="team-zone"
                type="text"
                maxLength={150}
                value={form.zone}
                onChange={(event) => setForm({ ...form, zone: event.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
              />
            </div>
            <div>
              <label htmlFor="team-responsable" className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <input
                id="team-responsable"
                type="text"
                maxLength={150}
                value={form.responsable}
                onChange={(event) => setForm({ ...form, responsable: event.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
              />
            </div>
            <div>
              <label htmlFor="team-statut" className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                id="team-statut"
                value={form.statut}
                onChange={(event) => setForm({ ...form, statut: event.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green bg-white"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="team-membres" className="block text-sm font-medium text-gray-700 mb-1">Nombre de membres</label>
              <input
                id="team-membres"
                type="number"
                min="0"
                max="10000"
                value={form.membres}
                onChange={(event) => setForm({ ...form, membres: event.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="team-activites" className="block text-sm font-medium text-gray-700 mb-1">Activités attribuées</label>
              <input
                id="team-activites"
                type="number"
                min="0"
                max="10000"
                value={form.activitesAttribuees}
                onChange={(event) => setForm({ ...form, activitesAttribuees: event.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
              />
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{formError}</p>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Supprimer l’équipe"
        subtitle={deleteTarget?.nom}
        onClose={closeDeleteModal}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <Trash2 size={16} />
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Confirmez-vous la suppression de l’équipe <strong>{deleteTarget?.nom}</strong> ?
          Toutes les adhésions et la clé d’invitation associées seront supprimées.
          Cette action est irréversible.
        </p>
        {deleteError && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {deleteError}
          </p>
        )}
      </Modal>

      <Modal
        open={keyModal.open}
        title="Clé d’invitation"
        subtitle={keyModal.team?.nom}
        onClose={closeKeyModal}
        size="md"
        footer={
          <button
            type="button"
            onClick={closeKeyModal}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
        }
      >
        {keyModal.error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {keyModal.error}
          </p>
        )}

        {keyModal.team?.codeInvitation ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">Clé actuelle</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    keyModal.team.codeInvitationActif && !keyModal.team.codeInvitationExpire
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {keyModal.team.codeInvitationExpire
                    ? 'Expirée'
                    : keyModal.team.codeInvitationActif
                      ? 'Active'
                      : 'Désactivée'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate px-3 py-2.5 rounded-lg bg-naatal-cream border border-naatal-green-light text-sm font-semibold tracking-wide text-naatal-green-dark">
                  {keyModal.team.codeInvitation}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copyText(keyModal.team.codeInvitation, 'Clé d’invitation copiée.')
                  }
                  className="p-2.5 text-gray-500 hover:text-naatal-green-dark hover:bg-naatal-green-light rounded-lg transition-colors"
                  title="Copier la clé"
                  aria-label="Copier la clé"
                >
                  <Copy size={17} />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {keyModal.team.codeInvitationExpireLe
                  ? `Expire le ${formatDate(keyModal.team.codeInvitationExpireLe)}`
                  : 'Sans date d’expiration'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleKey}
              disabled={keyModal.loading}
              className={`inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60 ${
                keyModal.team.codeInvitationActif
                  ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  : 'border-naatal-green text-naatal-green-dark hover:bg-naatal-green-light'
              }`}
            >
              {keyModal.team.codeInvitationActif ? <PowerOff size={16} /> : <Power size={16} />}
              {keyModal.team.codeInvitationActif ? 'Désactiver cette clé' : 'Réactiver cette clé'}
            </button>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label htmlFor="key-expiration" className="block text-sm font-medium text-gray-700 mb-1">
                  Durée de validité de la nouvelle clé
                </label>
                <select
                  id="key-expiration"
                  value={keyModal.expireDansJours}
                  onChange={(event) =>
                    setKeyModal((value) => ({
                      ...value,
                      expireDansJours: Number(event.target.value)
                    }))
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green bg-white"
                >
                  <option value={7}>7 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={90}>90 jours</option>
                  <option value={365}>1 an</option>
                  <option value={0}>Sans expiration</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleRegenerateKey}
                disabled={keyModal.loading}
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
              >
                <RefreshCw size={16} className={keyModal.loading ? 'animate-spin' : ''} />
                {keyModal.loading ? 'Génération…' : 'Régénérer la clé'}
              </button>
              <p className="text-xs text-gray-500">
                L’ancienne clé sera immédiatement invalidée. Les personnes déjà membres
                restent dans l’équipe.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Cette équipe ne possède pas encore de clé d’invitation active.
            </p>
            <div>
              <label htmlFor="key-expiration-empty" className="block text-sm font-medium text-gray-700 mb-1">
                Durée de validité
              </label>
              <select
                id="key-expiration-empty"
                value={keyModal.expireDansJours}
                onChange={(event) =>
                  setKeyModal((value) => ({
                    ...value,
                    expireDansJours: Number(event.target.value)
                  }))
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green bg-white"
              >
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
                <option value={90}>90 jours</option>
                <option value={365}>1 an</option>
                <option value={0}>Sans expiration</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleRegenerateKey}
              disabled={keyModal.loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
            >
              <KeyRound size={16} />
              {keyModal.loading ? 'Génération…' : 'Générer la clé'}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={membersModal.open}
        title="Membres de l’équipe"
        subtitle={membersModal.team?.nom}
        onClose={closeMembersModal}
        size="lg"
        footer={
          <button
            type="button"
            onClick={closeMembersModal}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
        }
      >
        <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={membersModal.email}
            onChange={(event) =>
              setMembersModal((value) => ({ ...value, email: event.target.value }))
            }
            placeholder="email@exemple.com"
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
          />
          <button
            type="submit"
            disabled={membersModal.adding}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
          >
            <UserPlus size={16} />
            {membersModal.adding ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>

        {membersModal.error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {membersModal.error}
          </p>
        )}
        {membersModal.message && (
          <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            {membersModal.message}
          </p>
        )}

        <div className="mt-4">
          {membersModal.loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-naatal-green"></div>
            </div>
          ) : membersModal.members.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
              Aucun membre n’est encore rattaché à cette équipe.
            </p>
          ) : (
            <div className="space-y-2">
              {membersModal.members.map((member) => (
                <div
                  key={member.email || member.nom}
                  className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{member.nom}</p>
                    <p className="text-xs text-gray-500 truncate">{member.email || 'Email masqué'}</p>
                    <p className="text-xs text-gray-500">
                      Rôle plateforme : {roleLabel(member.role)}
                      {member.joinedAt ? ` • Adhésion : ${formatDate(member.joinedAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.roleMembre}
                      onChange={(event) => handleRoleChange(member, event.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-naatal-green"
                      aria-label={`Rôle de ${member.nom}`}
                    >
                      <option value="membre">Membre</option>
                      <option value="responsable">Responsable</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <UserMinus size={14} />
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Equipes;
