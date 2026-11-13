import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

const DataSyncContext = createContext(null);

// Canal utilisé pour prévenir immédiatement les autres onglets ouverts
// qu'une donnée vient d'être modifiée en base.
const CHANNEL_NAME = 'naatal-dakar-data-sync';

// Toute donnée affichée provient de MySQL. Ce contexte fournit un compteur
// `revision` incrémenté après chaque écriture (ou au retour sur l'onglet) :
// les pages et contextes abonnés relisent alors l'API et affichent la valeur
// réellement stockée en base, sans cache local ni valeur figée.
export const DataSyncProvider = ({ children }) => {
  const [revision, setRevision] = useState(0);
  const channelRef = useRef(null);

  const bumpRevision = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === 'data-changed') {
          bumpRevision();
        }
      };
    }

    const handleFocus = () => bumpRevision();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') bumpRevision();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [bumpRevision]);

  const notifyChange = useCallback(() => {
    // Rafraîchit l'onglet courant...
    bumpRevision();
    // ...et prévient les autres onglets ouverts sur la même application.
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'data-changed' });
    }
  }, [bumpRevision]);

  const value = useMemo(
    () => ({ revision, notifyChange }),
    [revision, notifyChange]
  );

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
};

export const useDataSync = () => {
  const context = useContext(DataSyncContext);
  if (!context) {
    throw new Error('useDataSync doit être utilisé dans un DataSyncProvider');
  }
  return context;
};
