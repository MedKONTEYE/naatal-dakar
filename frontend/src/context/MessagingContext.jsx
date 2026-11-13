import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MessageCircle, X } from 'lucide-react';
import { useAuth, AUTH_TOKEN_KEY } from './AuthContext';
import Avatar from '../components/Avatar';

const MessagingContext = createContext(null);

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 6000;

const previewOf = (content) => {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Nouveau message';
  return text.length > 110 ? `${text.slice(0, 110)}…` : text;
};

export const MessagingProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [onlineEmails, setOnlineEmails] = useState(() => new Set());
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const socketRef = useRef(null);
  const activeConversationRef = useRef(null);
  const toastTimers = useRef(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    // StrictMode exécute les effets deux fois en développement : le drapeau
    // doit être réarmé à chaque montage, sinon les mises à jour temps réel
    // seraient silencieusement ignorées.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      toastTimers.current.forEach((timer) => clearTimeout(timer));
      toastTimers.current.clear();
    };
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user?.email) return [];
    try {
      const response = await axios.get('/api/messages/conversations');
      const data = response.data.data || [];
      if (!mountedRef.current) return data;

      setConversations(data);
      setError(null);
      setOnlineEmails((previous) => {
        const next = new Set(previous);
        data.forEach((conversation) => {
          if (conversation.online) next.add(conversation.participant.email);
          else next.delete(conversation.participant.email);
        });
        return next;
      });
      return data;
    } catch (requestError) {
      if (mountedRef.current && requestError.response?.status !== 401) {
        setError('Impossible de charger les conversations.');
      }
      return [];
    }
  }, [user?.email]);

  const removeToast = useCallback((toastId) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== toastId));
    const timer = toastTimers.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(toastId);
    }
  }, []);

  const pushToast = useCallback((toast) => {
    setToasts((previous) => {
      if (previous.some((item) => item.id === toast.id)) return previous;
      return [...previous, toast].slice(-MAX_TOASTS);
    });

    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, TOAST_DURATION_MS);
    toastTimers.current.set(toast.id, timer);
  }, [removeToast]);

  // Chargement initial de la liste des conversations.
  useEffect(() => {
    if (!user?.email) {
      setConversations([]);
      setOnlineEmails(new Set());
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    axios
      .get('/api/messages/conversations')
      .then((response) => {
        if (cancelled) return;
        const data = response.data.data || [];
        setConversations(data);
        setOnlineEmails(new Set(
          data.filter((conversation) => conversation.online).map((conversation) => conversation.participant.email)
        ));
        setError(null);
      })
      .catch((requestError) => {
        if (!cancelled && requestError.response?.status !== 401) {
          setError('Impossible de charger les conversations.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  // Connexion temps réel : le jeton JWT est transmis dans la poignée de main
  // Socket.IO. Le serveur vérifie le compte, son statut et sa version de jeton.
  useEffect(() => {
    if (!user?.email) return undefined;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return undefined;

    const socket = io({
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 10000
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      refreshConversations();
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleConnectError = (socketError) => {
      setConnected(false);
      if (socketError?.message === 'unauthorized') {
        // Inutile de boucler : la session doit être renouvelée par la connexion.
        socket.disconnect();
      }
    };

    const handleMessage = (payload) => {
      const message = payload?.message;
      const conversationId = Number(payload?.conversationId);
      if (!message) return;

      refreshConversations();

      if (message.senderEmail === user.email) return;
      if (activeConversationRef.current === conversationId) return;

      pushToast({
        id: `message-${message.id}`,
        conversationId,
        title: message.senderNom || 'Nouveau message',
        body: previewOf(message.content),
        senderEmail: message.senderEmail
      });
    };

    const handleRefresh = () => {
      refreshConversations();
    };

    const handlePresence = (payload) => {
      if (!payload?.email) return;
      setOnlineEmails((previous) => {
        const next = new Set(previous);
        if (payload.online) next.add(payload.email);
        else next.delete(payload.email);
        return next;
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('message:new', handleMessage);
    socket.on('message:deleted', handleRefresh);
    socket.on('conversation:read', handleRefresh);
    socket.on('conversation:new', handleRefresh);
    socket.on('presence:update', handlePresence);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('message:new', handleMessage);
      socket.off('message:deleted', handleRefresh);
      socket.off('conversation:read', handleRefresh);
      socket.off('conversation:new', handleRefresh);
      socket.off('presence:update', handlePresence);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.email, refreshConversations, pushToast]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      await axios.post(`/api/messages/conversations/${conversationId}/read`);
      setConversations((previous) => previous.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )));
    } catch (requestError) {
      if (requestError.response?.status !== 401) {
        console.error('Marquage de la conversation comme lue impossible', requestError);
      }
    }
  }, []);

  const startConversation = useCallback(async (email) => {
    const response = await axios.post('/api/messages/conversations', { email });
    await refreshConversations();
    return response.data.data;
  }, [refreshConversations]);

  const isUserOnline = useCallback(
    (email) => onlineEmails.has(String(email || '').toLowerCase()),
    [onlineEmails]
  );

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + (Number(conversation.unreadCount) || 0), 0),
    [conversations]
  );

  const openToast = useCallback((toast) => {
    removeToast(toast.id);
    navigate(`/messages?conversation=${toast.conversationId}`);
  }, [navigate, removeToast]);

  const value = useMemo(() => ({
    conversations,
    loading,
    error,
    connected,
    unreadTotal,
    onlineEmails,
    isUserOnline,
    refreshConversations,
    markConversationRead,
    startConversation,
    setActiveConversationId,
    activeConversationId,
    socket: socketRef.current
  }), [
    conversations,
    loading,
    error,
    connected,
    unreadTotal,
    onlineEmails,
    isUserOnline,
    refreshConversations,
    markConversationRead,
    startConversation,
    activeConversationId
  ]);

  return (
    <MessagingContext.Provider value={value}>
      {children}

      <div className="fixed top-4 right-4 z-[100] w-[min(360px,calc(100vw-2rem))] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            role="status"
          >
            <button
              type="button"
              onClick={() => openToast(toast)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <Avatar nom={toast.title} email={toast.senderEmail} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <MessageCircle size={14} className="text-naatal-green" />
                  {toast.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-gray-600">{toast.body}</span>
                <span className="mt-1 block text-[11px] font-medium text-naatal-green">
                  Ouvrir la conversation
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="p-1 text-gray-400 hover:text-gray-700"
              aria-label="Fermer la notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging doit être utilisé dans un MessagingProvider');
  }
  return context;
};
