import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, Image as ImageIcon, Video, FileText, Type, X, 
  User, Mail, Calendar, Hash, ArrowLeft, Eye, AlertCircle,
  Settings, MessageSquare, ChevronRight, Link, Phone, Trash2,
  MoreVertical, PhoneCall, Video as VideoIcon, Tag, LayoutGrid, Plus,
  Smartphone, Monitor
} from 'lucide-react';

const Templates = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // Naya state device choice ke liye
  const [device, setDevice] = useState('IPHONE'); // 'IPHONE' or 'ANDROID'

  const [template, setTemplate] = useState({
    name: '',
    category: 'MARKETING',
    headerType: 'NONE',
    headerText: '',
    mediaPreview: null,
    bodyText: 'Hello {{1}}, how can we help you?',
    footerText: 'Marroncorp.ai',
    buttons: []
  });

  const [error, setError] = useState('');

  const categories = [
    { id: 'MARKETING', label: 'Marketing' },
    { id: 'UTILITY', label: 'Utility' },
    { id: 'AUTHENTICATION', label: 'Authentication' },
  ];

  // Logic Functions
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) {
      setError("File size too large! Max 2MB.");
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => setTemplate({ ...template, mediaPreview: reader.result });
    reader.readAsDataURL(file);
  };

  const insertPlaceholder = (type) => {
    const matches = template.bodyText.match(/\{\{(\d+)\}\}/g);
    const nextNum = matches ? matches.length + 1 : 1;
    setTemplate({ ...template, bodyText: `${template.bodyText} {{${nextNum}}}` });
  };

  const addButton = (type) => {
    if (template.buttons.length >= 2) return;
    const newBtn = type === 'URL' ? { type: 'URL', text: '', url: '' } : { type: 'PHONE', text: '', phone: '' };
    setTemplate({ ...template, buttons: [...template.buttons, newBtn] });
  };

  const updateButtonEntry = (index, field, value) => {
    const updatedButtons = [...template.buttons];
    updatedButtons[index][field] = value;
    setTemplate({ ...template, buttons: updatedButtons });
  };

  const removeButton = (index) => {
    setTemplate({ ...template, buttons: template.buttons.filter((_, i) => i !== index) });
  };

  const renderWhatsAppLook = (text) => {
    return text.replace(/\{\{(\d+)\}\}/g, '<span class="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold border border-blue-100 text-[11px]">[{{$1}}]</span>');
  };

  return (
    <div className="p-6 lg:p-10 bg-[#F9FAFB] min-h-screen font-sans text-slate-900">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Create WhatsApp Template</h1>
            <p className="text-slate-500 text-sm mt-1">Configure your message, media, and interactive buttons.</p>
          </div>
          <button className="px-8 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 hover:bg-[#1fb355] transition-all flex items-center gap-2">
            Submit Template <ChevronRight size={18}/>
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          
          {/* --- LEFT: CONFIGURATION --- */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. General Settings Card */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden transition-all hover:shadow-md">
               <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-blue-600">
                    <Settings size={20}/>
                 </div>
                 <h2 className="font-bold text-slate-700">General Configuration</h2>
               </div>
               
               <div className="p-8 grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Tag size={14}/> Template Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. order_confirmation_new" 
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700"
                      value={template.name}
                      onChange={(e) => setTemplate({...template, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <LayoutGrid size={14}/> Category
                    </label>
                    <select 
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 appearance-none cursor-pointer"
                      value={template.category}
                      onChange={(e) => setTemplate({...template, category: e.target.value})}
                    >
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                    </select>
                  </div>
               </div>
            </div>
            
            {/* 2. Message Content Card */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden transition-all hover:shadow-md">
               <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-green-600">
                    <MessageSquare size={20}/>
                 </div>
                 <h2 className="font-bold text-slate-700">Message Content</h2>
               </div>

               <div className="p-8 space-y-10">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">1. Header Media Type</label>
                    <div className="flex flex-wrap gap-3">
                      {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map((type) => (
                        <button key={type} onClick={() => { setTemplate({ ...template, headerType: type, mediaPreview: null }); if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(type)) fileInputRef.current.click(); }}
                          className={`flex-1 min-w-[100px] py-4 px-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${template.headerType === type ? 'border-green-500 bg-green-50/50 text-green-700 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-100'}`}
                        >
                          {type === 'IMAGE' ? <ImageIcon size={20}/> : type === 'VIDEO' ? <Video size={20}/> : type === 'DOCUMENT' ? <FileText size={20}/> : type === 'TEXT' ? <Type size={20}/> : <X size={20}/>}
                          <span className="text-[10px] font-black tracking-tighter uppercase">{type}</span>
                        </button>
                      ))}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">2. Message Body</label>
                      <div className="flex gap-2">
                         {['Name', 'Order ID'].map((p) => (
                           <button key={p} onClick={() => insertPlaceholder(p)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-all border border-slate-200 flex items-center gap-1">
                             <Plus size={12}/> {p}
                           </button>
                         ))}
                      </div>
                    </div>
                    <textarea className="w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none transition-all font-medium text-slate-700 min-h-[180px] resize-none" placeholder="Write your message here..." value={template.bodyText} onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">3. Footer Text</label>
                    <input type="text" className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none transition-all font-medium text-slate-500" placeholder="e.g. Reply STOP to opt out" value={template.footerText} onChange={(e) => setTemplate({...template, footerText: e.target.value})} />
                  </div>
               </div>
            </div>

            {/* 3. CTA Buttons Card */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden transition-all hover:shadow-md mb-20">
               <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                 <div className="flex items-center gap-3 text-orange-600 font-bold">CTA Buttons</div>
                 <div className="flex gap-2">
                    <button onClick={() => addButton('URL')} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">Website URL</button>
                    <button onClick={() => addButton('PHONE')} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold border border-purple-100">Call Phone</button>
                 </div>
               </div>
               <div className="p-8">
                  {template.buttons.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-6">
                       {template.buttons.map((btn, index) => (
                         <div key={index} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative">
                            <button onClick={() => removeButton(index)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                            <input type="text" placeholder="Button Text" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold mb-3 outline-none" value={btn.text} onChange={(e) => updateButtonEntry(index, 'text', e.target.value)} />
                            <input type="text" placeholder={btn.type === 'URL' ? "URL" : "Phone"} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none" value={btn.type === 'URL' ? btn.url : btn.phone} onChange={(e) => updateButtonEntry(index, btn.type === 'URL' ? 'url' : 'phone', e.target.value)} />
                         </div>
                       ))}
                    </div>
                  ) : <p className="text-center text-slate-400 text-xs py-4">No buttons added</p>}
               </div>
            </div>
          </div>

          {/* --- RIGHT: REALISTIC MOBILE PREVIEW WITH SCROLL & CHOICE --- */}
          <div className="lg:col-span-5">
            <div className="sticky top-10 flex flex-col items-center">
              
              {/* Device Chooser Tabs */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 shadow-inner">
                <button 
                  onClick={() => setDevice('IPHONE')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${device === 'IPHONE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Smartphone size={14}/> iPhone
                </button>
                <button 
                  onClick={() => setDevice('ANDROID')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${device === 'ANDROID' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Smartphone size={14}/> Android
                </button>
              </div>

              {/* Mobile Frame Container */}
              <div className={`w-full max-w-[340px] bg-[#1c1e21] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-[7px] border-[#3a3d42] relative transition-all duration-500 overflow-hidden
                ${device === 'IPHONE' ? 'rounded-[3.5rem]' : 'rounded-[1.5rem] border-[#222]'}`}>
                
                {/* iPhone Dynamic Island */}
                {device === 'IPHONE' && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-28 bg-black rounded-b-3xl z-50 flex items-center justify-center">
                    <div className="w-8 h-1 bg-white/10 rounded-full"></div>
                  </div>
                )}

                {/* Android Punch Hole */}
                {device === 'ANDROID' && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-50 ring-2 ring-white/5"></div>
                )}

                {/* The Internal Screen with SCROLL Logic */}
                <div className="bg-[#e5ddd5] h-[600px] flex flex-col relative">
                   
                   {/* Fixed WhatsApp Header (Static) */}
                   <div className={`${device === 'IPHONE' ? 'h-28 pt-8' : 'h-20'} bg-[#075e54] flex flex-col justify-end p-4 text-white z-20 relative shadow-lg`}>
                      <div className="flex items-center gap-3 mb-2">
                        <ArrowLeft size={18}/>
                        <div className="w-9 h-9 bg-slate-200/20 rounded-full flex items-center justify-center"><User size={20}/></div>
                        <div className="leading-tight">
                            <h3 className="font-bold text-[14px]">Marroncorp.ai</h3>
                            <p className="text-[9px] opacity-70">Official Business Account</p>
                        </div>
                      </div>
                   </div>

                   {/* SCROLLABLE CHAT AREA */}
                   <div className="flex-1 overflow-y-auto z-10 p-4 scroll-smooth custom-scrollbar">
                      <style>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                      `}</style>
                      
                      {/* Wallpaper Overlay (Fixed behind content) */}
                      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b5755d551e9e3307e5e37c.jpg')] bg-repeat"></div>
                      
                      {/* Chat Bubble Container */}
                      <div className="relative mb-8">
                         <div className={`max-w-[88%] shadow-sm ${device === 'IPHONE' ? 'rounded-2xl' : 'rounded-lg'} bg-white overflow-hidden rounded-tl-none`}>
                            {/* Media Section */}
                            {template.headerType !== 'NONE' && (
                                <div className="w-full bg-slate-100 aspect-video flex items-center justify-center overflow-hidden">
                                  {template.mediaPreview ? (
                                      template.headerType === 'IMAGE' ? <img src={template.mediaPreview} className="w-full h-full object-cover" alt="header"/> :
                                      <div className="flex flex-col items-center text-slate-400"><FileText size={32}/></div>
                                  ) : (
                                      <div className="text-slate-300 flex flex-col items-center italic text-[10px]"><Upload size={18}/><span className="mt-1">Preview</span></div>
                                  )}
                                </div>
                            )}

                            {/* Body Section */}
                            <div className="p-3 relative min-h-[60px]">
                                <div className="text-[#111b21] text-[13.5px] leading-[1.4] whitespace-pre-wrap tracking-tight" dangerouslySetInnerHTML={{ __html: renderWhatsAppLook(template.bodyText) }} />
                                {template.footerText && <div className="text-[#667781] text-[10.5px] pt-1.5 mt-2 border-t border-slate-50">{template.footerText}</div>}
                                <div className="text-right text-[9px] text-[#667781] mt-1 italic">12:45 PM ✓✓</div>
                            </div>
                         </div>

                         {/* Buttons Section (Below bubble) */}
                         {template.buttons.length > 0 && (
                            <div className="mt-1 space-y-1 max-w-[88%]">
                                {template.buttons.map((btn, index) => (
                                    <div key={index} className={`w-full bg-white/95 py-2.5 text-center flex items-center justify-center gap-2 font-bold text-[13px] text-[#00a5f4] shadow-sm cursor-pointer hover:bg-slate-50
                                      ${device === 'IPHONE' ? 'rounded-xl' : 'rounded-md shadow-inner'}`}>
                                        {btn.type === 'URL' ? <Link size={14}/> : <PhoneCall size={14}/>}
                                        {btn.text || (btn.type === 'URL' ? 'Visit Website' : 'Call Now')}
                                    </div>
                                ))}
                            </div>
                         )}
                      </div>
                   </div>

                   {/* Fixed Bottom Input Placeholder (Real look) */}
                   <div className="h-14 bg-[#f0f2f5] px-3 flex items-center gap-2 z-20 border-t border-slate-200">
                      <div className="flex-1 h-9 bg-white rounded-full flex items-center px-4 text-slate-300 text-xs">Type a message...</div>
                      <div className="w-9 h-9 bg-[#00a884] rounded-full flex items-center justify-center text-white"><ArrowLeft className="rotate-180" size={16}/></div>
                   </div>
                </div>
              </div>
              <p className="mt-6 text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em]"><Eye size={14}/> {device} Preview Mode</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Templates;