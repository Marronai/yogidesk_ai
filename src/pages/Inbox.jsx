import React, { useState, useEffect } from 'react';
import { 
  Search, Send, MoreVertical, Shield, User, MessageSquare, 
  Eye, EyeOff, Lock, ChevronLeft, Paperclip, Smile,
  UserPlus, CheckCheck, Clock, ShieldAlert
} from 'lucide-react';

const Inbox = () => {
  // --- States ---
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeAgent, setActiveAgent] = useState({ id: 1, name: "Avi (Me)", role: "Admin" });
  const [message, setMessage] = useState('');

  // Mock Agents List (Admin Control ke liye)
  const agents = [
    { id: 1, name: "Avi", role: "Admin" },
    { id: 2, name: "Rahul", role: "Sales Agent" },
    { id: 3, name: "Sanya", role: "Support Agent" },
  ];

  // Mock Conversations
  const [conversations] = useState([
    { id: 1, name: "John Doe", lastMsg: "Price kya hai?", time: "10:30 AM", unread: 2, status: "Active" },
    { id: 2, name: "Marketing Lead", lastMsg: "Template received.", time: "Yesterday", unread: 0, status: "Away" },
    { id: 3, name: "Priya Sharma", lastMsg: "Calling you now.", time: "2 Days ago", unread: 0, status: "Offline" },
  ]);

  // Mock Messages (Private vs Public)
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello, how can I help you?", sender: "agent", type: "public", time: "10:00 AM" },
    { id: 2, text: "Wait, checking inventory first.", sender: "agent", type: "private", time: "10:05 AM" },
    { id: 3, text: "Sure, let me know.", sender: "user", type: "public", time: "10:06 AM" },
  ]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    const newMsg = {
      id: Date.now(),
      text: message,
      sender: "agent",
      type: isPrivateNote ? "private" : "public",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMsg]);
    setMessage('');
  };

  return (
    <div className="flex h-screen bg-[#F0F2F5] overflow-hidden font-sans">
      
      {/* --- 1. LEFT SIDEBAR: CHAT LIST --- */}
      <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-black tracking-tight text-slate-800">Inbox</h1>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><UserPlus size={18}/></button>
              <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><MoreVertical size={18}/></button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search chats..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {conversations.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setSelectedChat(chat)}
              className={`p-4 flex items-center gap-4 cursor-pointer transition-all border-b border-slate-50 hover:bg-slate-50 ${selectedChat?.id === chat.id ? 'bg-blue-50/50 border-r-4 border-r-blue-500' : ''}`}
            >
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 relative">
                <User size={24}/>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${chat.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-slate-800 text-sm truncate">{chat.name}</h3>
                  <span className="text-[10px] font-medium text-slate-400">{chat.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{chat.lastMsg}</p>
              </div>
              {chat.unread > 0 && <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{chat.unread}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* --- 2. CENTER: CHAT WINDOW --- */}
      <div className="flex-1 flex flex-col bg-[#E5DDD5] relative">
        
        {/* Chat Header */}
        {selectedChat ? (
          <>
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                  {selectedChat.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">{selectedChat.name}</h2>
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Online • Official Business</p>
                </div>
              </div>

              {/* ADMIN PANEL CONTROLS */}
              <div className="flex items-center gap-4">
                {/* Agent Switcher */}
                <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Active Agent:</span>
                  <select 
                    value={activeAgent.id} 
                    onChange={(e) => setActiveAgent(agents.find(a => a.id === parseInt(e.target.value)))}
                    className="bg-transparent text-[11px] font-bold outline-none cursor-pointer"
                  >
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                  </select>
                </div>

                {/* Ghost Mode Toggle */}
                <button 
                  onClick={() => setIsGhostMode(!isGhostMode)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isGhostMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'}`}
                >
                  {isGhostMode ? <Eye size={14}/> : <EyeOff size={14}/>}
                  {isGhostMode ? 'Ghost Mode ON' : 'Spy Mode'}
                </button>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar relative">
              {/* Wallpaper Overlay */}
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b5755d551e9e3307e5e37c.jpg')] bg-repeat"></div>

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl relative shadow-sm z-10 
                    ${msg.type === 'private' ? 'bg-yellow-50 border-2 border-yellow-200 text-yellow-900 rounded-br-none' : 
                      msg.sender === 'agent' ? 'bg-[#D9FDD3] text-slate-800 rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none'}`}
                  >
                    {msg.type === 'private' && (
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-yellow-600 mb-1 tracking-widest">
                        <Lock size={10}/> Private Note (Only Agents)
                      </div>
                    )}
                    <p className="text-[13.5px] leading-relaxed font-medium">{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[9px] opacity-60 font-medium">{msg.time}</span>
                      {msg.sender === 'agent' && msg.type !== 'private' && <CheckCheck size={12} className="text-blue-500"/>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ghost Mode Overlay Block */}
            {isGhostMode && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-orange-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-2xl animate-pulse">
                <ShieldAlert size={16}/> Viewing in Ghost Mode (Read Only)
              </div>
            )}

            {/* Chat Input Area */}
            <div className="p-4 bg-white border-t border-slate-200 z-20">
              <div className="max-w-[900px] mx-auto space-y-3">
                
                {/* Mode Selector (Private vs Public) */}
                {!isGhostMode && (
                  <div className="flex gap-2 mb-2">
                    <button 
                      onClick={() => setIsPrivateNote(false)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!isPrivateNote ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}
                    >
                      <MessageSquare size={12} className="inline mr-1.5"/> Customer Reply
                    </button>
                    <button 
                      onClick={() => setIsPrivateNote(true)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${isPrivateNote ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-slate-50 text-slate-400'}`}
                    >
                      <Lock size={12} className="inline mr-1.5"/> Private Note
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><Smile size={20}/></button>
                  <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><Paperclip size={20}/></button>
                  <input 
                    type="text" 
                    placeholder={isGhostMode ? "Ghost mode active: typing disabled" : (isPrivateNote ? "Type a private note for the team..." : "Reply to customer...")}
                    disabled={isGhostMode}
                    className="flex-1 bg-transparent border-none outline-none py-2 text-sm font-medium text-slate-700"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  {!isGhostMode && (
                    <button 
                      onClick={handleSendMessage}
                      className={`p-3 rounded-xl transition-all shadow-lg ${isPrivateNote ? 'bg-yellow-400 text-yellow-900' : 'bg-green-500 text-white hover:bg-green-600 shadow-green-100'}`}
                    >
                      <Send size={20}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
              <MessageSquare size={40} className="text-slate-200"/>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Your Unified Inbox</h2>
            <p className="max-w-[280px] text-xs mt-2 leading-relaxed font-medium">Select a conversation from the sidebar to start chatting with your leads across Meta platforms.</p>
          </div>
        )}
      </div>

      {/* --- 3. RIGHT SIDEBAR (OPTIONAL: CONTACT INFO) --- */}
      {selectedChat && (
        <div className="hidden xl:flex w-72 bg-white border-l border-slate-200 flex-col p-6 space-y-8 overflow-y-auto">
          <div className="flex flex-col items-center">
             <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center font-black text-2xl mb-4 shadow-sm">
                {selectedChat.name.charAt(0)}
             </div>
             <h2 className="font-bold text-slate-800">{selectedChat.name}</h2>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">+91 99999 88888</p>
          </div>

          <div className="space-y-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Customer Tags</h4>
             <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100 italic">#ActiveLead</span>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold border border-blue-100 italic">#FollowUp</span>
             </div>
          </div>

          <div className="space-y-4 pt-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Conversation Owner</h4>
             <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-200"><User size={16}/></div>
                <div className="leading-tight">
                  <p className="text-[11px] font-bold text-slate-700">{activeAgent.name}</p>
                  <p className="text-[10px] text-slate-400">{activeAgent.role}</p>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Tailwind Specific CSS Classes (Optional, for smoother look) */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Inbox;