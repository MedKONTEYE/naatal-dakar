import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useDataSync } from './DataSyncContext';

const ProgrammeContext = createContext(null);

// Paramètres institutionnels partagés : informations du programme et objectifs
// prévisionnels. Une mise à jour par l'administrateur se propage immédiatement
// à l'en-tête, à la barre latérale, au tableau de bord et aux paramètres.
export const ProgrammeProvider = ({ children }) => {
  const { revision, notifyChange } = useDataSync();
  const [programme, setProgramme] = useState(null);
  const [objectifs, setObjectifs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/parametres');
      setProgramme(response.data.programme);
      setObjectifs(response.data.objectifs);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les paramètres du programme.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      // L'erreur est exposée via `error`, sans bloquer l'application.
    });
  }, [refresh, revision]);

  const updateProgramme = useCallback(async (payload) => {
    const response = await axios.put('/api/parametres/programme', payload);
    setProgramme(response.data.programme);
    setError(null);
    notifyChange();
    return response.data;
  }, [notifyChange]);

  const updateObjectifs = useCallback(async (payload) => {
    const response = await axios.put('/api/parametres/objectifs', payload);
    setObjectifs(response.data.objectifs);
    setError(null);
    notifyChange();
    return response.data;
  }, [notifyChange]);

  const value = useMemo(
    () => ({ programme, objectifs, loading, error, refresh, updateProgramme, updateObjectifs }),
    [programme, objectifs, loading, error, refresh, updateProgramme, updateObjectifs]
  );

  return <ProgrammeContext.Provider value={value}>{children}</ProgrammeContext.Provider>;
};

export const useProgramme = () => {
  const context = useContext(ProgrammeContext);
  if (!context) {
    throw new Error('useProgramme doit être utilisé dans un ProgrammeProvider');
  }
  return context;
};
