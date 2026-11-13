import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  User,
  UserPlus,
  Phone,
  Eye,
  EyeOff,
  Leaf,
  TreePine,
  Trash2,
  Users,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProgramme } from '../context/ProgrammeContext';

const PILLARS = [
  { icon: TreePine, label: 'Reverdissement de Dakar' },
  { icon: Trash2, label: 'Salubrité et gestion des déchets' },
  { icon: Users, label: 'Mobilisation citoyenne' }
];

const Login = () => {
  const { login, register, user } = useAuth();
  const { programme } = useProgramme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const redirectTo = from ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/';

  const [mode, setMode] = useState('login');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusPassword, setFocusPassword] = useState(false);
  const passwordRef = useRef(null);

  const isRegister = mode === 'register';
  const programmeName = programme?.nom || 'NAATAL DAKAR';

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  // Après l'inscription, on bascule sur l'onglet connexion : le focus est
  // placé sur le mot de passe pour que l'utilisateur n'ait plus qu'à le saisir.
  useEffect(() => {
    if (!focusPassword) return;
    passwordRef.current?.focus();
    setFocusPassword(false);
  }, [focusPassword]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (isRegister && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ nom, email, telephone, password, confirmPassword });
        // Compte créé : on ne connecte pas automatiquement, on revient à
        // l'onglet de connexion avec l'email déjà renseigné.
        setMode('login');
        setNom('');
        setTelephone('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setNotice('Inscription confirmée ! Votre compte a bien été créé. Connectez-vous avec votre email et votre mot de passe.');
        setFocusPassword(true);
      } else {
        await login(email, password);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(
        err.response?.data?.message
          || (isRegister
            ? 'Création du compte impossible. Vérifiez les informations saisies.'
            : 'Connexion impossible. Vérifiez vos identifiants.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-naatal-green focus:border-naatal-green transition-colors';
  const passwordInputClass = 'w-full pl-10 pr-11 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-naatal-green focus:border-naatal-green transition-colors';

  const brandMark = (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
        <Leaf size={24} className="text-white" />
      </div>
      <div>
        <p className="text-lg font-bold tracking-wide leading-tight">{programmeName}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
          Ville de Dakar · DPDD
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-naatal-cream lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panneau institutionnel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-naatal-green-dark text-white p-10 xl:p-14">
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-naatal-green/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">{brandMark}</div>

        <div className="relative max-w-lg py-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-white/80">
            <ShieldCheck size={14} />
            Plateforme officielle
          </span>

          <h1 className="mt-6 text-3xl xl:text-4xl font-bold leading-tight">
            Agir ensemble pour une ville plus verte et plus propre.
          </h1>
          <p className="mt-4 text-sm xl:text-base text-white/70 leading-relaxed">
            {programme?.description
              || 'Suivi du reverdissement, de la salubrité et de la mobilisation citoyenne de la Ville de Dakar.'}
          </p>

          <ul className="mt-8 space-y-3">
            {PILLARS.map((pillar) => (
              <li key={pillar.label} className="flex items-center gap-3 text-sm text-white/85">
                <span className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                  <pillar.icon size={18} />
                </span>
                {pillar.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/55">
          <p className="font-medium text-white/75">
            {programme?.coordination || 'Direction de la Planification et du Développement Durable'}
          </p>
          <p className="mt-1">
            {programme?.initiative || 'Initiative de la Ville de Dakar'} · {new Date().getFullYear()}
          </p>
        </div>
      </aside>

      {/* Formulaire */}
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-naatal-green text-white flex items-center justify-center">
                <Leaf size={24} />
              </div>
              <div>
                <p className="text-lg font-bold text-naatal-green-dark leading-tight">{programmeName}</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                  Ville de Dakar · DPDD
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl card-shadow border border-gray-100 overflow-hidden">
            <div className="px-6 pt-6">
              <div className="flex items-center gap-2 text-naatal-green">
                <ShieldCheck size={20} />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isRegister ? 'Nouveau compte' : 'Espace sécurisé'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mt-2">
                {isRegister ? 'Créer votre compte' : 'Connexion à votre espace'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isRegister
                  ? 'Renseignez vos informations pour rejoindre la plateforme.'
                  : 'Identifiez-vous pour accéder aux tableaux de bord et aux données du programme.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 mx-6 mt-5 p-1 bg-naatal-cream rounded-lg">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  !isRegister
                    ? 'bg-white text-naatal-green-dark shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Lock size={16} />
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isRegister
                    ? 'bg-white text-naatal-green-dark shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserPlus size={16} />
                Créer un compte
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {notice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3"
                >
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
                  <span>{notice}</span>
                </div>
              )}

              {isRegister && (
                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="nom"
                      name="nom"
                      type="text"
                      required
                      minLength={2}
                      maxLength={150}
                      autoComplete="name"
                      value={nom}
                      onChange={(event) => setNom(event.target.value)}
                      className={inputClass}
                      placeholder="Prénom et nom"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete={isRegister ? 'email' : 'username'}
                    maxLength={190}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="vous@exemple.com"
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone <span className="text-gray-400 font-normal">(facultatif)</span>
                  </label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="telephone"
                      name="telephone"
                      type="tel"
                      maxLength={30}
                      autoComplete="tel"
                      value={telephone}
                      onChange={(event) => setTelephone(event.target.value)}
                      className={inputClass}
                      placeholder="+221 77 000 00 00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    maxLength={72}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={passwordInputClass}
                    placeholder={isRegister ? 'Choisissez un mot de passe' : 'Votre mot de passe'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {isRegister && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre et un caractère spécial.
                  </p>
                )}
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      maxLength={72}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={inputClass}
                      placeholder="Saisissez à nouveau le mot de passe"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-naatal-green text-white rounded-lg font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
              >
                {submitting
                  ? (isRegister ? 'Création du compte...' : 'Connexion...')
                  : (isRegister ? 'Créer mon compte' : 'Se connecter')}
                {!submitting && (isRegister ? <UserPlus size={18} /> : <ArrowRight size={18} />)}
              </button>

              <p className="text-center text-xs text-gray-500">
                {isRegister
                  ? 'Un nouveau compte dispose d’un accès en lecture seule. Un administrateur peut ensuite modifier vos droits.'
                  : 'Accès réservé aux agents, partenaires et citoyens disposant d’un compte.'}
              </p>
            </form>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 mt-4 px-1">
            <span>© {new Date().getFullYear()} Ville de Dakar</span>
            <span>Accès sécurisé</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
