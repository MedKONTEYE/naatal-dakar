import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, LogIn, Mail, User, Calendar, Clock, Save, History, AlertCircle, Building2, Target } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';
import { useProgramme } from '../context/ProgrammeContext';
import { roleLabel, ROLE_OPTIONS, ROLE_DESCRIPTIONS } from '../utils/roles';
import {
  computeCampagnePreview,
  formatDateFr,
  formatHorodatage,
  STATUT_LABELS,
  STATUT_STYLES
} from '../utils/campagne';

const Parametres = () => {
  const { user, isAuthenticated, can, isAdmin } = useAuth();
  const { campagne, loading: campagneLoading, error: campagneError, updateCampagne } = useCampaign();
  const {
    programme,
    objectifs,
    loading: programmeLoading,
    error: programmeError,
    updateProgramme,
    updateObjectifs
  } = useProgramme();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ dateDebut: '', dateFin: '' });
  const [campaignMessage, setCampaignMessage] = useState(null);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [programmeForm, setProgrammeForm] = useState({
    nom: '',
    sigle: '',
    coordination: '',
    initiative: '',
    description: ''
  });
  const [programmeMessage, setProgrammeMessage] = useState(null);
  const [savingProgramme, setSavingProgramme] = useState(false);
  const [objectifsForm, setObjectifsForm] = useState({
    arbres: '',
    survieCible: '',
    dechets: '',
    citoyensSensibilises: '',
    participantsActifs: ''
  });
  const [objectifsMessage, setObjectifsMessage] = useState(null);
  const [savingObjectifs, setSavingObjectifs] = useState(false);

  const canManageSettings = can('settings.manage');
  const formatNombre = (value) => Number(value ?? 0).toLocaleString('fr-FR');

  useEffect(() => {
    if (campagne) {
      setCampaignForm({ dateDebut: campagne.dateDebut, dateFin: campagne.dateFin });
    }
  }, [campagne]);

  useEffect(() => {
    if (programme) {
      setProgrammeForm({
        nom: programme.nom || '',
        sigle: programme.sigle || '',
        coordination: programme.coordination || '',
        initiative: programme.initiative || '',
        description: programme.description || ''
      });
    }
  }, [programme]);

  useEffect(() => {
    if (objectifs) {
      setObjectifsForm({
        arbres: String(objectifs.arbres ?? ''),
        survieCible: String(objectifs.survieCible ?? ''),
        dechets: String(objectifs.dechets ?? ''),
        citoyensSensibilises: String(objectifs.citoyensSensibilises ?? ''),
        participantsActifs: String(objectifs.participantsActifs ?? '')
      });
    }
  }, [objectifs]);

  const campaignPreview = computeCampagnePreview(campaignForm.dateDebut, campaignForm.dateFin);

  const handleProgrammeSubmit = async (event) => {
    event.preventDefault();
    setProgrammeMessage(null);

    if (!programmeForm.nom.trim()) {
      setProgrammeMessage({ type: 'error', text: 'Le nom du programme est obligatoire.' });
      return;
    }

    setSavingProgramme(true);
    try {
      const result = await updateProgramme(programmeForm);
      setProgrammeMessage({
        type: 'success',
        text: result.message || 'Informations du programme mises à jour.'
      });
    } catch (error) {
      setProgrammeMessage({
        type: 'error',
        text: error.response?.data?.message || 'Impossible de mettre à jour les informations du programme.'
      });
    } finally {
      setSavingProgramme(false);
    }
  };

  const handleObjectifsSubmit = async (event) => {
    event.preventDefault();
    setObjectifsMessage(null);

    const valeurs = {
      arbres: Number(objectifsForm.arbres),
      survieCible: Number(objectifsForm.survieCible),
      dechets: Number(objectifsForm.dechets),
      citoyensSensibilises: Number(objectifsForm.citoyensSensibilises),
      participantsActifs: Number(objectifsForm.participantsActifs)
    };

    const incomplet = Object.values(objectifsForm).some((value) => String(value).trim() === '');
    const invalide = Object.values(valeurs).some((value) => !Number.isFinite(value) || value < 0);

    if (incomplet || invalide) {
      setObjectifsMessage({ type: 'error', text: 'Tous les objectifs doivent être des nombres positifs.' });
      return;
    }
    if (valeurs.survieCible > 100) {
      setObjectifsMessage({ type: 'error', text: 'Le taux de survie cible ne peut pas dépasser 100 %.' });
      return;
    }

    setSavingObjectifs(true);
    try {
      const result = await updateObjectifs(valeurs);
      setObjectifsMessage({
        type: 'success',
        text: result.message || 'Objectifs prévisionnels mis à jour.'
      });
    } catch (error) {
      setObjectifsMessage({
        type: 'error',
        text: error.response?.data?.message || 'Impossible de mettre à jour les objectifs.'
      });
    } finally {
      setSavingObjectifs(false);
    }
  };

  const handleCampaignSubmit = async (event) => {
    event.preventDefault();
    setCampaignMessage(null);

    if (!campaignForm.dateDebut || !campaignForm.dateFin) {
      setCampaignMessage({ type: 'error', text: 'La date de début et la date de fin sont obligatoires.' });
      return;
    }
    if (campaignForm.dateFin < campaignForm.dateDebut) {
      setCampaignMessage({ type: 'error', text: 'La date de fin doit être égale ou postérieure à la date de début.' });
      return;
    }

    setSavingCampaign(true);
    try {
      const result = await updateCampagne(campaignForm);
      setCampaignMessage({
        type: 'success',
        text: result.message || 'La période de campagne a été mise à jour.'
      });
    } catch (error) {
      setCampaignMessage({
        type: 'error',
        text: error.response?.data?.message || 'Impossible de mettre à jour la période de campagne.'
      });
    } finally {
      setSavingCampaign(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    setSavingPassword(true);
    try {
      const response = await axios.put('/api/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage({ type: 'success', text: response.data.message || 'Mot de passe mis à jour.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.message || 'Impossible de modifier le mot de passe.'
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres et administration</h1>
        <p className="text-gray-600 mt-1">Configuration du programme {programme?.nom || 'NAATAL DAKAR'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheck size={20} className="text-naatal-green" />
            Compte administrateur
          </h2>

          {isAuthenticated ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-naatal-green-light rounded-lg">
                  <User size={20} className="text-naatal-green-dark" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Nom</p>
                    <p className="text-sm font-medium text-gray-900">{user.nom}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail size={20} className="text-gray-500" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <ShieldCheck size={20} className="text-gray-500" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Rôle</p>
                    <p className="text-sm font-medium text-gray-900">{roleLabel(user.role)}</p>
                  </div>
                </div>
                {isAdmin && (
                  <p className="text-xs text-gray-500">
                    Droits : consultation, ajout, modification et suppression sur toutes les données.
                  </p>
                )}
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Lock size={18} className="text-naatal-green" />
                  Changer le mot de passe
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    8 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green"
                  />
                </div>

                {passwordMessage && (
                  <p className={`text-sm rounded-lg p-3 border ${
                    passwordMessage.type === 'success'
                      ? 'text-green-700 bg-green-50 border-green-200'
                      : 'text-red-700 bg-red-50 border-red-200'
                  }`}>
                    {passwordMessage.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark disabled:opacity-60"
                >
                  {savingPassword ? 'Enregistrement...' : 'Mettre à jour'}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-gray-600">
                Connectez-vous avec un compte administrateur pour ajouter, modifier ou supprimer des données.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg font-medium hover:bg-naatal-green-dark"
              >
                <LogIn size={18} />
                Se connecter
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-naatal-green" />
            Informations sur le programme
          </h2>

          {programmeError && (
            <p className="text-sm rounded-lg p-3 border text-red-700 bg-red-50 border-red-200 mb-3">
              {programmeError}
            </p>
          )}

          {programmeLoading && !programme ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-naatal-green"></div>
              Chargement du programme...
            </div>
          ) : canManageSettings ? (
            <form onSubmit={handleProgrammeSubmit} className="space-y-3">
              <p className="text-xs text-gray-500">
                Ces informations sont affichées dans l'application (en-tête, barre latérale,
                tableau de bord et page de connexion).
              </p>
              <div>
                <label htmlFor="programme-nom" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du programme
                </label>
                <input
                  id="programme-nom"
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  disabled={savingProgramme}
                  value={programmeForm.nom}
                  onChange={(event) => setProgrammeForm({ ...programmeForm, nom: event.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="programme-sigle" className="block text-sm font-medium text-gray-700 mb-1">
                    Sigle
                  </label>
                  <input
                    id="programme-sigle"
                    type="text"
                    maxLength={30}
                    disabled={savingProgramme}
                    value={programmeForm.sigle}
                    onChange={(event) => setProgrammeForm({ ...programmeForm, sigle: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="programme-initiative" className="block text-sm font-medium text-gray-700 mb-1">
                    Initiative
                  </label>
                  <input
                    id="programme-initiative"
                    type="text"
                    maxLength={150}
                    disabled={savingProgramme}
                    value={programmeForm.initiative}
                    onChange={(event) => setProgrammeForm({ ...programmeForm, initiative: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="programme-coordination" className="block text-sm font-medium text-gray-700 mb-1">
                  Coordination
                </label>
                <input
                  id="programme-coordination"
                  type="text"
                  maxLength={255}
                  disabled={savingProgramme}
                  value={programmeForm.coordination}
                  onChange={(event) => setProgrammeForm({ ...programmeForm, coordination: event.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="programme-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="programme-description"
                  rows={3}
                  maxLength={2000}
                  disabled={savingProgramme}
                  value={programmeForm.description}
                  onChange={(event) => setProgrammeForm({ ...programmeForm, description: event.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                />
              </div>

              {programmeMessage && (
                <p className={`text-sm rounded-lg p-3 border ${
                  programmeMessage.type === 'success'
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-red-700 bg-red-50 border-red-200'
                }`}>
                  {programmeMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={savingProgramme}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark disabled:opacity-60"
              >
                <Save size={16} />
                {savingProgramme ? 'Enregistrement...' : 'Enregistrer les informations'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-gray-500">Nom du programme</p>
                <p className="text-sm font-medium text-gray-900">{programme?.nom || '—'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-gray-500">Sigle</p>
                <p className="text-sm font-medium text-gray-900">{programme?.sigle || '—'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-gray-500">Coordination</p>
                <p className="text-sm font-medium text-gray-900">{programme?.coordination || '—'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-gray-500">Initiative</p>
                <p className="text-sm font-medium text-gray-900">{programme?.initiative || '—'}</p>
              </div>
              {programme?.description && (
                <p className="text-sm text-gray-700">{programme.description}</p>
              )}
              <p className="text-xs text-gray-500">
                Seul un administrateur peut modifier ces informations.
              </p>
            </div>
          )}

          {programme?.modifiePar && (
            <p className="text-xs text-gray-500 mt-3 flex items-start gap-1">
              <History size={14} className="mt-0.5 shrink-0" />
              <span>
                Dernière modification par {programme.modifiePar}
                {programme.updatedAt ? ` le ${formatHorodatage(programme.updatedAt)}` : ''}.
              </span>
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={20} className="text-naatal-green" />
              Période de campagne
            </h2>
            {campagne && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUT_STYLES[campagne.statut] || STATUT_STYLES.planifiee}`}>
                {campagne.statutLabel || STATUT_LABELS[campagne.statut]}
              </span>
            )}
          </div>

          {campagneError && (
            <p className="text-sm rounded-lg p-3 border text-red-700 bg-red-50 border-red-200 mb-3">
              {campagneError}
            </p>
          )}

          {campagneLoading && !campagne ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-naatal-green"></div>
              Chargement de la période...
            </div>
          ) : canManageSettings ? (
            <form onSubmit={handleCampaignSubmit} className="space-y-3">
              <p className="text-xs text-gray-500">
                Vous définissez le calendrier officiel de la campagne. Les tableaux de bord,
                rapports et affichages se mettent à jour automatiquement.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="campagne-debut" className="block text-sm font-medium text-gray-700 mb-1">
                    Début de la campagne
                  </label>
                  <input
                    id="campagne-debut"
                    type="date"
                    required
                    value={campaignForm.dateDebut}
                    max={campaignForm.dateFin || undefined}
                    disabled={savingCampaign}
                    onChange={(event) => setCampaignForm({ ...campaignForm, dateDebut: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="campagne-fin" className="block text-sm font-medium text-gray-700 mb-1">
                    Fin de la campagne
                  </label>
                  <input
                    id="campagne-fin"
                    type="date"
                    required
                    value={campaignForm.dateFin}
                    min={campaignForm.dateDebut || undefined}
                    disabled={savingCampaign}
                    onChange={(event) => setCampaignForm({ ...campaignForm, dateFin: event.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={16} className="shrink-0" />
                {campaignPreview?.error ? (
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {campaignPreview.error}
                  </span>
                ) : campaignPreview ? (
                  <span>
                    Durée : <strong>{campaignPreview.dureeJours} jour{campaignPreview.dureeJours > 1 ? 's' : ''}</strong>
                    {' '}• Période : {campaignPreview.periode}
                  </span>
                ) : (
                  <span>Renseignez les deux dates pour calculer la durée.</span>
                )}
              </div>

              {campaignPreview && !campaignPreview.error && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Libellé affiché</p>
                  <p className="text-sm font-medium text-gray-900">{campaignPreview.libelle}</p>
                </div>
              )}

              {campaignMessage && (
                <p className={`text-sm rounded-lg p-3 border ${
                  campaignMessage.type === 'success'
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-red-700 bg-red-50 border-red-200'
                }`}>
                  {campaignMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={savingCampaign || Boolean(campaignPreview?.error)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark disabled:opacity-60"
              >
                <Save size={16} />
                {savingCampaign ? 'Enregistrement...' : 'Enregistrer la période'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-gray-500">Début</p>
                <p className="text-sm font-medium text-gray-900">
                  {campagne ? formatDateFr(campagne.dateDebut) : '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-gray-500">Fin</p>
                <p className="text-sm font-medium text-gray-900">
                  {campagne ? formatDateFr(campagne.dateFin) : '—'}
                </p>
              </div>
              {campagne && (
                <p className="text-sm text-gray-700">
                  <strong>{campagne.dureeJours} jour{campagne.dureeJours > 1 ? 's' : ''}</strong> • {campagne.periode}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Seul un administrateur peut modifier le début et la fin de la campagne.
              </p>
            </div>
          )}

          {campagne?.modifiePar && (
            <p className="text-xs text-gray-500 mt-3 flex items-start gap-1">
              <History size={14} className="mt-0.5 shrink-0" />
              <span>
                Dernière modification par {campagne.modifiePar}
                {campagne.updatedAt ? ` le ${formatHorodatage(campagne.updatedAt)}` : ''}.
              </span>
            </p>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target size={20} className="text-naatal-green" />
            Objectifs prévisionnels
          </h2>

          {programmeError && (
            <p className="text-sm rounded-lg p-3 border text-red-700 bg-red-50 border-red-200 mb-3">
              {programmeError}
            </p>
          )}

          {programmeLoading && !objectifs ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-naatal-green"></div>
              Chargement des objectifs...
            </div>
          ) : canManageSettings ? (
            <form onSubmit={handleObjectifsSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Ces objectifs alimentent les indicateurs du tableau de bord et les rapports.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="p-3 bg-naatal-green-light rounded-lg">
                  <label htmlFor="objectif-arbres" className="block text-sm text-gray-700 mb-1">
                    Arbres à planter
                  </label>
                  <input
                    id="objectif-arbres"
                    type="number"
                    min="0"
                    step="1"
                    required
                    disabled={savingObjectifs}
                    value={objectifsForm.arbres}
                    onChange={(event) => setObjectifsForm({ ...objectifsForm, arbres: event.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <label htmlFor="objectif-survie" className="block text-sm text-gray-700 mb-1">
                    Taux de survie (%)
                  </label>
                  <input
                    id="objectif-survie"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    disabled={savingObjectifs}
                    value={objectifsForm.survieCible}
                    onChange={(event) => setObjectifsForm({ ...objectifsForm, survieCible: event.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <label htmlFor="objectif-dechets" className="block text-sm text-gray-700 mb-1">
                    Déchets à collecter (t)
                  </label>
                  <input
                    id="objectif-dechets"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    disabled={savingObjectifs}
                    value={objectifsForm.dechets}
                    onChange={(event) => setObjectifsForm({ ...objectifsForm, dechets: event.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <label htmlFor="objectif-citoyens" className="block text-sm text-gray-700 mb-1">
                    Citoyens à sensibiliser
                  </label>
                  <input
                    id="objectif-citoyens"
                    type="number"
                    min="0"
                    step="1"
                    required
                    disabled={savingObjectifs}
                    value={objectifsForm.citoyensSensibilises}
                    onChange={(event) => setObjectifsForm({ ...objectifsForm, citoyensSensibilises: event.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <label htmlFor="objectif-participants" className="block text-sm text-gray-700 mb-1">
                    Participants actifs
                  </label>
                  <input
                    id="objectif-participants"
                    type="number"
                    min="0"
                    step="1"
                    required
                    disabled={savingObjectifs}
                    value={objectifsForm.participantsActifs}
                    onChange={(event) => setObjectifsForm({ ...objectifsForm, participantsActifs: event.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green disabled:bg-gray-50"
                  />
                </div>
              </div>

              {objectifsMessage && (
                <p className={`text-sm rounded-lg p-3 border ${
                  objectifsMessage.type === 'success'
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-red-700 bg-red-50 border-red-200'
                }`}>
                  {objectifsMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={savingObjectifs}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg hover:bg-naatal-green-dark disabled:opacity-60"
              >
                <Save size={16} />
                {savingObjectifs ? 'Enregistrement...' : 'Enregistrer les objectifs'}
              </button>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="p-3 bg-naatal-green-light rounded-lg">
                  <p className="text-sm text-gray-700">Arbres à planter</p>
                  <p className="text-xl font-bold text-naatal-green-dark">
                    {objectifs ? formatNombre(objectifs.arbres) : '—'}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-700">Taux de survie</p>
                  <p className="text-xl font-bold text-green-700">
                    {objectifs ? `≥ ${formatNombre(objectifs.survieCible)} %` : '—'}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">Déchets à collecter</p>
                  <p className="text-xl font-bold text-blue-700">
                    {objectifs ? `${formatNombre(objectifs.dechets)} t` : '—'}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-700">Citoyens à sensibiliser</p>
                  <p className="text-xl font-bold text-purple-700">
                    {objectifs ? formatNombre(objectifs.citoyensSensibilises) : '—'}
                  </p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-700">Participants actifs</p>
                  <p className="text-xl font-bold text-orange-700">
                    {objectifs ? formatNombre(objectifs.participantsActifs) : '—'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Ces objectifs sont prévisionnels et distincts des réalisations.
              </p>
              <p className="text-xs text-gray-500">
                Seul un administrateur peut les modifier.
              </p>
            </>
          )}

          {objectifs?.modifiePar && (
            <p className="text-xs text-gray-500 mt-3 flex items-start gap-1">
              <History size={14} className="mt-0.5 shrink-0" />
              <span>
                Dernière modification par {objectifs.modifiePar}
                {objectifs.updatedAt ? ` le ${formatHorodatage(objectifs.updatedAt)}` : ''}.
              </span>
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="lg:col-span-2 bg-white rounded-xl p-5 card-shadow border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Rôles et permissions</h2>
              <Link
                to="/utilisateurs"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark"
              >
                <ShieldCheck size={16} />
                Gérer les utilisateurs
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              {ROLE_OPTIONS.map((role) => (
                <div key={role.value} className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 text-sm">{role.label}</h3>
                  <p className="text-xs text-gray-600 mt-1">{ROLE_DESCRIPTIONS[role.value]}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Les permissions sont contrôlées côté backend à chaque requête : le rôle et les
              permissions effectives sont relus en base, jamais ceux envoyés par le navigateur.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Parametres;
