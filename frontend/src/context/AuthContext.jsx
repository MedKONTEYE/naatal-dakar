import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useDataSync } from './DataSyncContext';

const AuthContext = createContext(null);
export const AUTH_TOKEN_KEY = 'naatal_admin_token';
const TOKEN_KEY = AUTH_TOKEN_KEY;

export const AuthProvider = ({ children }) => {
  const { revision } = useDataSync();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    axios
      .get('/api/auth/me')
      .then((response) => {
        if (!cancelled) setUser(response.data.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Le profil connecté est relu après chaque synchronisation : une modification
  // de rôle, de permissions ou de statut est ainsi répercutée immédiatement,
  // y compris depuis un autre onglet.
  useEffect(() => {
    if (revision === 0) return undefined;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return undefined;

    let cancelled = false;
    axios
      .get('/api/auth/me')
      .then((response) => {
        if (!cancelled) setUser(response.data.user);
      })
      .catch(() => {
        // La session a pu être révoquée entre-temps : on nettoie le jeton local.
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  // L'inscription ne crée pas de session : l'utilisateur est renvoyé vers
  // l'écran de connexion pour saisir lui-même ses identifiants.
  const register = async ({ nom, email, telephone, password, confirmPassword }) => {
    const response = await axios.post('/api/auth/register', {
      nom,
      email,
      telephone,
      password,
      confirmPassword
    });
    return response.data;
  };

  const applySession = (token, nextUser) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    if (nextUser) {
      setUser(nextUser);
    }
  };

  const updateProfile = async ({ nom, email, telephone }) => {
    const response = await axios.put('/api/auth/profile', { nom, email, telephone });
    applySession(response.data.token, response.data.user);
    return response.data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const response = await axios.put('/api/auth/password', { currentPassword, newPassword });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      // Le jeton reste supprimé côté client même si l'appel échoue.
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => {
      const permissions = user?.permissions || [];
      return {
        user,
        loading,
        login,
        register,
        updateProfile,
        applySession,
        changePassword,
        logout,
        permissions,
        can: (permission) => permissions.includes(permission),
        isAuthenticated: Boolean(user),
        isAdmin: ['super_admin', 'administrateur'].includes(user?.role),
        isSuperAdmin: user?.role === 'super_admin'
      };
    },
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
