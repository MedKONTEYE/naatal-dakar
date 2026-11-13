import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useDataSync } from './DataSyncContext';

const CampaignContext = createContext(null);

// Contexte partagé par le tableau de bord, la barre latérale, les rapports
// et les paramètres : une seule lecture réseau, une mise à jour immédiate
// partout après enregistrement par l'administrateur.
export const CampaignProvider = ({ children }) => {
  const { revision, notifyChange } = useDataSync();
  const [campagne, setCampagne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/campagne');
      setCampagne(response.data.campagne);
      setError(null);
      return response.data.campagne;
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger la période de campagne.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      // L'erreur est exposée via `error`, sans interrompre l'application.
    });
  }, [refresh, revision]);

  const updateCampagne = useCallback(async (payload) => {
    const response = await axios.put('/api/campagne', payload);
    setCampagne(response.data.campagne);
    setError(null);
    notifyChange();
    return response.data;
  }, [notifyChange]);

  const value = useMemo(
    () => ({ campagne, loading, error, refresh, updateCampagne }),
    [campagne, loading, error, refresh, updateCampagne]
  );

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
};

export const useCampaign = () => {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaign doit être utilisé dans un CampaignProvider');
  }
  return context;
};
