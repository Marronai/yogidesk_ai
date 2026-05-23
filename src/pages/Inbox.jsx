import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  Smile,
  User,
  UserPlus,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';

const tagOptions = ['#ActiveLead', '#FollowUp'];

const fallbackAgent = { id: 'admin', name: 'Admin', role: 'Admin' };
const logInboxError = (error) => {
  const message = error?.message || error?.details || String(error || '');
  if (error?.code === 'PGRST205' || String(message).toLowerCase().includes('schema cache')) {
    console.error('Supabase Inbox Logging Crash:', message);
    return;
  }
  console.error('Supabase Inbox Logging Error:', message);
};

const Inbox = () => {
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
  const [customTagInput, setCustomTagInput] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [chatBg, setChatBg] = useState({ type: 'color', value: '#E5DDD5' });

  const selectedTags = useMemo(() => selectedChat?.metadata?.tags || [], [selectedChat]);
  const allTags = useMemo(() => {
    const tags = new Set(tagOptions);
    conversations.forEach((chat) => {
      (chat.metadata?.tags || []).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [conversations]);
  const visibleConversations = useMemo(() => (
    tagFilter === 'ALL'
      ? conversations
      : conversations.filter((chat) => (chat.metadata?.tags || []).includes(tagFilter))
  ), [conversations, tagFilter]);

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user || { id: localStorage.getItem('user_id') };
  };

  const loadInbox = useCallback(async () => {
    const user = await getUser();
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let teamData = [];
    let chatData = [];

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

    try {
      let result = await supabase
        .from('inbox_chats')
        .select('id, last_message, updated_at, name, patient_name, phone, status, scheduled_at, assigned_agent_id, metadata, unread_count')
        .order('updated_at', { ascending: false });

      if (result.error) {
        const safeResult = await supabase
          .from('inbox_chats')
          .select('id, last_message, updated_at, name, patient_name, status, scheduled_at')
          .order('updated_at', { ascending: false });
        result = safeResult;
      }

      if (result.error) throw result.error;
      chatData = result.data || [];
    } catch (error) {
      logInboxError(error);
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
        return {
          id: chat.id,
          name: displayName,
          phone: chat.phone || '',
          lastMsg: chat.last_message || '',
          time: chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unread: Number(chat.unread_count || 0),
          status: chat.status || 'Offline',
          scheduled_at: chat.scheduled_at || null,
          assigned_agent_id: chat.assigned_agent_id,
          metadata: chat.metadata || {},
        };
      })
      : [];

    setAgents(mappedAgents);
    setActiveAgent(mappedAgents[0]);
    setConversations(mappedChats);
    setLoading(false);
  }, []);

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
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'SENT') return <Check size={13} className="text-slate-400" />;
    if (normalized === 'DELIVERED') return <CheckCheck size={14} className="text-slate-400" />;
    if (normalized === 'READ') return <CheckCheck size={14} className="text-blue-500" />;
    return null;
  };

  useEffect(() => {
    loadInbox();
  }, [loadInbox, reloadToken]);

  const loadMessages = async (chatId) => {
    let data = [];
    try {
      const result = await supabase
        .from('inbox_messages')
        .select('id, body, message_body, sender, is_private_note, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (result.error) throw result.error;
      data = result.data || [];
    } catch (error) {
      logInboxError(error);
    }

    setMessages(Array.isArray(data)
      ? data.map((item) => ({
        id: item.id,
        text: item.body || item.message_body || '',
        sender: item.sender || 'user',
        type: item.is_private_note ? 'private' : 'public',
        is_private_note: Boolean(item.is_private_note),
        time: item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }))
      : []);
  };

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

  const handleSendMessage = async () => {
    const text = message.trim();
    if (!text || !selectedChat) return;

    const created = {
      id: Date.now(),
      text,
      sender: 'agent',
      type: isPrivateNote ? 'private' : 'public',
      is_private_note: isPrivateNote,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, created]);
    setMessage('');

    try {
      const { error } = await supabase.from('inbox_messages').insert([{
        chat_id: selectedChat.id,
        body: text,
        sender: 'agent',
        is_private_note: isPrivateNote,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
    } catch (error) {
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
    const tag = customTagInput.trim();
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
    const agent = agents.find((item) => String(item.id) === String(chat.assigned_agent_id)) || agents[0];
    setActiveAgent(agent);
    loadChatBackground(chat.id);
    loadMessages(chat.id);
  };

  const chatViewportStyle = chatBg.type === 'image'
    ? { backgroundImage: `url(${chatBg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: chatBg.value || '#E5DDD5' };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F2F5] font-sans">
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
            <input type="text" placeholder="Search chats..." className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:bg-white" />
          </div>
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
                  <h3 className="truncate text-sm font-bold text-slate-800">{chat.name}</h3>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-400">
                    {chat.time}
                    {renderStatusBadge(chat.status)}
                  </span>
                </div>
                {String(chat.status || '').toUpperCase() === 'QUEUED' ? (
                  <p className="inline-flex max-w-full items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-orange-600">
                    <Clock3 size={12} />
                    {formatCountdown(chat.scheduled_at)}
                  </p>
                ) : (
                  <p className="truncate text-xs text-slate-500">{chat.lastMsg}</p>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">{selectedChat.name.charAt(0)}</div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">{selectedChat.name}</h2>
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
                  onClick={() => setIsGhostMode(!isGhostMode)}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${isGhostMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'}`}
                >
                  {isGhostMode ? <Eye size={14} /> : <EyeOff size={14} />}
                  {isGhostMode ? 'Ghost Mode ON' : 'Spy Mode'}
                </button>
              </div>
            </div>

            <div className="custom-scrollbar relative flex-1 space-y-4 overflow-y-auto p-6">
              <div className="sticky top-0 z-30 flex justify-end">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBgMenu((value) => !value)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/85 text-slate-500 shadow-sm backdrop-blur hover:bg-white"
                    aria-label="Chat wallpaper settings"
                  >
                    <Settings size={16} />
                  </button>
                  {showBgMenu && (
                    <div className="absolute right-0 top-11 w-56 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
                      <div className="mb-3 grid grid-cols-5 gap-2">
                        {['#E5DDD5', '#F0F9FF', '#F7F7EE', '#EEF7F2', '#111827'].map((color) => (
                          <button
                            key={color}
                            type="button"
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
                  )}
                </div>
              </div>
              {messages.length === 0 && (
                <div className="rounded-2xl bg-white/70 p-6 text-center text-sm font-semibold text-slate-500">
                  No messages in this chat yet.
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`relative z-10 max-w-[70%] rounded-2xl p-3 shadow-sm ${msg.is_private_note || msg.type === 'private' ? 'rounded-br-none border-2 border-yellow-200 bg-yellow-50 text-yellow-900' : msg.sender === 'agent' ? 'rounded-br-none bg-[#D9FDD3] text-slate-800' : 'rounded-bl-none bg-white text-slate-800'}`}>
                    {(msg.is_private_note || msg.type === 'private') && (
                      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-yellow-600">
                        <Lock size={10} /> Private Note
                      </div>
                    )}
                    <p className="text-[13.5px] font-medium leading-relaxed">{msg.text}</p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <span className="text-[9px] font-medium opacity-60">{msg.time}</span>
                      {msg.sender === 'agent' && !(msg.is_private_note || msg.type === 'private') && <CheckCheck size={12} className="text-blue-500" />}
                    </div>
                  </div>
                </div>
              ))}
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
                    <button onClick={() => setIsPrivateNote(false)} className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase transition-all ${!isPrivateNote ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                      <MessageSquare size={12} className="mr-1.5 inline" /> Customer Reply
                    </button>
                    <button onClick={() => setIsPrivateNote(true)} className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase transition-all ${isPrivateNote ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                      <Lock size={12} className="mr-1.5 inline" /> Private Note
                    </button>
                  </div>
                )}

                <div className={`flex items-center gap-3 rounded-2xl border p-2 transition-all ${isPrivateNote ? 'border-yellow-300 bg-yellow-50 ring-2 ring-yellow-100' : 'border-slate-100 bg-slate-50'}`}>
                  <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Smile size={20} /></button>
                  <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Paperclip size={20} /></button>
                  <input
                    type="text"
                    placeholder={isGhostMode ? 'Ghost mode active: typing disabled' : (isPrivateNote ? 'Type a private team note...' : 'Reply to customer...')}
                    disabled={isGhostMode}
                    className={`flex-1 border-none bg-transparent py-2 text-sm font-medium outline-none ${isPrivateNote ? 'text-yellow-900 placeholder:text-yellow-500' : 'text-slate-700'}`}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSendMessage()}
                  />
                  {!isGhostMode && (
                    <button onClick={handleSendMessage} className={`rounded-xl p-3 shadow-lg transition-all ${isPrivateNote ? 'bg-yellow-400 text-yellow-900' : 'bg-green-500 text-white shadow-green-100 hover:bg-green-600'}`}>
                      <Send size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm"><MessageSquare size={40} className="text-slate-200" /></div>
            <h2 className="text-xl font-bold text-slate-800">{conversations.length === 0 ? 'Your inbox is empty. Waiting for new patient chats...' : 'Your Unified Inbox'}</h2>
            {conversations.length > 0 && <p className="mt-2 max-w-[280px] text-xs font-medium leading-relaxed">Select a conversation from the sidebar to start chatting with your patients.</p>}
          </div>
        )}
      </div>

      {selectedChat && (
        <div className="hidden w-72 flex-col space-y-8 overflow-y-auto border-l border-slate-200 bg-white p-6 xl:flex">
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
                  onChange={(event) => setCustomTagInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addCustomTag()}
                  placeholder="Custom tag"
                  className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                />
                <button onClick={addCustomTag} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black text-white">Add</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-2xl font-black text-blue-600 shadow-sm">{selectedChat.name.charAt(0)}</div>
            <h2 className="font-bold text-slate-800">{selectedChat.name}</h2>
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

export default Inbox;
