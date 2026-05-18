import React from 'react';

const Terms = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Page Header */}
      <div className="bg-[#FF6B00] py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms & Conditions</h1>
        <p className="text-orange-100 max-w-2xl mx-auto italic text-sm">Please read these terms carefully before using Yogi Desk AI.</p>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto py-12 px-6 leading-relaxed">
        <div className="space-y-12">
          <section>
            <div className="flex items-center mb-4">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold">01</span>
              <h2 className="text-2xl font-bold">Acceptance of Terms</h2>
            </div>
            <p className="text-gray-700 ml-11">
              By using Yogi Desk, you agree to follow our terms and Meta's official WhatsApp Business Policy. Violation of these rules may result in account termination without prior notice.
            </p>
          </section>

          <section>
            <div className="flex items-center mb-4">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold">02</span>
              <h2 className="text-2xl font-bold">Usage Policy & Wallet Credits</h2>
            </div>
            <p className="text-gray-700 ml-11">
              Yogi Desk AI runs on prepaid wallet credits. You are responsible for maintaining sufficient balance and for all content sent through your WhatsApp Business account.
            </p>
          </section>

          <section>
            <div className="flex items-center mb-4">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold">03</span>
              <h2 className="text-2xl font-bold">Payment & Refunds</h2>
            </div>
            <p className="text-gray-700 ml-11">
              Payments are processed via secure channels (UPI/Cosmofeed). All subscription fees are non-refundable once the service is activated.
            </p>
          </section>

          <section className="bg-orange-50 p-6 border-l-4 border-[#FF6B00]">
            <h3 className="font-bold text-lg mb-2">Important Disclaimer</h3>
            <p className="text-gray-700 text-sm">
              Yogi Desk AI is a technology provider for clinics, doctors, hospitals, and healthcare teams. We are not responsible for account bans or message delivery failures caused by Meta's internal algorithms or policy changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
