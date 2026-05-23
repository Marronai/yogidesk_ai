import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  ShieldAlert,
  Smile,
  User,
  UserPlus,
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

  const selectedTags = useMemo(() => selectedChat?.metadata?.tags || [], [selectedChat]);

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user || { id: localStorage.getItem('user_id') };
  };

  useEffect(() => {
    let active = true;

    const loadInbox = async () => {
      const user = await getUser();
      if (!user?.id) {
        if (active) setLoading(false);
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
        const { data, error } = await supabase
          .from('inbox_chats')
          .select('id, name, phone, last_message, updated_at, unread_count, status, assigned_agent_id, metadata')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        if (error) throw error;
        chatData = data || [];
      } catch (error) {
        logInboxError(error);
      }

      if (!active) return;

      const mappedAgents = Array.isArray(teamData) && teamData.length
        ? teamData.map((agent) => ({
          id: agent.id,
          name: agent.name || agent.email,
          role: 'STAFF',
        }))
        : [fallbackAgent];

      const mappedChats = Array.isArray(chatData)
        ? chatData.map((chat) => ({
          id: chat.id,
          name: chat.name || chat.phone || 'Patient',
          phone: chat.phone || '',
          lastMsg: chat.last_message || '',
          time: chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unread: Number(chat.unread_count || 0),
          status: chat.status || 'Offline',
          assigned_agent_id: chat.assigned_agent_id,
          metadata: chat.metadata || {},
        }))
        : [];

      setAgents(mappedAgents);
      setActiveAgent(mappedAgents[0]);
      setConversations(mappedChats);
      setLoading(false);
    };

    loadInbox();
    return () => { active = false; };
  }, []);

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

  const openChat = (chat) => {
    setSelectedChat(chat);
    const agent = agents.find((item) => String(item.id) === String(chat.assigned_agent_id)) || agents[0];
    setActiveAgent(agent);
    loadMessages(chat.id);
  };

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
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {!loading && conversations.length === 0 && (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm font-semibold text-slate-400">
              Your inbox is empty. Waiting for new patient chats...
            </div>
          )}
          {conversations.map((chat) => (
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
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="truncate text-sm font-bold text-slate-800">{chat.name}</h3>
                  <span className="text-[10px] font-medium text-slate-400">{chat.time}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{chat.lastMsg}</p>
              </div>
              {chat.unread > 0 && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{chat.unread}</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col bg-[#E5DDD5]">
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
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-2xl font-black text-blue-600 shadow-sm">{selectedChat.name.charAt(0)}</div>
            <h2 className="font-bold text-slate-800">{selectedChat.name}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{selectedChat.phone}</p>
          </div>

          <div className="space-y-4">
            <h4 className="border-b pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Tags</h4>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => appendTag(tag)}
                  className={`rounded-full border px-3 py-1 text-[10px] font-bold italic ${selectedTags.includes(tag) ? 'border-green-100 bg-green-50 text-green-600' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
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
