import React from 'react';
import { HelpCircle, MessageCircle, Mail, BookOpen, PlayCircle, ExternalLink } from 'lucide-react';

const Support = () => {
  const supportCards = [
    { title: 'Knowledge Base', desc: 'Read our detailed guides and documentation.', icon: <BookOpen className="text-blue-500" />, link: '#' },
    { title: 'Video Tutorials', desc: 'Watch step-by-step videos on how to use Yogidesk.', icon: <PlayCircle className="text-purple-500" />, link: '#' },
    { title: 'WhatsApp Support', desc: 'Chat with our experts for instant help.', icon: <MessageCircle className="text-green-500" />, link: 'https://wa.me/your-number' },
    { title: 'Email Us', desc: 'Send us an email at support@yogidesk.com', icon: <Mail className="text-orange-500" />, link: 'mailto:support@yogidesk.com' },
  ];

  return (
    <div className="p-8 bg-[#fcfcfc] min-h-screen font-sans">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black text-gray-900 mb-2">How can we help you?</h1>
        <p className="text-gray-500 font-medium">Search our resources or reach out to our team directly.</p>
      </div>

      {/* Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {supportCards.map((card, idx) => (
          <a key={idx} href={card.link} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
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
    </div>
  );
};

export default Support;