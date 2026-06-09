import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock3,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Smile,
  User,
  UserCog,
  UserPlus,
  Image as ImageIcon,
  Loader,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';

const tagOptions = ['#ActiveLead', '#FollowUp'];
const TRIAL_EXPIRED_NOTICE = 'Your 7-day complementary trial period has expired. Please recharge your wallet balance under the billing view to activate YogiDesk AI features again.';

const fallbackAgent = { id: 'admin', name: 'Admin', role: 'Admin' };
const safeTags = (chat) => (Array.isArray(chat?.metadata?.tags) ? chat.metadata.tags : []);
const safeInitial = (value) => String(value || 'P').trim().charAt(0).toUpperCase() || 'P';
const sanitizeTextInput = (value) => String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trimStart();
const normalizeFilterText = (value) => sanitizeTextInput(value).toLowerCase().trim();
const normalizeDeliveryStatus = (status) => String(status || '').trim().toUpperCase();
const deliveryStatusRank = (status) => ({
  SENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
}[normalizeDeliveryStatus(status)] || 0);
const resolveDeliveryStatus = (...statuses) => statuses
  .map(normalizeDeliveryStatus)
  .filter(Boolean)
  .sort((a, b) => deliveryStatusRank(b) - deliveryStatusRank(a))[0] || '';
const normalizeMessageText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const mapStoredMessage = (item = {}) => ({
  id: item.id || item.created_at || `${Date.now()}-${Math.random()}`,
  meta_message_id: item.meta_message_id || item.metadata?.meta_message_id || '',
  message_id: item.message_id || item.metadata?.message_id || item.metadata?.meta_message_id || '',
  chat_id: item.chat_id || '',
  text: item.message_text || item.body || item.text || item.message_body || '',
  sender: item.sender || (item.sender_phone ? 'user' : 'user'),
  from_me: item.from_me ?? ['agent', 'doctor', 'bot'].includes(item.sender),
  type: item.type || item.message_type || (item.is_private_note ? 'private' : 'public'),
  is_private_note: Boolean(item.is_private_note),
  status: resolveDeliveryStatus(item.status, item.metadata?.delivery_status),
  metadata: item.metadata || {},
  created_at: item.created_at || '',
  time: item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : item.time || '',
});
const messageIdentity = (message = {}) => (
  message.meta_message_id ||
  message.message_id ||
  message.wamid ||
  message.metadata?.meta_message_id ||
  message.metadata?.message_id ||
  message.metadata?.wamid ||
  message.id ||
  ''
);
const isSameMessage = (left = {}, right = {}) => {
  const leftIdentity = messageIdentity(left);
  const rightIdentity = messageIdentity(right);
  if (leftIdentity && rightIdentity && String(leftIdentity) === String(rightIdentity)) return true;
  const leftText = normalizeMessageText(left.text || left.body || left.message_body);
  const rightText = normalizeMessageText(right.text || right.body || right.message_body);
  if (!leftText || leftText !== rightText) return false;
  const sameDirection = Boolean(left.from_me) === Boolean(right.from_me) || String(left.sender || '') === String(right.sender || '');
  const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
  const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
  return sameDirection && (!leftTime || !rightTime || Math.abs(leftTime - rightTime) < 120000);
};
const mergeMessageLists = (existing = [], incoming = []) => {
  const merged = [...existing];
  for (const next of incoming) {
    const matchIndex = merged.findIndex((item) => isSameMessage(item, next));
    if (matchIndex >= 0) {
      const previous = merged[matchIndex];
      merged[matchIndex] = {
        ...previous,
        ...next,
        id: messageIdentity(next) || previous.id,
        status: resolveDeliveryStatus(next.status, previous.status),
        metadata: { ...(previous.metadata || {}), ...(next.metadata || {}) },
      };
    } else {
      merged.push(next);
    }
  }
  return merged.sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0));
};
const logInboxError = (error) => {
  const message = error?.message || error?.details || String(error || '');
  if (error?.code === 'PGRST205' || String(message).toLowerCase().includes('schema cache')) {
    console.error('Supabase Inbox Logging Crash:', message);
    return;
  }
  console.error('Supabase Inbox Logging Error:', message);
};

class InboxRenderBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Inbox render failed.' };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Inbox render failed:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Inbox could not render</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="mt-5 rounded-xl bg-orange-600 px-5 py-2 text-sm font-bold text-white hover:bg-orange-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const InboxContent = () => {
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeAgent, setActiveAgent] = useState(fallbackAgent);
  const [agents, setAgents] = useState([fallbackAgent]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [reloadToken, setReloadToken] = useState(0);
  const [tagFilter, setTagFilter] = useState('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterDraft, setFilterDraft] = useState({
    search: '',
    lifecycle: 'ALL',
    duration: 'TODAY',
  });
  const [activeFilters, setActiveFilters] = useState({
    search: '',
    lifecycle: 'ALL',
    duration: 'TODAY',
  });
  const [customTagInput, setCustomTagInput] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [chatBg, setChatBg] = useState({ type: 'color', value: '#E5DDD5' });
  const [doctorAiPaused, setDoctorAiPaused] = useState(false);
  const [aiAccessLocked, setAiAccessLocked] = useState(false);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  const [aiToggleLoading, setAiToggleLoading] = useState(false);
  const bottomRef = useRef(null);
  const messagesViewportRef = useRef(null);
  const navigate = useNavigate();

  const selectedTags = useMemo(() => safeTags(selectedChat), [selectedChat]);
  const allTags = useMemo(() => {
    const tags = new Set(tagOptions);
    (Array.isArray(conversations) ? conversations : []).forEach((chat) => {
      safeTags(chat).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [conversations]);
  const visibleConversations = useMemo(() => {
    const rows = tagFilter === 'ALL'
      ? (Array.isArray(conversations) ? conversations : [])
      : (Array.isArray(conversations) ? conversations : []).filter((chat) => safeTags(chat).includes(tagFilter));
    const query = normalizeFilterText(activeFilters.search);
    const durationDays = { TODAY: 1, SEVEN_DAYS: 7, THIRTY_DAYS: 30 }[activeFilters.duration] || 1;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const oldestAllowed = activeFilters.duration === 'TODAY'
      ? todayStart.getTime()
      : Date.now() - durationDays * 24 * 60 * 60 * 1000;

    return rows.filter((chat) => {
      const haystack = normalizeFilterText([
        chat.name,
        chat.phone,
        chat.lastMsg,
        chat.status,
        ...safeTags(chat),
      ].join(' '));
      const updatedAt = new Date(chat.updated_at || chat.metadata?.updated_at || '').getTime();
      const matchesText = !query || haystack.includes(query);
      const matchesDuration = Number.isFinite(updatedAt) ? updatedAt >= oldestAllowed : activeFilters.duration !== 'TODAY';
      const status = String(chat.status || '').toUpperCase();
      const aiConverted = Boolean(chat.metadata?.ai_converted || chat.metadata?.converted_by_ai || chat.metadata?.ai_conversion_at);
      const archived = ['ARCHIVED', 'RESOLVED', 'CLOSED'].includes(status) || Boolean(chat.metadata?.archived_at || chat.metadata?.resolved_at);
      const matchesLifecycle = (
        activeFilters.lifecycle === 'ALL' ||
        (activeFilters.lifecycle === 'UNREAD' && Number(chat.unread || 0) > 0) ||
        (activeFilters.lifecycle === 'ACTIVE_AI' && (aiConverted || status === 'ACTIVE')) ||
        (activeFilters.lifecycle === 'ARCHIVED' && archived)
      );

      return matchesText && matchesDuration && matchesLifecycle;
    });
  }, [activeFilters, conversations, tagFilter]);
  const lastInboundAt = useMemo(() => {
    const metadataTime = selectedChat?.metadata?.last_customer_message_at || selectedChat?.metadata?.last_inbound_at;
    const metadataMs = metadataTime ? new Date(metadataTime).getTime() : 0;
    const messageMs = (Array.isArray(messages) ? messages : []).reduce((latest, item) => {
      if (item.from_me === true || item.sender === 'agent' || item.sender === 'doctor') return latest;
      const itemMs = item.created_at ? new Date(item.created_at).getTime() : 0;
      return Number.isFinite(itemMs) ? Math.max(latest, itemMs) : latest;
    }, 0);
    return Math.max(metadataMs, messageMs);
  }, [messages, selectedChat]);
  const lastTemplateSentAt = useMemo(() => {
    const messageMs = (Array.isArray(messages) ? messages : []).reduce((latest, item) => {
      const isOutbound = item.from_me === true || item.sender === 'agent' || item.sender === 'doctor';
      const isTemplate = item.type === 'template' || item.message_type === 'template' || item.metadata?.campaign_triggered || item.metadata?.bulk_broadcast;
      const itemMs = item.created_at ? new Date(item.created_at).getTime() : 0;
      return isOutbound && isTemplate && Number.isFinite(itemMs) ? Math.max(latest, itemMs) : latest;
    }, 0);
    const metadataTime = selectedChat?.metadata?.last_template?.sent_at || selectedChat?.metadata?.last_template_sent_at;
    const metadataMs = metadataTime ? new Date(metadataTime).getTime() : 0;
    return Math.max(messageMs, metadataMs);
  }, [messages, selectedChat]);
  const isReplyWindowOpen = Boolean(
    lastInboundAt &&
    Date.now() - lastInboundAt <= 24 * 60 * 60 * 1000 &&
    (!lastTemplateSentAt || lastInboundAt > lastTemplateSentAt)
  );
  const canUseComposer = isPrivateNote || isReplyWindowOpen;

  const getUser = useCallback(async () => {
    const storedUserId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    const { data } = await supabase.auth.getUser();    
    return { ...(data?.user || {}), id: storedUserId || data?.user?.id || '' };
  }, []);

  const loadAiSettings = useCallback(async () => {
    try {
      const user = await getUser();
      if (!user?.id) return;
      const response = await api.get('/api/ai/settings', { params: { userId: user.id } });
      if (response.data?.success) {
        const settings = response.data.settings || {};
        const locked = Boolean(settings.has_trial_expired || settings.is_trial_expired || String(settings.runtime_plan || settings.plan_tier || settings.plan || '').toLowerCase() === 'basic');
        setDoctorAiPaused(Boolean(settings.isAiPaused));
        setAiAccessLocked(locked);
        if (locked) setShowTrialExpiredModal(true);
      }
    } catch (error) {
      logInboxError(error);
    }
  }, [getUser]);

  const loadInbox = useCallback(async () => {
    const user = await getUser();
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let teamData = [];
    let chatData = [];
    let loadedFromApi = false;

    try {
      const response = await api.get('/api/inbox/chats', { params: { userId: user.id } });
      if (response.data?.success) {
        teamData = response.data.teamMembers || [];
        chatData = response.data.chats || [];
        loadedFromApi = true;
      }
    } catch (error) {
      logInboxError(error);
    }

    if (!loadedFromApi) {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('id, name, email, status')
          .eq('admin_id', user.id)
          .in('status', ['ACTIVE', 'INVITED']);
        if (error) throw error;
        teamData = data || [];
      } catch (error) {
        logInboxError(error);
      }
    }

    try {
      if (loadedFromApi) throw new Error('__INBOX_API_LOADED__');
      let result = await supabase
        .from('inbox_chats')
        .select('id, user_id, doctor_id, name, last_message, updated_at, phone, patient_phone, status, unread_count, patient_name, scheduled_at, assigned_agent_id, metadata')
        .or(`user_id.eq.${user.id},doctor_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (result.error) {
        const safeResult = await supabase
          .from('inbox_chats')
          .select('id, name, last_message, updated_at, phone, patient_phone, status, unread_count, patient_name, scheduled_at')
          .or(`user_id.eq.${user.id},doctor_id.eq.${user.id}`)
          .order('updated_at', { ascending: false });
        result = safeResult;
      }

      if (result.error) {
        const unfilteredResult = await supabase
          .from('inbox_chats')
          .select('id, name, last_message, updated_at, phone, patient_phone, status, unread_count, patient_name, scheduled_at, metadata')
          .order('updated_at', { ascending: false });
        result = unfilteredResult;
      }

      if (result.error) throw result.error;
      chatData = result.data || [];

      if (chatData.length === 0) {
        let messageResult = await supabase
          .from('inbox_messages')
          .select('chat_id, message_text, message_body, body, text, sender, from_me, type, message_type, receiver_phone, sender_phone, workspace_id, sender_id, status, metadata, created_at')
          .eq('workspace_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (messageResult.error || !messageResult.data?.length) {
          messageResult = await supabase
            .from('inbox_messages')
            .select('chat_id, message_text, message_body, body, text, sender, from_me, type, message_type, receiver_phone, sender_phone, workspace_id, sender_id, status, metadata, created_at')
            .eq('sender_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        }

        if (messageResult.error) {
          messageResult = await supabase
            .from('inbox_messages')
            .select('chat_id, message_body, body, text, sender, from_me, type, receiver_phone, sender_phone, workspace_id, status, metadata, created_at')
            .eq('workspace_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        }

        if (!messageResult.error && Array.isArray(messageResult.data)) {
          const fallbackChats = new Map();
          messageResult.data.forEach((item) => {
            const phone = item.receiver_phone || item.sender_phone || '';
            const key = item.chat_id || phone || item.created_at;
            if (fallbackChats.has(key)) return;
            fallbackChats.set(key, {
              id: item.chat_id || `message-${key}`,
              name: phone || 'Patient',
              patient_name: phone || 'Patient',
              phone,
              last_message: item.message_text || item.message_body || item.body || item.text || '',
              updated_at: item.created_at,
              status: item.status || item.metadata?.delivery_status || 'SENT',
              unread_count: 0,
              metadata: { messages: [item], source_chat_id: item.chat_id || null },
            });
          });
          chatData = Array.from(fallbackChats.values());
        }
      }
    } catch (error) {
      if (error?.message !== '__INBOX_API_LOADED__') logInboxError(error);
    }

    const mappedAgents = Array.isArray(teamData) && teamData.length
      ? teamData.map((agent) => ({
        id: agent.id,
        name: agent.name || agent.email,
        role: 'STAFF',
      }))
      : [fallbackAgent];

    const mappedChats = Array.isArray(chatData)
      ? chatData.map((chat) => {
        const displayName = chat.name || chat.patient_name || 'Unknown Patient';
        const currentAgent = chat?.assigned_agent_id || null;
        const count = Number(chat.unread_count || 0);
        return {
          id: chat.id,
          name: displayName,
          phone: chat?.phone || chat?.patient_phone || '',
          lastMsg: chat.last_message || '',
          time: chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          updated_at: chat.updated_at || '',
          unread: count,
          status: chat.status || 'Offline',
          deliveryStatus: resolveDeliveryStatus(chat.metadata?.delivery_status, chat.metadata?.last_template?.delivery_status, chat.status),
          scheduled_at: chat.scheduled_at || null,
          assigned_agent_id: currentAgent,
          metadata: chat?.metadata || {},
        };
      })
      : [];

    setAgents(mappedAgents);
    setActiveAgent(mappedAgents[0]);
    setConversations(mappedChats);
    setSelectedChat((current) => {
      if (!current?.id) return current;
      return mappedChats.find((chat) => chat.id === current.id) || current;
    });
    setLoading(false);
  }, [getUser]);

  const loadMessages = useCallback(async (chat) => {
    const storedMessages = Array.isArray(chat?.metadata?.messages) ? chat.metadata.messages : [];
    if (!chat?.id || String(chat.id).startsWith('message-')) {
      setMessages(storedMessages.map(mapStoredMessage));
      return;
    }
    const user = await getUser();
    try {
      const apiResult = await api.get('/api/inbox/messages', { params: { userId: user.id, chatId: chat.id } });
      if (apiResult.data?.success) {
        const apiMessages = (apiResult.data.messages || []).map(mapStoredMessage);
        setMessages((prev) => mergeMessageLists(prev.filter((item) => item.chat_id === chat.id || normalizeDeliveryStatus(item.status) === 'SENDING'), apiMessages));
        return;
      }
    } catch (error) {
      logInboxError(error);
    }

    try {
      let result = await supabase
        .from('inbox_messages')
        .select('id, chat_id, meta_message_id, message_id, body, text, message_body, message_text, sender, from_me, type, is_private_note, status, metadata, created_at')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

      if (result.error) {
        result = await supabase
          .from('inbox_messages')
          .select('id, chat_id, meta_message_id, message_id, body, text, message_body, sender, from_me, status, created_at')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: true });
      }

      if (result.error) throw result.error;
      if (Array.isArray(result.data) && result.data.length > 0) {
        const dbMessages = result.data.map(mapStoredMessage);
        setMessages((prev) => mergeMessageLists(prev.filter((item) => item.chat_id === chat.id || normalizeDeliveryStatus(item.status) === 'SENDING'), dbMessages));
      }
    } catch (error) {
      logInboxError(error);
    }
  }, [getUser]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      let shouldRefresh = false;
      setConversations((prev) => prev.map((chat) => {
        if (String(chat.status || '').toUpperCase() !== 'QUEUED') return chat;
        const target = new Date(chat.scheduled_at || '').getTime();
        if (Number.isFinite(target) && target <= current) {
          shouldRefresh = true;
          return { ...chat, status: 'SENT', lastMsg: 'Sent' };
        }
        return chat;
      }));
      if (shouldRefresh) window.setTimeout(() => setReloadToken((value) => value + 1), 0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatCountdown = (scheduledAt) => {
    const target = new Date(scheduledAt || '').getTime();
    if (!Number.isFinite(target)) return 'Sending...';
    const remainingMs = target - now;
    if (remainingMs <= 0) return 'Sending...';
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `Sending in ${minutes}:${seconds}`;
  };

  const renderStatusBadge = (status) => {
    const normalized = normalizeDeliveryStatus(status);
    if (normalized === 'SENDING') return <Loader size={12} className="animate-spin text-slate-400" />;
    if (normalized === 'SENT') return <Check size={13} className="text-slate-400" />;
    if (normalized === 'DELIVERED') return <CheckCheck size={14} className="text-slate-400" />;
    if (normalized === 'READ') return <CheckCheck size={14} className="text-sky-400" style={{ color: '#34B7F1' }} />;
    if (normalized === 'FAILED') return <AlertCircle size={13} className="text-rose-500" />;
    return null;
  };

  const updateFilterDraft = (key, value) => {
    setFilterDraft((current) => ({
      ...current,
      [key]: key === 'search' ? sanitizeTextInput(value) : value,
    }));
  };

  const openFilterModal = () => {
    setFilterDraft(activeFilters);
    setShowFilterModal(true);
  };

  const applyFilterDraft = () => {
    setActiveFilters((current) => ({
      ...current,
      ...filterDraft,
      search: sanitizeTextInput(filterDraft.search).trim(),
    }));
    setShowFilterModal(false);
  };

  useEffect(() => {
    loadInbox();
  }, [loadInbox, reloadToken]);

  useEffect(() => {
    loadAiSettings();
  }, [loadAiSettings]);

  const messagesScrollKey = useMemo(() => (
    (Array.isArray(messages) ? messages : [])
      .map((item) => `${messageIdentity(item)}:${item.status || ''}`)
      .join('|')
  ), [messages]);

  useLayoutEffect(() => {
    const scrollToBottom = (behavior = 'auto') => {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight;
      }
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    };
    scrollToBottom('auto');
    const frame = window.requestAnimationFrame(() => scrollToBottom('smooth'));
    return () => window.cancelAnimationFrame(frame);
  }, [messagesScrollKey, selectedChat?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReloadToken((value) => value + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inbox_messages' }, (payload) => {
        const updatedMessage = payload.new || {};
        const nextStatus = String(updatedMessage.status || updatedMessage.metadata?.delivery_status || '').toUpperCase();
        if (!['READ', 'DELIVERED'].includes(nextStatus)) return;

        const nextMetaMessageId = updatedMessage.meta_message_id || updatedMessage.metadata?.meta_message_id || '';
        const nextMessageId = updatedMessage.message_id || updatedMessage.metadata?.message_id || nextMetaMessageId;

        setMessages((prev) => mergeMessageLists(prev, [{
          ...mapStoredMessage(updatedMessage),
          status: nextStatus,
          meta_message_id: nextMetaMessageId,
          message_id: nextMessageId,
        }]));

        if (updatedMessage.chat_id) {
          setConversations((prev) => prev.map((chat) => (
            chat.id === updatedMessage.chat_id ? { ...chat, deliveryStatus: nextStatus } : chat
          )));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let channel;
    let active = true;

    getUser().then((user) => {      
      if (!active || !user?.id) return;
      channel = supabase
        .channel(`inbox-live-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_chats' }, () => {
          setReloadToken((value) => value + 1);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'inbox_messages',
          filter: `workspace_id=eq.${user.id}`,
        }, (payload) => {
          const nextRow = payload.new || {};
          const mappedMessage = mapStoredMessage(nextRow);
          setReloadToken((value) => value + 1);

          if (selectedChat?.id && String(nextRow.chat_id || '') === String(selectedChat.id)) {
            setMessages((prev) => mergeMessageLists(prev, [mappedMessage]));

            if (nextRow.sender === 'bot' || nextRow.metadata?.dialogflow_reply || nextRow.metadata?.outbound) {
              setConversations((prev) => prev.map((chat) => (
                chat.id === selectedChat.id
                  ? { ...chat, lastMsg: mappedMessage.text || chat.lastMsg, deliveryStatus: mappedMessage.status || chat.deliveryStatus }
                  : chat
              )));
            }
          }
        })
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedChat, loadMessages]);

  useEffect(() => {
    if (!selectedChat?.id) return undefined;
    const timer = window.setInterval(() => {
      loadMessages(selectedChat);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedChat, loadMessages]);

  const updateConversation = (chatId, patch) => {
    setConversations((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat)));
    setSelectedChat((prev) => (prev?.id === chatId ? { ...prev, ...patch } : prev));
  };

  const handleAssignAgent = async (agentId) => {
    const agent = agents.find((item) => String(item.id) === String(agentId));
    if (!agent || !selectedChat) return;
    setActiveAgent(agent);
    updateConversation(selectedChat.id, { assigned_agent_id: agent.id });
    try {
      const { error } = await supabase.from('inbox_chats').update({ assigned_agent_id: agent.id }).eq('id', selectedChat.id);
      if (error) throw error;
    } catch (error) {
      logInboxError(error);
    }
  };

  const handleToggleAiMode = async () => {
    if (!selectedChat || aiToggleLoading) return;
    if (aiAccessLocked) {
      setShowTrialExpiredModal(true);
      return;
    }
    const nextPaused = !(selectedChat.metadata?.ai_paused ?? doctorAiPaused);
    const nextMetadata = { ...(selectedChat.metadata || {}), ai_paused: nextPaused };

    setAiToggleLoading(true);
    setDoctorAiPaused(nextPaused);
    updateConversation(selectedChat.id, { metadata: nextMetadata });

    try {
      const user = await getUser();
      const response = await api.post('/api/chat/toggle-ai', {
        userId: user.id,
        chatId: selectedChat.id,
        isAiPaused: nextPaused,
      });
      const confirmedPaused = Boolean(response.data?.isAiPaused);
      const confirmedMetadata = { ...(selectedChat.metadata || {}), ai_paused: confirmedPaused };
      setDoctorAiPaused(confirmedPaused);
      updateConversation(selectedChat.id, { metadata: confirmedMetadata });
    } catch (error) {
      const revertedPaused = !nextPaused;
      setDoctorAiPaused(revertedPaused);
      updateConversation(selectedChat.id, { metadata: { ...(selectedChat.metadata || {}), ai_paused: revertedPaused } });
      logInboxError(error);
    } finally {
      setAiToggleLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const text = message.trim();
    if (!text || !selectedChat) return;
    if (aiAccessLocked) {
      setShowTrialExpiredModal(true);
      return;
    }
    if (!canUseComposer) {
      navigate('/campaigns');
      return;
    }

    const tempId = `tmp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const created = {
      id: tempId,
      chat_id: selectedChat.id,
      text,
      sender: 'agent',
      from_me: true,
      type: isPrivateNote ? 'private' : 'public',
      is_private_note: isPrivateNote,
      status: isPrivateNote ? 'SENT' : 'SENDING',
      created_at: nowIso,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      metadata: { optimistic: true, temp_id: tempId },
    };

    setMessages((prev) => mergeMessageLists(prev, [created]));
    setMessage('');
    updateConversation(selectedChat.id, { lastMsg: isPrivateNote ? selectedChat.lastMsg : text, deliveryStatus: created.status });

    try {
      if (!isPrivateNote) {
        const user = await getUser();
        const response = await api.post('/api/inbox/send-message', {
          userId: user.id,
          chatId: selectedChat.id,
          messageText: text,
          patientPhone: selectedChat.phone || selectedChat.patient_phone || '',
        });

        const confirmedMessage = mapStoredMessage(response.data?.storedMessage || {
          ...created,
          id: response.data?.wamid || tempId,
          wamid: response.data?.wamid,
          message_id: response.data?.wamid,
          meta_message_id: response.data?.wamid,
          status: 'SENT',
        });

        setMessages((prev) => mergeMessageLists(prev.filter((item) => item.id !== tempId), [{ ...confirmedMessage, status: confirmedMessage.status || 'SENT' }]));
        updateConversation(selectedChat.id, { lastMsg: text, deliveryStatus: confirmedMessage.status || 'SENT' });
        return;
      }

      const storedMessage = {
        id: created.id,
        body: text,
        sender: 'agent',
        from_me: true,
        type: created.type,
        is_private_note: isPrivateNote,
        created_at: new Date().toISOString(),
      };
      const metadata = {
        ...(selectedChat.metadata || {}),
        messages: [...(selectedChat.metadata?.messages || []), storedMessage],
      };
      const { error } = await supabase
        .from('inbox_chats')
        .update({
          metadata,
          last_message: isPrivateNote ? selectedChat.lastMsg : text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChat.id);
      if (error) throw error;
      updateConversation(selectedChat.id, {
        metadata,
        ...(isPrivateNote ? {} : { lastMsg: text }),
      });
    } catch (error) {
      setMessages((prev) => prev.map((item) => (
        item.id === tempId
          ? { ...item, status: 'FAILED', metadata: { ...(item.metadata || {}), send_error: error?.response?.data?.message || error.message || 'Send failed' } }
          : item
      )));
      updateConversation(selectedChat.id, { deliveryStatus: 'FAILED' });
      logInboxError(error);
    }
  };

  const appendTag = async (tag) => {
    if (!selectedChat || selectedTags.includes(tag)) return;
    const metadata = { ...(selectedChat.metadata || {}), tags: [...selectedTags, tag] };
    updateConversation(selectedChat.id, { metadata });
    try {
      const { error } = await supabase.from('inbox_chats').update({ metadata }).eq('id', selectedChat.id);
      if (error) throw error;
    } catch (error) {
      logInboxError(error);
    }
  };

  const addCustomTag = () => {
    const tag = sanitizeTextInput(customTagInput).trim();
    if (!tag) return;
    appendTag(tag.startsWith('#') ? tag : `#${tag}`);
    setCustomTagInput('');
  };

  const loadChatBackground = (chatId) => {
    try {
      const stored = JSON.parse(localStorage.getItem(`yogi_chat_wallpaper_${chatId}`) || 'null');
      setChatBg(stored || { type: 'color', value: '#E5DDD5' });
    } catch {
      setChatBg({ type: 'color', value: '#E5DDD5' });
    }
  };

  const saveChatBackground = (nextBg) => {
    if (!selectedChat?.id) return;
    setChatBg(nextBg);
    localStorage.setItem(`yogi_chat_wallpaper_${selectedChat.id}`, JSON.stringify(nextBg));
    setShowBgMenu(false);
  };

  const handleBackgroundUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => saveChatBackground({ type: 'image', value: reader.result });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const openChat = (chat) => {
    setSelectedChat(chat);
    setShowPhone(false);
    setShowBgMenu(false);
    setShowDetailsPanel(false);
    const agent = agents.find((item) => String(item.id) === String(chat?.assigned_agent_id)) || agents[0];
    setActiveAgent(agent);
    loadChatBackground(chat.id);
    loadMessages(chat);
  };

  const isAiPausedForSelectedChat = aiAccessLocked || Boolean(selectedChat?.metadata?.ai_paused ?? doctorAiPaused);

  const chatViewportStyle = chatBg.type === 'image'
    ? { backgroundImage: `url(${chatBg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: chatBg.value || '#E5DDD5' };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F2F5] font-sans">
      {showTrialExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-600">Trial Expired</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">AI features are locked</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTrialExpiredModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="Close trial expired notice"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{TRIAL_EXPIRED_NOTICE}</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/wallet')}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-orange-700"
            >
              Open Billing
            </button>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] transition-all duration-300 ease-out">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-[#501638] px-6 py-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FFD701]">Secure Inbox Gate</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">Filter Conversations</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                aria-label="Close filter conversations"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[220px_1fr]">
              <div className="border-b border-slate-100 bg-slate-50 p-5 md:border-b-0 md:border-r">
                {['Search', 'Chat Status', 'Duration'].map((item) => (
                  <div key={item} className="rounded-xl px-3 py-3 text-xs font-black uppercase tracking-widest text-slate-500">
                    {item}
                  </div>
                ))}
              </div>

              <div className="space-y-6 p-6">
                <div>
                  <label htmlFor="inbox-filter-search" className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Explicit Text Search
                  </label>
                  <div className="relative mt-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      id="inbox-filter-search"
                      type="text"
                      value={filterDraft.search}
                      onChange={(event) => updateFilterDraft('search', event.target.value)}
                      placeholder="Search patient name, phone, tag, or message..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#FFD701] focus:ring-4 focus:ring-[#FFD701]/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="inbox-filter-lifecycle" className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Chat Lifecycle Status
                  </label>
                  <select
                    id="inbox-filter-lifecycle"
                    value={filterDraft.lifecycle}
                    onChange={(event) => updateFilterDraft('lifecycle', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition-all focus:border-[#FFD701] focus:ring-4 focus:ring-[#FFD701]/20"
                  >
                    <option value="ALL">All Incoming Queries</option>
                    <option value="UNREAD">🔴 Unread / Action Needed</option>
                    <option value="ACTIVE_AI">🟢 Active AI Converted</option>
                    <option value="ARCHIVED">📁 Archived / Resolved Cases</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="inbox-filter-duration" className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Time Duration Window
                  </label>
                  <select
                    id="inbox-filter-duration"
                    value={filterDraft.duration}
                    onChange={(event) => updateFilterDraft('duration', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition-all focus:border-[#FFD701] focus:ring-4 focus:ring-[#FFD701]/20"
                  >
                    <option value="TODAY">Today's Activity Logs</option>
                    <option value="SEVEN_DAYS">Past 7 Days Logs</option>
                    <option value="THIRTY_DAYS">Past 30 Days Records</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setFilterDraft({ search: '', lifecycle: 'ALL', duration: 'TODAY' })}
                  className="text-[10px] font-black uppercase tracking-[0.22em] text-[#501638] transition-all hover:text-[#7b2456] active:scale-95"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyFilterDraft}
                className="rounded-xl bg-[#FFD701] px-6 py-3 text-xs font-black uppercase tracking-widest text-[#501638] shadow-lg shadow-yellow-200/70 transition-all hover:brightness-95 active:scale-95"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-80 flex-col border-r border-slate-200 bg-white lg:w-96">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-black tracking-tight text-slate-800">Inbox</h1>
            <div className="flex gap-2">
              <button className="rounded-full p-2 text-slate-400 hover:bg-slate-50"><UserPlus size={18} /></button>
              <button className="rounded-full p-2 text-slate-400 hover:bg-slate-50"><MoreVertical size={18} /></button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={activeFilters.search}
              onChange={(event) => setActiveFilters((current) => ({ ...current, search: sanitizeTextInput(event.target.value) }))}
              placeholder="Search chats..."
              className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 pr-12 text-sm font-semibold outline-none transition-all focus:border-[#FFD701] focus:bg-white focus:ring-2 focus:ring-[#FFD701]/20"
            />
            <button
              type="button"
              onClick={openFilterModal}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white hover:text-[#501638] active:scale-95"
              aria-label="Open inbound chat filters"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
          {loading && (
            <div className="flex items-center justify-center py-4 text-sm font-semibold text-slate-400">
              <Loader size={16} className="mr-2 animate-spin" />
              Loading conversations...
            </div>
          )}
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="mt-3 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 outline-none"
          >
            <option value="ALL">All tags</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {!loading && conversations.length === 0 && (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm font-semibold text-slate-400">
              Your inbox is empty. Waiting for new patient chats...
            </div>
          )}
          {!loading && conversations.length > 0 && visibleConversations.length === 0 && (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm font-semibold text-slate-400">
              No conversations match the active filters.
            </div>
          )}
          {visibleConversations.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => openChat(chat)}
              className={`flex w-full cursor-pointer items-center gap-4 border-b border-slate-50 p-4 text-left transition-all hover:bg-slate-50 ${selectedChat?.id === chat.id ? 'border-r-4 border-r-blue-500 bg-blue-50/50' : ''}`}
            >
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <User size={24} />
                <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${chat.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-bold text-slate-800">{sanitizeTextInput(chat.name)}</h3>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-400">
                    {chat.time}
                    {renderStatusBadge(chat.deliveryStatus || chat.metadata?.delivery_status || chat.metadata?.last_template?.delivery_status)}
                  </span>
                </div>
                {String(chat.status || '').toUpperCase() === 'QUEUED' ? (
                  <p className="inline-flex max-w-full items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-orange-600">
                    <Clock3 size={12} />
                    {formatCountdown(chat.scheduled_at)}
                  </p>
                ) : (
                  <p className="truncate text-xs text-slate-500">{sanitizeTextInput(chat.lastMsg)}</p>
                )}
              </div>
              {chat.unread > 0 && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{chat.unread}</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col" style={chatViewportStyle}>
        {selectedChat ? (
          <>
            <div className="z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">{safeInitial(selectedChat?.name)}</div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">{selectedChat?.name || 'Patient'}</h2>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Official Business</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">Owner:</span>
                  <select value={activeAgent?.id || ''} onChange={(event) => handleAssignAgent(event.target.value)} className="cursor-pointer bg-transparent text-[11px] font-bold outline-none">
                    {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} ({agent.role})</option>)}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAiMode}
                  disabled={aiToggleLoading || aiAccessLocked}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black transition-all disabled:opacity-60 ${isAiPausedForSelectedChat ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}
                  title={aiAccessLocked ? 'Recharge wallet balance to reactivate YogiDesk AI' : isAiPausedForSelectedChat ? 'Resume Gemini assistant replies' : 'Pause AI for human takeover'}
                >
                  {isAiPausedForSelectedChat ? <UserCog size={14} /> : <Bot size={14} />}
                  {aiAccessLocked ? 'AI Locked' : isAiPausedForSelectedChat ? 'Human Mode (AI Paused)' : 'AI Assistant: ACTIVE'}
                </button>

                <button
                  onClick={() => setIsGhostMode(!isGhostMode)}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${isGhostMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'}`}
                >
                  {isGhostMode ? <Eye size={14} /> : <EyeOff size={14} />}
                  {isGhostMode ? 'Ghost Mode ON' : 'Spy Mode'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailsPanel(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="Open chat details"
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>

            <div ref={messagesViewportRef} className="custom-scrollbar relative flex-1 space-y-4 overflow-y-auto p-6">
              {messages.length === 0 && (
                <div className="rounded-2xl bg-white/70 p-6 text-center text-sm font-semibold text-slate-500">
                  No messages in this chat yet.
                </div>
              )}
              {(Array.isArray(messages) ? messages : []).map((msg) => {
                const isSentByMe = msg.from_me === true || msg.sender === 'doctor';
                const messageText = sanitizeTextInput(msg.text || msg.body || msg.message_body || "Template Dispatched");
                
                return (
                <div key={msg.id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`relative z-10 max-w-[70%] rounded-2xl p-3 shadow-sm ${msg.is_private_note || msg.type === 'private' ? 'rounded-br-none border-2 border-yellow-200 bg-yellow-50 text-yellow-900' : isSentByMe ? 'rounded-br-none bg-[#D9FDD3] text-slate-800' : 'rounded-bl-none bg-white text-slate-800'}`}>
                    {(msg.is_private_note || msg.type === 'private') && (
                      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-yellow-600">
                        <Lock size={10} /> Private Note
                      </div>
                    )}
                    <p className="text-[13.5px] font-medium leading-relaxed">{messageText}</p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <span className="text-[9px] font-medium opacity-60">{msg.time}</span>
                      {isSentByMe && !(msg.is_private_note || msg.type === 'private') && (renderStatusBadge(msg.status || msg.metadata?.delivery_status) || <Check size={12} className="text-slate-400" />)}
                    </div>
                  </div>
                </div>
                );
              })}
              <div ref={bottomRef} aria-hidden="true" />
            </div>

            {isGhostMode && (
              <div className="absolute bottom-24 left-1/2 z-30 flex -translate-x-1/2 animate-pulse items-center gap-2 rounded-full bg-orange-600/90 px-6 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl backdrop-blur-md">
                <ShieldAlert size={16} /> Viewing in Ghost Mode
              </div>
            )}

            <div className="z-20 border-t border-slate-200 bg-white p-4">
              <div className="mx-auto max-w-[900px] space-y-3">
                {!isGhostMode && (
                  <div className="mb-2 flex gap-2">
                    <button disabled={aiAccessLocked} onClick={() => setIsPrivateNote(false)} className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50 ${!isPrivateNote ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                      <MessageSquare size={12} className="mr-1.5 inline" /> Customer Reply
                    </button>
                    <button disabled={aiAccessLocked} onClick={() => setIsPrivateNote(true)} className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isPrivateNote ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                      <Lock size={12} className="mr-1.5 inline" /> Private Note
                    </button>
                  </div>
                )}

                {aiAccessLocked ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <AlertCircle size={20} className="mt-0.5 shrink-0 text-orange-600" />
                      <div>
                        <p className="text-sm font-black text-slate-800">YogiDesk AI features are locked</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{TRIAL_EXPIRED_NOTICE}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/wallet')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:bg-orange-700"
                    >
                      Open Billing
                    </button>
                  </div>
                ) : !canUseComposer && !isGhostMode ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-800">Customer reply window is closed</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Send an approved template first. Free-form chat opens after the patient replies.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/campaigns')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:bg-green-700"
                    >
                      <Send size={16} />
                      Send Template
                    </button>
                  </div>
                ) : (
                  <div className={`flex items-center gap-3 rounded-2xl border p-2 transition-all ${isPrivateNote ? 'border-yellow-300 bg-yellow-50 ring-2 ring-yellow-100' : 'border-slate-100 bg-slate-50'}`}>
                    <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Smile size={20} /></button>
                    <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Paperclip size={20} /></button>
                    <input
                      type="text"
                      placeholder={isGhostMode ? 'Ghost mode active: typing disabled' : (isPrivateNote ? 'Type a private team note...' : 'Reply to customer...')}
                      disabled={isGhostMode || aiAccessLocked}
                      className={`flex-1 border-none bg-transparent py-2 text-sm font-medium outline-none ${isPrivateNote ? 'text-yellow-900 placeholder:text-yellow-500' : 'text-slate-700'}`}
                      value={message}
                      onChange={(event) => setMessage(sanitizeTextInput(event.target.value))}
                      onKeyDown={(event) => event.key === 'Enter' && handleSendMessage()}
                    />
                    {!isGhostMode && (
                      <button onClick={handleSendMessage} className={`rounded-xl p-3 shadow-lg transition-all ${isPrivateNote ? 'bg-yellow-400 text-yellow-900' : 'bg-green-500 text-white shadow-green-100 hover:bg-green-600'}`}>
                        <Send size={20} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-8 text-center">
            <div className="w-full max-w-3xl space-y-10 animate-in fade-in zoom-in-95 duration-500">
              
              {/* HERO BLOCK */}
              <div className="flex flex-col items-center justify-center space-y-4">
                {/* Premium Icon Container */}
                <div className="relative mb-2">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-200 opacity-20 blur-xl animate-pulse"></div>
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100/50 ring-1 ring-blue-200/50 shadow-lg">
                    <div className="absolute inset-0 rounded-full border border-blue-200/30 animate-spin opacity-20" style={{ animation: 'spin 20s linear infinite' }}></div>
                    <MessageSquare size={40} className="text-blue-600" strokeWidth={1.5} />
                  </div>
                </div>
                
                {/* Heading */}
                <div className="space-y-2.5">
                  <h3 className="text-3xl font-black tracking-tight text-slate-900">Welcome to Yogi Desk Live Inbox</h3>
                  <p className="mx-auto max-w-xl text-base font-semibold leading-relaxed text-slate-600">
                    Select a conversation from the sidebar to view full patient history, reply instantly, or manage message templates.
                  </p>
                </div>
              </div>

              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {/* Card A: Unread Chats */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-orange-200/50 hover:bg-white">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <div className="relative space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 ring-1 ring-orange-200/30">
                      <MessageSquare size={24} className="text-orange-600" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-4xl font-black text-slate-900">{conversations.filter(c => c.unread > 0).length}</p>
                      <p className="mt-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Unread Chats</p>
                    </div>
                  </div>
                </div>

                {/* Card B: Open 24h Windows */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-green-200/50 hover:bg-white">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <div className="relative space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 ring-1 ring-green-200/30">
                      <Clock3 size={24} className="text-green-600" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-4xl font-black text-slate-900">
                        {conversations.filter(c => {
                          const expiresAt = c.metadata?.whatsapp_window_expires_at || c.metadata?.window_expires_at;
                          return expiresAt && new Date(expiresAt).getTime() > now;
                        }).length}
                      </p>
                      <p className="mt-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Open 24h Windows</p>
                    </div>
                  </div>
                </div>

                {/* Card C: Total Linked Patients */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-blue-200/50 hover:bg-white">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <div className="relative space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 ring-1 ring-blue-200/30">
                      <User size={24} className="text-blue-600" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-4xl font-black text-slate-900">{conversations.length}</p>
                      <p className="mt-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Total Linked Patients</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* COMPLIANCE BANNER */}
              <div className="mx-auto mt-2 w-full max-w-2xl overflow-hidden rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-50/40 p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100/50">
                    <AlertCircle size={20} className="text-blue-600" strokeWidth={1.5} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold leading-relaxed text-blue-900">
                      <span className="font-black uppercase tracking-wider">Meta Rule:</span> Free-form text fields remain open for 24 hours following a customer's inbound payload. Template restrictions apply thereafter.
                    </p>
                    <p className="mt-2 text-xs font-medium text-blue-700">Compliant messaging ensures better patient engagement and adherence to platform guidelines.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {selectedChat && showDetailsPanel && (
        <div className="hidden w-72 flex-col space-y-8 overflow-y-auto border-l border-slate-200 bg-white p-6 xl:flex">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Chat Details</h3>
            <button
              type="button"
              onClick={() => setShowDetailsPanel(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              aria-label="Close chat details"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setIsGhostMode(!isGhostMode)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${isGhostMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-500'}`}
            >
              {isGhostMode ? <Eye size={14} /> : <EyeOff size={14} />}
              {isGhostMode ? 'Ghost Mode ON' : 'Ghost Mode'}
            </button>
            <div>
              <h4 className="border-b pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Tags</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...new Set([...tagOptions, ...selectedTags])].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => appendTag(tag)}
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold italic ${selectedTags.includes(tag) ? 'border-green-100 bg-green-50 text-green-600' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={customTagInput}
                  onChange={(event) => setCustomTagInput(sanitizeTextInput(event.target.value))}
                  onKeyDown={(event) => event.key === 'Enter' && addCustomTag()}
                  placeholder="Custom tag"
                  className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                />
                <button onClick={addCustomTag} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black text-white">Add</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-2xl font-black text-blue-600 shadow-sm">{safeInitial(selectedChat?.name)}</div>
            <h2 className="font-bold text-slate-800">{selectedChat?.name || 'Patient'}</h2>
            <button
              onClick={() => setShowPhone((value) => !value)}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-400"
            >
              {showPhone ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPhone ? selectedChat.phone || 'No phone' : '••••• •••••'}
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="border-b pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Chat Wallpaper</h4>
            <div className="grid grid-cols-5 gap-2">
              {['#E5DDD5', '#F0F9FF', '#F7F7EE', '#EEF7F2', '#FFF7ED'].map((color) => (
                <button
                  key={color}
                  onClick={() => saveChatBackground({ type: 'color', value: color })}
                  className="h-8 rounded-lg border border-slate-200"
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100">
              <ImageIcon size={14} />
              Upload Image
              <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
            </label>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="border-b pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Conversation Owner</h4>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400"><User size={16} /></div>
              <div className="leading-tight">
                <p className="text-[11px] font-bold text-slate-700">{activeAgent?.name}</p>
                <p className="text-[10px] text-slate-400">{activeAgent?.role}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

const Inbox = () => (
  <InboxRenderBoundary>
    <InboxContent />
  </InboxRenderBoundary>
);

export default Inbox;
