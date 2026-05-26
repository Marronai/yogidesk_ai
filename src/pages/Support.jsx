import React, { useState } from 'react';
import { HelpCircle, MessageCircle, Mail, BookOpen, PlayCircle, ExternalLink, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useWallet } from '../context/WalletContext';

const Support = () => {
  const [view, setView] = useState('home');
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  const openKnowledgeBase = async () => {
    setView('knowledge');
    if (articles.length) return;
    setLoadingArticles(true);
    const { data } = await supabase
      .from('knowledge_base')
      .select('id, title, description, doc_url')
      .order('created_at', { ascending: false });
    setArticles(Array.isArray(data) ? data : []);
    setLoadingArticles(false);
  };

  const supportCards = [
    { title: 'Knowledge Base', desc: 'Read our detailed guides and documentation.', icon: <BookOpen className="text-blue-500" />, link: '#' },
    { title: 'Video Tutorials', desc: 'Watch step-by-step videos on how to use Yogi Desk AI.', icon: <PlayCircle className="text-purple-500" />, link: '#' },
    { title: 'WhatsApp Support', desc: 'Chat with our experts for instant help.', icon: <MessageCircle className="text-green-500" />, link: 'https://wa.me/your-number' },
    { title: 'Email Us', desc: 'Send us an email at support@yogidesk.com', icon: <Mail className="text-orange-500" />, link: 'mailto:support@yogidesk.com' },
  ];

  return (
    <div className="p-8 bg-[#fcfcfc] min-h-screen font-sans">
      {view === 'knowledge' ? (
        <div className="max-w-6xl mx-auto">
          <button onClick={() => setView('home')} className="mb-8 flex items-center gap-2 text-sm font-black text-orange-600 hover:text-orange-700">
            <ArrowLeft size={18} /> Back to Help Center
          </button>
          <div className="mb-8">
            <h1 className="text-4xl font-black text-gray-900">Knowledge Base</h1>
            <p className="mt-2 text-gray-500 font-medium">Guides and documentation imported from your dynamic Google Docs library.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingArticles ? (
              <div className="col-span-full p-12 text-center text-gray-400 font-black uppercase tracking-widest">Loading articles...</div>
            ) : articles.map((article) => (
              <div key={article.id || article.doc_url} className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 mb-2">{article.title}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-5">{article.description}</p>
                <a href={article.doc_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-orange-700">
                  Open Guide <ExternalLink size={14} />
                </a>
              </div>
            ))}
            {!loadingArticles && articles.length === 0 && (
              <div className="col-span-full p-12 text-center text-gray-400 font-black uppercase tracking-widest">No articles found</div>
            )}
          </div>
        </div>
      ) : (
      <>
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black text-gray-900 mb-2">How can we help you?</h1>
        <p className="text-gray-500 font-medium">Search our resources or reach out to our team directly.</p>
      </div>

      {/* Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {supportCards.map((card, idx) => (
          <a key={idx} href={idx === 0 ? undefined : card.link} onClick={idx === 0 ? (e) => { e.preventDefault(); openKnowledgeBase(); } : undefined} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              {card.icon}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{card.title}</h3>
            <p className="text-gray-500 text-sm font-medium leading-relaxed mb-4">{card.desc}</p>
            <span className="text-orange-600 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
              Explore Now <ExternalLink size={14}/>
            </span>
          </a>
        ))}
      </div>

      {/* FAQ Section Placeholder */}
      <div className="max-w-3xl mx-auto bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
        <h2 className="text-2xl font-black text-center mb-8 flex items-center justify-center gap-3">
          <HelpCircle className="text-orange-500"/> Popular Questions
        </h2>
        <div className="space-y-4">
          <div className="p-5 bg-gray-50 rounded-2xl">
            <h4 className="font-bold text-gray-900 mb-1">Mera WhatsApp link nahi ho raha hai?</h4>
            <p className="text-gray-500 text-sm">Apne Meta settings mein check karein ki aapka Number ID sahi hai ya nahi.</p>
          </div>
          {/* Add more FAQs here */}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default Support;
