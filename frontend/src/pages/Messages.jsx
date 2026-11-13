import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronUp,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Wifi,
  WifiOff
} from 'lucide-react';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../context/MessagingContext';
import { roleLabel } from '../utils/roles';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const dayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(date) === dayKey(today)) return "Aujourd’hui";
  if (dayKey(date) === dayKey(yesterday)) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
};

const conversationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(date) === dayKey(today)) return formatTime(value);
  if (dayKey(date) === dayKey(yesterday)) return 'Hier';
  if (date.getFullYear() === today.getFullYear()) {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const lastMessagePreview = (conversation, currentEmail) => {
  if (!conversation.lastMessage) return 'Démarrez la conversation';
  if (conversation.lastMessage.isDeleted) return 'Message supprimé';
  const prefix = conversation.lastMessage.senderEmail === currentEmail ? 'Vous : ' : '';
  return `${prefix}${conversation.lastMessage.content || ''}`;
};

const Messages = () => {
  const { user } = useAuth();
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    connected,
    unreadTotal,
    isUserOnline,
    refreshConversations,
    markConversationRead,
    startConversation,
    setActiveConversationId,
    socket
  } = useMessaging();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId = Number(searchParams.get('conversation')) || null;

  const [messages, setMessages] = useState([]);
  const [conversationDetail, setConversationDetail] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [startingEmail, setStartingEmail] = useState(null);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const requestSequence = useRef(0);

  const selectedConversation = useMemo(() => {
    const fromList = conversations.find((conversation) => conversation.id === selectedId);
    if (fromList) return fromList;
    if (conversationDetail && conversationDetail.id === selectedId) return conversationDetail;
    return null;
  }, [conversations, conversationDetail, selectedId]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const isNearBottom = () => {
    const element = scrollRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 180;
  };

  const loadMessages = useCallback(async (conversationId, before = null) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    if (before) setLoadingMore(true);
    else setMessagesLoading(true);
    setMessagesError(null);

    try {
      const response = await axios.get(
        `/api/messages/conversations/${conversationId}/messages`,
        { params: before ? { before } : undefined }
      );
      if (requestSequence.current !== sequence) return null;

      const data = response.data.data || {};
      const page = data.messages || [];
      setMessages((previous) => (before ? [...page, ...previous] : page));
      setHasMore(Boolean(data.hasMore));
      if (data.conversation) setConversationDetail(data.conversation);
      return data;
    } catch (requestError) {
      if (requestSequence.current === sequence) {
        setMessagesError(
          requestError.response?.data?.message || 'Impossible de charger la conversation.'
        );
      }
      return null;
    } finally {
      if (requestSequence.current === sequence) {
        setMessagesLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    setActiveConversationId(selectedId);
    setMessages([]);
    setHasMore(false);
    setSendError(null);
    setMessagesError(null);
    setConversationDetail(null);
    requestSequence.current += 1;

    if (!selectedId) return;
    loadMessages(selectedId);
    markConversationRead(selectedId);
  }, [selectedId, loadMessages, markConversationRead, setActiveConversationId]);

  // Défilement automatique après le chargement initial ou un changement de
  // conversation. Les messages suivants défilent uniquement si l'utilisateur
  // est déjà en bas de la discussion.
  useEffect(() => {
    if (!selectedId || messagesLoading) return undefined;
    const timer = setTimeout(() => scrollToBottom('auto'), 40);
    return () => clearTimeout(timer);
  }, [selectedId, messagesLoading, scrollToBottom]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => {
    const handleFocus = () => {
      if (selectedId) markConversationRead(selectedId);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedId, markConversationRead]);

  // Événements de la conversation ouverte.
  useEffect(() => {
    if (!socket || !selectedId) return undefined;

    const handleNewMessage = (payload) => {
      const message = payload?.message;
      if (!message || Number(payload.conversationId) !== selectedId) return;

      const shouldScroll = isNearBottom() || message.senderEmail === user.email;
      setMessages((previous) => (
        previous.some((item) => item.id === message.id) ? previous : [...previous, message]
      ));

      if (message.senderEmail !== user.email) {
        markConversationRead(selectedId);
      }
      if (shouldScroll) {
        setTimeout(() => scrollToBottom('smooth'), 30);
      }
    };

    const handleDeleted = (payload) => {
      if (Number(payload?.conversationId) !== selectedId) return;
      setMessages((previous) => previous.map((message) => (
        message.id === Number(payload.messageId)
          ? { ...message, content: null, isDeleted: true }
          : message
      )));
    };

    const handleRead = (payload) => {
      if (Number(payload?.conversationId) !== selectedId) return;
      if (payload.readerEmail === user.email) return;
      setMessages((previous) => previous.map((message) => (
        message.senderEmail === user.email ? { ...message, lu: true } : message
      )));
    };

    const handleReconnect = () => {
      loadMessages(selectedId);
      refreshConversations();
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:deleted', handleDeleted);
    socket.on('conversation:read', handleRead);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:deleted', handleDeleted);
      socket.off('conversation:read', handleRead);
      socket.off('connect', handleReconnect);
    };
  }, [
    socket,
    selectedId,
    user?.email,
    loadMessages,
    markConversationRead,
    refreshConversations,
    scrollToBottom
  ]);

  // Recherche d'utilisateurs avec un court délai pour ne pas interroger l'API
  // à chaque frappe.
  useEffect(() => {
    if (!showSearch) return undefined;

    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      axios
        .get('/api/messages/users', { params: { q: term } })
        .then((response) => {
          if (!cancelled) setSearchResults(response.data.data || []);
        })
        .catch((requestError) => {
          if (!cancelled) {
            setSearchResults([]);
            setSearchError(requestError.response?.data?.message || 'Recherche impossible.');
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, showSearch]);

  const openConversation = (conversationId) => {
    navigate(`/messages?conversation=${conversationId}`);
  };

  const openSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setShowSearch(true);
  };

  const handleStartConversation = async (email) => {
    setStartingEmail(email);
    setSearchError(null);
    try {
      const conversation = await startConversation(email);
      setShowSearch(false);
      openConversation(conversation.id);
    } catch (requestError) {
      setSearchError(
        requestError.response?.data?.message || 'Impossible de démarrer cette conversation.'
      );
    } finally {
      setStartingEmail(null);
    }
  };

  const handleSend = async (event) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const response = await axios.post(
        `/api/messages/conversations/${selectedId}/messages`,
        { content }
      );
      const message = response.data.data;
      setMessages((previous) => (
        previous.some((item) => item.id === message.id) ? previous : [...previous, message]
      ));
      setDraft('');
      await refreshConversations();
      setTimeout(() => scrollToBottom('smooth'), 30);
    } catch (requestError) {
      setSendError(
        requestError.response?.data?.message || 'Le message n’a pas pu être envoyé.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return;
    event.preventDefault();
    handleSend(event);
  };

  const handleLoadOlder = async () => {
    if (!selectedId || !hasMore || loadingMore || messages.length === 0) return;
    const element = scrollRef.current;
    const previousHeight = element?.scrollHeight || 0;
    const previousTop = element?.scrollTop || 0;
    await loadMessages(selectedId, messages[0].id);
    requestAnimationFrame(() => {
      if (element) {
        element.scrollTop = element.scrollHeight - previousHeight + previousTop;
      }
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await axios.delete(`/api/messages/${deleteTarget.id}`);
      setMessages((previous) => previous.map((message) => (
        message.id === deleteTarget.id ? { ...message, content: null, isDeleted: true } : message
      )));
      setDeleteTarget(null);
      await refreshConversations();
    } catch (requestError) {
      setDeleteError(
        requestError.response?.data?.message || 'Impossible de supprimer ce message.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const participant = selectedConversation?.participant;
  const participantOnline = participant ? isUserOnline(participant.email) : false;
  const currentEmail = user?.email;

  return (
    <div className="h-[calc(100dvh-7.5rem)] min-h-[520px]">
      <div className="flex h-full overflow-hidden rounded-2xl border border-gray-200 bg-white card-shadow">
        <aside
          className={`${selectedId ? 'hidden lg:flex' : 'flex'} w-full flex-col border-r border-gray-200 lg:w-80 xl:w-96`}
        >
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
                <p className="text-xs text-gray-500">
                  {unreadTotal > 0
                    ? `${unreadTotal} message${unreadTotal > 1 ? 's' : ''} non lu${unreadTotal > 1 ? 's' : ''}`
                    : 'Vos échanges privés'}
                </p>
              </div>
              <button
                type="button"
                onClick={openSearch}
                className="inline-flex items-center gap-1.5 rounded-lg bg-naatal-green px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-naatal-green-dark"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              {connected ? (
                <>
                  <Wifi size={13} className="text-emerald-500" />
                  <span>Temps réel actif</span>
                </>
              ) : (
                <>
                  <WifiOff size={13} className="text-gray-400" />
                  <span>Reconnexion en cours…</span>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversationsLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 size={18} className="animate-spin" />
                Chargement…
              </div>
            )}

            {!conversationsLoading && conversationsError && (
              <div className="m-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {conversationsError}
              </div>
            )}

            {!conversationsLoading && !conversationsError && conversations.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-naatal-green-light">
                  <MessageSquare size={22} className="text-naatal-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Aucune conversation</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Recherchez un membre de NaataL pour commencer un échange privé.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openSearch}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-naatal-green px-3 py-2 text-sm font-medium text-naatal-green hover:bg-naatal-green-light"
                >
                  <UserPlus size={16} />
                  Nouvelle conversation
                </button>
              </div>
            )}

            {conversations.map((conversation) => {
              const online = isUserOnline(conversation.participant.email);
              const active = conversation.id === selectedId;
              const unread = Number(conversation.unreadCount) || 0;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation.id)}
                  className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors ${
                    active ? 'bg-naatal-green-light/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <Avatar
                    nom={conversation.participant.nom}
                    email={conversation.participant.email}
                    online={online}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {conversation.participant.nom}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {conversationTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${unread > 0 ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                        {lastMessagePreview(conversation, currentEmail)}
                      </span>
                      {unread > 0 && (
                        <span className="inline-flex min-w-[20px] shrink-0 items-center justify-center rounded-full bg-naatal-green px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-gray-400">
                      {roleLabel(conversation.participant.role)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
          {!selectedId && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-naatal-green-light">
                <MessageCircle size={30} className="text-naatal-green" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-800">Vos messages</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Sélectionnez une conversation ou recherchez un membre pour démarrer un échange privé.
                </p>
              </div>
              <button
                type="button"
                onClick={openSearch}
                className="inline-flex items-center gap-2 rounded-lg bg-naatal-green px-4 py-2.5 text-sm font-medium text-white hover:bg-naatal-green-dark"
              >
                <UserPlus size={16} />
                Envoyer un message
              </button>
            </div>
          )}

          {selectedId && (
            <>
              <div className="flex items-center gap-3 border-b border-gray-200 px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => navigate('/messages')}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
                  aria-label="Retour aux conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                {participant ? (
                  <>
                    <Avatar
                      nom={participant.nom}
                      email={participant.email}
                      online={participantOnline}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{participant.nom}</p>
                      <p className="truncate text-xs text-gray-500">
                        {participantOnline ? 'En ligne' : 'Hors ligne'}
                        <span className="hidden sm:inline"> · {participant.email}</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    Chargement de la conversation…
                  </div>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto bg-naatal-cream/50 px-3 py-4 sm:px-5">
                {hasMore && (
                  <div className="mb-3 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadOlder}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                      {loadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronUp size={13} />}
                      Charger les messages plus anciens
                    </button>
                  </div>
                )}

                {messagesLoading && (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
                    <Loader2 size={18} className="animate-spin" />
                    Chargement des messages…
                  </div>
                )}

                {!messagesLoading && messagesError && (
                  <div className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {messagesError}
                  </div>
                )}

                {!messagesLoading && !messagesError && messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <MessageCircle size={26} className="text-gray-300" />
                    <p className="text-sm text-gray-500">
                      Aucun message pour l’instant. Écrivez le premier message.
                    </p>
                  </div>
                )}

                {!messagesLoading && messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
                  const mine = message.senderEmail === currentEmail;

                  return (
                    <React.Fragment key={message.id}>
                      {showDay && (
                        <div className="my-4 flex items-center justify-center">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-gray-500 shadow-sm">
                            {dayLabel(message.createdAt)}
                          </span>
                        </div>
                      )}

                      <div className={`group mb-2 flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {!mine && (
                          <Avatar
                            nom={message.senderNom}
                            email={message.senderEmail}
                            size="xs"
                            className="mb-4"
                          />
                        )}

                        {mine && !message.isDeleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(message);
                            }}
                            className="mb-4 rounded p-1 text-gray-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                            title="Supprimer ce message"
                            aria-label="Supprimer ce message"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}

                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[72%] ${
                            mine
                              ? 'rounded-br-md bg-naatal-green text-white'
                              : 'rounded-bl-md border border-gray-200 bg-white text-gray-800'
                          }`}
                        >
                          {message.isDeleted ? (
                            <p className={`text-sm italic ${mine ? 'text-white/75' : 'text-gray-400'}`}>
                              Message supprimé
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {message.content}
                            </p>
                          )}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                              mine ? 'text-white/70' : 'text-gray-400'
                            }`}
                          >
                            <span>{formatTime(message.createdAt)}</span>
                            {mine && !message.isDeleted && (
                              <span className="inline-flex items-center gap-0.5">
                                {message.lu ? <CheckCheck size={13} /> : <Check size={13} />}
                                {message.lu ? 'Lu' : 'Envoyé'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="border-t border-gray-200 bg-white px-3 py-3 sm:px-4">
                {sendError && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {sendError}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    maxLength={4000}
                    placeholder="Écrivez votre message…"
                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-naatal-green focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-naatal-green text-white transition-colors hover:bg-naatal-green-dark disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Envoyer le message"
                    title="Envoyer (Entrée)"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Entrée pour envoyer · Maj + Entrée pour un retour à la ligne</span>
                  {draft.length > 3500 && <span>{draft.length}/4000</span>}
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      <Modal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        title="Nouvelle conversation"
        subtitle="Recherchez un membre par son nom ou son adresse email."
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nom ou email du membre…"
              autoFocus
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-naatal-green focus:bg-white"
            />
          </div>

          {searchError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {searchError}
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 size={17} className="animate-spin" />
              Recherche…
            </div>
          )}

          {!searching && searchTerm.trim().length < 2 && (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
              Saisissez au moins deux caractères pour rechercher un membre.
            </p>
          )}

          {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && !searchError && (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
              Aucun membre actif ne correspond à cette recherche.
            </p>
          )}

          {!searching && searchResults.length > 0 && (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              {searchResults.map((result) => (
                <li key={result.email}>
                  <button
                    type="button"
                    onClick={() => handleStartConversation(result.email)}
                    disabled={Boolean(startingEmail)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
                  >
                    <Avatar
                      nom={result.nom}
                      email={result.email}
                      online={isUserOnline(result.email)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{result.nom}</span>
                      <span className="block truncate text-xs text-gray-500">{result.email}</span>
                      <span className="block text-[11px] text-gray-400">{roleLabel(result.role)}</span>
                    </span>
                    {startingEmail === result.email ? (
                      <Loader2 size={17} className="animate-spin text-naatal-green" />
                    ) : (
                      <MessageCircle size={17} className="text-naatal-green" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        title="Supprimer ce message ?"
        subtitle="Le message sera remplacé par « Message supprimé » pour votre interlocuteur."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={deleting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Supprimer
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {deleteError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {deleteError}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Cette action est définitive. Seul l’auteur d’un message peut le supprimer.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Messages;
