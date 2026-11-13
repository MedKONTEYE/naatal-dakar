import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Carte from './pages/Carte';
import Interventions from './pages/Interventions';
import Reverdissement from './pages/Reverdissement';
import Salubrite from './pages/Salubrite';
import Mobilisation from './pages/Mobilisation';
import Equipes from './pages/Equipes';
import Rapports from './pages/Rapports';
import Parametres from './pages/Parametres';
import Utilisateurs from './pages/Utilisateurs';
import Login from './pages/Login';
import MonCompte from './pages/MonCompte';
import Messages from './pages/Messages';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CampaignProvider } from './context/CampaignContext';
import { DataSyncProvider } from './context/DataSyncContext';
import { ProgrammeProvider } from './context/ProgrammeContext';
import { MessagingProvider } from './context/MessagingContext';

// La page de scan embarque la bibliothèque de lecture de QR codes :
// on la charge à la demande pour ne pas alourdir le bundle initial.
const ScanArbre = lazy(() => import('./pages/ScanArbre'));

// Les pages d'administration (utilisateurs, permissions) sont inaccessibles
// aux comptes qui ne disposent pas de la permission requise.
const AdminRoute = ({ children, permission = 'users.read' }) => {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!can(permission)) return <Navigate to="/" replace />;
  return children;
};

// La « Vue d'ensemble » (tableau de bord global) est réservée aux
// administrateurs : les autres rôles sont renvoyés vers les interventions.
const AdminOnlyRoute = ({ children }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/interventions" replace />;
  return children;
};

// Toutes les pages de l'application exigent une session active : un visiteur
// non connecté est renvoyé vers /login, puis revient à la page demandée.
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-naatal-cream">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MessagingProvider>
              <Layout>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <AdminOnlyRoute>
                        <Dashboard />
                      </AdminOnlyRoute>
                    }
                  />
                  <Route path="/carte" element={<Carte />} />
                  <Route path="/interventions" element={<Interventions />} />
                  <Route path="/reverdissement" element={<Reverdissement />} />
                  <Route
                    path="/scan-arbre"
                    element={
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-naatal-green"></div>
                          </div>
                        }
                      >
                        <ScanArbre />
                      </Suspense>
                    }
                  />
                  <Route path="/salubrite" element={<Salubrite />} />
                  <Route path="/mobilisation" element={<Mobilisation />} />
                  <Route path="/equipes" element={<Equipes />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/rapports" element={<Rapports />} />
                  <Route
                    path="/utilisateurs"
                    element={
                      <AdminRoute>
                        <Utilisateurs />
                      </AdminRoute>
                    }
                  />
                  <Route path="/parametres" element={<Parametres />} />
                  <Route path="/compte" element={<MonCompte />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </MessagingProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <DataSyncProvider>
      <AuthProvider>
        <ProgrammeProvider>
          <CampaignProvider>
            <Router>
              <AppRoutes />
            </Router>
          </CampaignProvider>
        </ProgrammeProvider>
      </AuthProvider>
    </DataSyncProvider>
  );
}

export default App;
