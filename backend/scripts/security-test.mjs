#!/usr/bin/env node
/*
 * Tests de sécurité non destructifs de l'API NAATAL DAKAR.
 *
 * Prérequis : le serveur doit être démarré (`npm start` dans backend/).
 * Usage     : npm run test:security
 *
 * Le script lit ADMIN_EMAIL / ADMIN_PASSWORD dans backend/.env pour tester
 * l'authentification. Il n'écrit aucune donnée métier en base.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = process.env.SECURITY_TEST_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@naatal.dakar';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DEFAULT_PASSWORD = 'Admin@2026!';
const DEFAULT_JWT_SECRET = 'change-this-secret-in-production';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` | ${detail}` : ''}`);
};

async function request(route, options = {}) {
  const response = await fetch(`${BASE_URL}${route}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body };
}

const jsonRequest = (method, body, token) => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body)
});

const run = async () => {
  const health = await request('/api/health');
  if (health.status !== 200) {
    throw new Error(`API indisponible sur ${BASE_URL}. Démarrez le backend avant de lancer les tests.`);
  }

  // 1. Aucun identifiant par défaut ne doit fonctionner.
  if (ADMIN_PASSWORD && ADMIN_PASSWORD !== DEFAULT_PASSWORD) {
    const oldLogin = await request('/api/auth/login', jsonRequest('POST', {
      email: ADMIN_EMAIL,
      password: DEFAULT_PASSWORD
    }));
    record('Ancien mot de passe par défaut refusé', oldLogin.status === 401, `status=${oldLogin.status}`);
  }

  // 2. Authentification avec le compte configuré.
  const login = await request('/api/auth/login', jsonRequest('POST', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  }));
  record('Connexion administrateur', login.status === 200 && Boolean(login.body?.token), `status=${login.status}`);
  const token = login.body?.token;

  // 3. Jeton forgé avec l'ancien secret public.
  const forged = jwt.sign({ sub: '1', role: 'administrateur' }, DEFAULT_JWT_SECRET, { expiresIn: '1h' });
  const forgedResponse = await request('/api/auth/me', { headers: { authorization: `Bearer ${forged}` } });
  record('Jeton forgé avec le secret public refusé', forgedResponse.status === 401, `status=${forgedResponse.status}`);

  // 4. Jeton sans issuer/audience.
  if (process.env.JWT_SECRET) {
    const noClaims = jwt.sign({ sub: '1', role: 'administrateur' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const noClaimsResponse = await request('/api/auth/me', { headers: { authorization: `Bearer ${noClaims}` } });
    record('Jeton sans issuer/audience refusé', noClaimsResponse.status === 401, `status=${noClaimsResponse.status}`);
  }

  // 5. Limitation de débit sur la connexion.
  const randomEmail = `security-test-${Date.now()}@invalid.test`;
  const attempts = [];
  for (let index = 0; index < 12; index += 1) {
    const response = await request('/api/auth/login', jsonRequest('POST', {
      email: randomEmail,
      password: `Wrong-${index}!`
    }));
    attempts.push(response.status);
  }
  record(
    'Force brute limitée (HTTP 429)',
    attempts[0] === 401 && attempts.includes(429),
    attempts.join(',')
  );

  // 6. Erreur JSON sans fuite de pile ni détail interne.
  const malformed = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad json'
  });
  record(
    'JSON invalide sans fuite technique',
    malformed.status === 400 && !malformed.body?.stack,
    `status=${malformed.status}`
  );

  // 7. Écriture sans authentification.
  const anonymousWrite = await request('/api/interventions', jsonRequest('POST', {
    titre: 'test',
    pilier: 'reverdissement',
    quartier: 'Medina',
    date: '2026-10-01'
  }));
  record('Écriture non authentifiée refusée', anonymousWrite.status === 401, `status=${anonymousWrite.status}`);

  // 8. CORS.
  const untrustedOrigin = await request('/api/health', { headers: { origin: 'https://evil.example' } });
  record(
    'Origine CORS inconnue sans ACAO',
    !untrustedOrigin.headers.get('access-control-allow-origin'),
    `ACAO=${untrustedOrigin.headers.get('access-control-allow-origin')}`
  );

  const trustedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const trustedResponse = await request('/api/health', { headers: { origin: trustedOrigin } });
  record(
    'Origine CORS autorisée acceptée',
    trustedResponse.headers.get('access-control-allow-origin') === trustedOrigin,
    `ACAO=${trustedResponse.headers.get('access-control-allow-origin')}`
  );

  // 9. En-têtes de sécurité.
  const headers = await request('/api/health');
  record(
    'En-têtes de sécurité présents',
    Boolean(headers.headers.get('content-security-policy')) &&
      headers.headers.get('x-content-type-options') === 'nosniff' &&
      !headers.headers.get('x-powered-by'),
    `CSP=${Boolean(headers.headers.get('content-security-policy'))}`
  );

  // 10. Corps trop volumineux.
  const oversized = await request('/api/auth/login', jsonRequest('POST', {
    email: 'a@b.co',
    password: 'x'.repeat(200000)
  }));
  record('Corps trop volumineux refusé (413)', oversized.status === 413, `status=${oversized.status}`);

  // 11. Validation des entrées (aucune écriture valide).
  const invalidPillar = await request('/api/interventions', jsonRequest('POST', {
    titre: 'Test',
    pilier: 'injection',
    quartier: 'Medina',
    date: '2026-10-01'
  }, token));
  record('Pilier invalide refusé', invalidPillar.status === 400, `status=${invalidPillar.status}`);

  const invalidDate = await request('/api/interventions', jsonRequest('POST', {
    titre: 'Test',
    pilier: 'reverdissement',
    quartier: 'Medina',
    date: '2026-99-99'
  }, token));
  record('Date invalide refusée', invalidDate.status === 400, `status=${invalidDate.status}`);

  const invalidTeam = await request('/api/teams', jsonRequest('POST', { nom: 'Test', membres: -5 }, token));
  record('Nombre de membres négatif refusé', invalidTeam.status === 400, `status=${invalidTeam.status}`);

  const invalidTrees = await request('/api/trees', jsonRequest('POST', { site: 'Test', arbresPlantes: 'abc' }, token));
  record('Nombre d’arbres invalide refusé', invalidTrees.status === 400, `status=${invalidTrees.status}`);

  const htmlInjection = await request('/api/trees', jsonRequest('POST', {
    site: '<script>alert(1)</script>',
    arbresPlantes: 10
  }, token));
  record('Balise HTML dans un champ texte refusée', htmlInjection.status === 400, `status=${htmlInjection.status}`);

  const injectedId = await request('/api/interventions/1%20OR%201=1', {
    headers: { authorization: `Bearer ${token}` }
  });
  record('Identifiant avec injection refusé', injectedId.status === 400, `status=${injectedId.status}`);

  const sqlInjection = await request('/api/interventions?search=%27%20OR%201%3D1%20--', {
    headers: { authorization: `Bearer ${token}` }
  });
  record(
    'Recherche SQLi sans effet',
    sqlInjection.status === 200 && sqlInjection.body?.count === 0,
    `status=${sqlInjection.status} count=${sqlInjection.body?.count}`
  );

  const oversizedQr = await request(`/api/trees/scan/${'A'.repeat(5000)}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  record('Code QR surdimensionné sans erreur 500', [400, 404].includes(oversizedQr.status), `status=${oversizedQr.status}`);

  const weakPassword = await request('/api/auth/password', jsonRequest('PUT', {
    currentPassword: ADMIN_PASSWORD,
    newPassword: 'faible'
  }, token));
  record('Nouveau mot de passe faible refusé', weakPassword.status === 400, `status=${weakPassword.status}`);

  // 12. Gestion des utilisateurs et contrôle des privilèges.
  const stamp = Date.now();
  const tempEmail = `security-test-gestionnaire-${stamp}@invalid.test`;
  const created = await request('/api/users', jsonRequest('POST', {
    nom: 'Test Sécurité',
    email: tempEmail,
    telephone: '+221 77 000 00 00',
    role: 'gestionnaire'
  }, token));
  const tempUserEmail = created.body?.user?.email;
  const tempPassword = created.body?.temporaryPassword;
  record(
    'Création utilisateur par super administrateur',
    created.status === 201 && tempUserEmail === tempEmail && Boolean(tempPassword),
    `status=${created.status}`
  );

  const tempLogin = await request('/api/auth/login', jsonRequest('POST', {
    email: tempEmail,
    password: tempPassword
  }));
  record('Connexion du nouvel utilisateur', tempLogin.status === 200 && Boolean(tempLogin.body?.token), `status=${tempLogin.status}`);
  const tempToken = tempLogin.body?.token;

  const forbiddenList = await request('/api/users', {
    headers: { authorization: `Bearer ${tempToken}` }
  });
  record('Gestion des utilisateurs refusée au gestionnaire', forbiddenList.status === 403, `status=${forbiddenList.status}`);

  const forbiddenRole = await request(`/api/users/${encodeURIComponent(tempEmail)}/role`, jsonRequest('PATCH', { role: 'super_admin' }, tempToken));
  record('Auto-promotion refusée au gestionnaire', forbiddenRole.status === 403, `status=${forbiddenRole.status}`);

  const forbiddenDelete = await request(`/api/users/${encodeURIComponent(tempEmail)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${tempToken}` }
  });
  record('Suppression de compte refusée au gestionnaire', forbiddenDelete.status === 403, `status=${forbiddenDelete.status}`);

  const allowedWrite = await request('/api/trees', jsonRequest('POST', { site: 'Test' }, tempToken));
  record(
    'Écriture opérationnelle autorisée au gestionnaire',
    allowedWrite.status === 400,
    `status=${allowedWrite.status} (400 = contrôle de permission franchi)`
  );

  const adminEmail = `security-test-admin-${stamp}@invalid.test`;
  const createdAdmin = await request('/api/users', jsonRequest('POST', {
    nom: 'Admin Test',
    email: adminEmail,
    role: 'administrateur'
  }, token));
  const createdAdminEmail = createdAdmin.body?.user?.email;
  const adminPassword = createdAdmin.body?.temporaryPassword;
  record(
    'Création administrateur par super administrateur',
    createdAdmin.status === 201 && createdAdminEmail === adminEmail && Boolean(adminPassword),
    `status=${createdAdmin.status}`
  );

  const adminLogin = await request('/api/auth/login', jsonRequest('POST', {
    email: adminEmail,
    password: adminPassword
  }));
  const adminToken = adminLogin.body?.token;
  record('Connexion du nouvel administrateur', adminLogin.status === 200, `status=${adminLogin.status}`);

  const adminList = await request('/api/users', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  record('Consultation des utilisateurs autorisée à l’administrateur', adminList.status === 200, `status=${adminList.status}`);

  const escalation = await request('/api/users', jsonRequest('POST', {
    nom: 'Escalade',
    email: `security-test-escalade-${stamp}@invalid.test`,
    role: 'super_admin'
  }, adminToken));
  record('Escalade de privilèges refusée (création super admin)', escalation.status === 403, `status=${escalation.status}`);

  const touchSuperAdmin = await request(
    `/api/users/${encodeURIComponent(ADMIN_EMAIL)}/status`,
    jsonRequest('PATCH', { actif: false }, adminToken)
  );
  record('Modification d’un super administrateur refusée', touchSuperAdmin.status === 403, `status=${touchSuperAdmin.status}`);

  const selfDemote = await request(
    `/api/users/${encodeURIComponent(ADMIN_EMAIL)}/role`,
    jsonRequest('PATCH', { role: 'agent' }, token)
  );
  record('Auto-rétrogradation refusée', selfDemote.status === 400, `status=${selfDemote.status}`);

  const selfDelete = await request(`/api/users/${encodeURIComponent(ADMIN_EMAIL)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  record('Auto-suppression refusée', selfDelete.status === 400, `status=${selfDelete.status}`);

  const roleChange = await request(`/api/users/${encodeURIComponent(tempEmail)}/role`, jsonRequest('PATCH', { role: 'agent' }, token));
  record(
    'Changement de rôle appliqué',
    roleChange.status === 200 && roleChange.body?.user?.role === 'agent',
    `status=${roleChange.status}`
  );

  const deactivate = await request(`/api/users/${encodeURIComponent(tempEmail)}/status`, jsonRequest('PATCH', { actif: false }, token));
  record(
    'Désactivation de compte appliquée',
    deactivate.status === 200 && deactivate.body?.user?.actif === false,
    `status=${deactivate.status}`
  );

  const blockedLogin = await request('/api/auth/login', jsonRequest('POST', {
    email: tempEmail,
    password: tempPassword
  }));
  record('Connexion refusée pour un compte désactivé', blockedLogin.status === 401, `status=${blockedLogin.status}`);

  const reactivate = await request(`/api/users/${encodeURIComponent(tempEmail)}/status`, jsonRequest('PATCH', { actif: true }, token));
  record('Réactivation de compte appliquée', reactivate.status === 200, `status=${reactivate.status}`);

  const resetPassword = await request(`/api/users/${encodeURIComponent(tempEmail)}/reset-password`, jsonRequest('POST', {}, token));
  record(
    'Réinitialisation de mot de passe avec jeton temporaire',
    resetPassword.status === 200 && Boolean(resetPassword.body?.temporaryPassword),
    `status=${resetPassword.status}`
  );

  const oldPasswordLogin = await request('/api/auth/login', jsonRequest('POST', {
    email: tempEmail,
    password: tempPassword
  }));
  record('Ancien mot de passe refusé après réinitialisation', oldPasswordLogin.status === 401, `status=${oldPasswordLogin.status}`);

  const newPasswordLogin = await request('/api/auth/login', jsonRequest('POST', {
    email: tempEmail,
    password: resetPassword.body?.temporaryPassword
  }));
  record('Nouveau mot de passe accepté', newPasswordLogin.status === 200, `status=${newPasswordLogin.status}`);

  const deleted = await request(`/api/users/${encodeURIComponent(tempEmail)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  record('Suppression d’utilisateur', deleted.status === 200, `status=${deleted.status}`);

  const deletedLogin = await request('/api/auth/login', jsonRequest('POST', {
    email: tempEmail,
    password: resetPassword.body?.temporaryPassword
  }));
  record('Connexion refusée après suppression du compte', deletedLogin.status === 401, `status=${deletedLogin.status}`);

  const deleteAdmin = await request(`/api/users/${encodeURIComponent(adminEmail)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  record('Nettoyage du compte administrateur de test', deleteAdmin.status === 200, `status=${deleteAdmin.status}`);

  // 13. Révocation du jeton à la déconnexion.
  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` }
  });
  record('Déconnexion', logout.status === 200, `status=${logout.status}`);

  const revokedToken = await request('/api/auth/me', {
    headers: { authorization: `Bearer ${token}` }
  });
  record('Jeton révoqué après déconnexion', revokedToken.status === 401, `status=${revokedToken.status}`);

  // 13. Les informations institutionnelles restent lisibles sans jeton.
  const publicRead = await request('/api/parametres');
  record('Lecture publique des paramètres conservée', publicRead.status === 200, `status=${publicRead.status}`);

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} tests de sécurité réussis`);
  if (failed.length > 0) {
    console.log('Échecs :');
    failed.forEach((item) => console.log(` - ${item.name} (${item.detail})`));
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(`\n❌ ${error.message}`);
  process.exitCode = 1;
});
