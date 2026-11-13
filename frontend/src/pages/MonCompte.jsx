import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  Save,
  LogOut,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Users,
  UserPlus,
  UserMinus
} from 'lucide-react';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { roleLabel, ROLE_BADGES, ROLE_DESCRIPTIONS } from '../utils/roles';

const formatDate = (value) => {
  if (!value) return 'Jamais connecté';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
};

const StatusMessage = ({ status }) => {
  if (!status?.message) return null;
  const isSuccess = status.type === 'success';
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg p-3 border ${
        isSuccess
          ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-red-600 bg-red-50 border-red-200'
      }`}
    >
      {isSuccess ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
      <span>{status.message}</span>
    </div>
  );
};

const MonCompte = () => {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { revision, notifyChange } = useDataSync();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ nom: '', email: '', telephone: '' });
  const [profileStatus, setProfileStatus] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [myTeams, setMyTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [verification, setVerification] = useState(null);
  const [joinStatus, setJoinStatus] = useState(null);
  const [joining, setJoining] = useState(false);

  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaveStatus, setLeaveStatus] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      nom: user.nom || '',
      email: user.email || '',
      telephone: user.telephone || ''
    });
  }, [user]);

  // Les équipes rejointes sont relues depuis MySQL à chaque synchronisation :
  // l'adhésion apparaît immédiatement, y compris depuis un autre onglet.
  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    setTeamsLoading(true);
    axios
      .get('/api/teams/mes-equipes')
      .then((response) => {
        if (!cancelled) setMyTeams(response.data.data || []);
      })
      .catch((error) => {
        if (!cancelled) console.error(error);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, revision]);

  // Vérification automatique du code pendant la saisie (avec un court délai
  // pour ne pas interroger l'API à chaque frappe).
  useEffect(() => {
    if (!showJoinForm) {
      setVerification(null);
      return undefined;
    }

    const code = joinCode.trim();
    if (code.length < 4) {
      setVerification(null);
      return undefined;
    }

    let cancelled = false;
    setVerification({ status: 'loading', message: 'Vérification du code…' });

    const timer = setTimeout(async () => {
      try {
        const response = await axios.post('/api/teams/verifier-code', { code });
        if (cancelled) return;

        const equipe = response.data.equipe;
        if (response.data.dejaMembre) {
          setVerification({
            status: 'member',
            message: `Vous êtes déjà membre de l’équipe ${equipe.nom}.`,
            equipe
          });
        } else {
          setVerification({
            status: 'valid',
            message: `Code valide : ${equipe.nom}.`,
            equipe
          });
        }
      } catch (error) {
        if (!cancelled) {
          setVerification({
            status: 'invalid',
            message: error.response?.data?.message || 'Code d’invitation invalide ou inexistant.'
          });
        }
      }
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [joinCode, showJoinForm]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const initials = (user.nom || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  const inputClass = 'w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-naatal-green';

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileStatus(null);
    setSavingProfile(true);
    try {
      const result = await updateProfile(profile);
      setProfileStatus({ type: 'success', message: result.message || 'Profil mis à jour.' });
    } catch (error) {
      setProfileStatus({
        type: 'error',
        message: error.response?.data?.message || 'Impossible de mettre à jour le profil.'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordStatus(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    setSavingPassword(true);
    try {
      const result = await changePassword(passwords.currentPassword, passwords.newPassword);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStatus({ type: 'success', message: result.message || 'Mot de passe mis à jour.' });
    } catch (error) {
      setPasswordStatus({
        type: 'error',
        message: error.response?.data?.message || 'Impossible de modifier le mot de passe.'
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleJoinForm = () => {
    setShowJoinForm((value) => !value);
    setJoinStatus(null);
    setVerification(null);
  };

  const handleJoinSubmit = async (event) => {
    event.preventDefault();
    setJoinStatus(null);

    if (!verification || verification.status !== 'valid') {
      setJoinStatus({
        type: 'error',
        message: 'Saisissez un code d’invitation valide pour rejoindre une équipe.'
      });
      return;
    }

    setJoining(true);
    try {
      const response = await axios.post('/api/teams/rejoindre', { code: joinCode.trim() });
      setJoinStatus({
        type: 'success',
        message: response.data.message || `Vous avez rejoint l’équipe ${verification.equipe.nom}.`
      });
      setJoinCode('');
      setVerification(null);
      setShowJoinForm(false);
      notifyChange();
    } catch (error) {
      setJoinStatus({
        type: 'error',
        message: error.response?.data?.message || 'Impossible de rejoindre cette équipe.'
      });
    } finally {
      setJoining(false);
    }
  };

  const openLeaveModal = (team) => {
    setLeaveStatus(null);
    setLeaveTarget(team);
  };

  const closeLeaveModal = () => {
    if (leaving) return;
    setLeaveTarget(null);
  };

  const handleLeaveTeam = async () => {
    if (!leaveTarget) return;
    setLeaveStatus(null);
    setLeaving(true);
    try {
      const response = await axios.delete(`/api/teams/mes-equipes/${leaveTarget.id}`);
      setLeaveStatus({
        type: 'success',
        message: response.data.message || `Vous avez quitté l’équipe ${leaveTarget.nom}.`
      });
      setLeaveTarget(null);
      notifyChange();
    } catch (error) {
      setLeaveStatus({
        type: 'error',
        message: error.response?.data?.message || 'Impossible de quitter cette équipe.'
      });
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mon compte</h2>
        <p className="text-sm text-gray-600 mt-1">
          Gérez vos informations personnelles et la sécurité de votre accès.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-gray-100 card-shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-naatal-green-light text-naatal-green-dark flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{user.nom}</h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${ROLE_BADGES[user.role] || ROLE_BADGES.utilisateur}`}>
                <ShieldCheck size={13} />
                {roleLabel(user.role)}
              </span>
            </div>
            <p className="text-sm text-gray-600 truncate">{user.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              {ROLE_DESCRIPTIONS[user.role] || 'Compte utilisateur.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>

        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <CalendarClock size={15} />
          Dernière connexion : {formatDate(user.derniereConnexion)}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 card-shadow p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-naatal-green-light text-naatal-green-dark flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mes équipes</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Rejoignez une équipe avec le code d’invitation communiqué par l’administrateur.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleJoinForm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-naatal-green text-naatal-green-dark rounded-lg text-sm font-medium hover:bg-naatal-green-light transition-colors"
          >
            <UserPlus size={17} />
            {showJoinForm ? 'Fermer le formulaire' : 'Rejoindre une équipe'}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <StatusMessage status={joinStatus} />
          <StatusMessage status={leaveStatus} />
        </div>

        {showJoinForm && (
          <form
            onSubmit={handleJoinSubmit}
            className="mt-5 rounded-xl border border-naatal-green-light bg-naatal-cream p-4 sm:p-5 space-y-4"
          >
            <div>
              <label htmlFor="join-team-code" className="block text-sm font-medium text-gray-700 mb-1">
                Code de l’équipe
              </label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="join-team-code"
                  type="text"
                  required
                  minLength={4}
                  maxLength={20}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="NDK-XXXXXXXX"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Le code est vérifié automatiquement dès sa saisie.
              </p>
            </div>

            {verification && (
              <div
                className={`flex items-start gap-2 text-sm rounded-lg p-3 border ${
                  verification.status === 'valid'
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : verification.status === 'member'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : verification.status === 'invalid'
                        ? 'text-red-600 bg-red-50 border-red-200'
                        : 'text-gray-600 bg-white border-gray-200'
                }`}
              >
                {verification.status === 'loading' ? (
                  <span className="inline-block w-4 h-4 mt-0.5 border-2 border-gray-300 border-t-naatal-green rounded-full animate-spin shrink-0" />
                ) : verification.status === 'valid' ? (
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                )}
                <span>
                  {verification.message}
                  {verification.equipe?.zone ? ` Zone : ${verification.equipe.zone}.` : ''}
                </span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={toggleJoinForm}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={joining || verification?.status !== 'valid'}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <UserPlus size={17} />
                {joining ? 'Adhésion…' : 'Rejoindre l’équipe'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-5">
          {teamsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-naatal-green"></div>
            </div>
          ) : myTeams.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
              Vous n’avez rejoint aucune équipe pour le moment.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {myTeams.map((team) => (
                <div key={team.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{team.nom}</p>
                      <p className="text-xs text-gray-500">{team.zone || 'Zone non renseignée'}</p>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded-full text-xs bg-naatal-green-light text-naatal-green-dark">
                      {team.roleMembre === 'responsable' ? 'Responsable' : 'Membre'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium text-gray-700">Responsable :</span> {team.responsable || '—'}</p>
                    <p><span className="font-medium text-gray-700">Membres inscrits :</span> {team.membresInscrits ?? team.membres}</p>
                    {team.joinedAt && (
                      <p className="text-xs text-gray-500">Adhésion : {formatDate(team.joinedAt)}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openLeaveModal(team)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <UserMinus size={14} />
                    Quitter l’équipe
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-xl border border-gray-100 card-shadow p-6">
          <div className="flex items-center gap-2 mb-5">
            <User size={20} className="text-naatal-green" />
            <h3 className="font-semibold text-gray-900">Informations personnelles</h3>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="compte-nom" className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="compte-nom"
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                  value={profile.nom}
                  onChange={(event) => setProfile((value) => ({ ...value, nom: event.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="compte-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="compte-email"
                  type="email"
                  required
                  maxLength={190}
                  autoComplete="email"
                  value={profile.email}
                  onChange={(event) => setProfile((value) => ({ ...value, email: event.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="compte-telephone" className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="compte-telephone"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  value={profile.telephone}
                  onChange={(event) => setProfile((value) => ({ ...value, telephone: event.target.value }))}
                  className={inputClass}
                  placeholder="+221 77 000 00 00"
                />
              </div>
            </div>

            <StatusMessage status={profileStatus} />

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
            >
              <Save size={17} />
              {savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 card-shadow p-6">
          <div className="flex items-center gap-2 mb-5">
            <KeyRound size={20} className="text-naatal-green" />
            <h3 className="font-semibold text-gray-900">Sécurité</h3>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="currentPassword"
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={(event) => setPasswords((value) => ({ ...value, currentPassword: event.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="newPassword"
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((value) => ({ ...value, newPassword: event.target.value }))}
                  className={inputClass}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre et un caractère spécial.
              </p>
            </div>

            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmNewPassword"
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={(event) => setPasswords((value) => ({ ...value, confirmPassword: event.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <StatusMessage status={passwordStatus} />

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
            >
              <Save size={17} />
              {savingPassword ? 'Mise à jour...' : 'Changer le mot de passe'}
            </button>
          </form>
        </section>
      </div>

      <Modal
        open={Boolean(leaveTarget)}
        title="Quitter l’équipe"
        subtitle={leaveTarget?.nom}
        onClose={closeLeaveModal}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={closeLeaveModal}
              disabled={leaving}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleLeaveTeam}
              disabled={leaving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <UserMinus size={16} />
              {leaving ? 'Départ…' : 'Quitter l’équipe'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Confirmez-vous vouloir quitter l’équipe <strong>{leaveTarget?.nom}</strong> ?
          Votre adhésion sera supprimée, mais l’équipe et ses autres membres seront conservés.
        </p>
        <div className="mt-4">
          <StatusMessage status={leaveStatus} />
        </div>
      </Modal>
    </div>
  );
};

export default MonCompte;
