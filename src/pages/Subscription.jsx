import React, { useState } from 'react';
import axios from 'axios';

const Subscription = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const API_URL = import.meta.env.VITE_API_URL || 'https://yogidesk-ai.com/api';

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setMessage('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please choose a screenshot or UPI receipt to upload.');
      return;
    }

    setStatus('uploading');
    const formData = new FormData();
    formData.append('proof', file);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/payments/upload-proof`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setMessage(res.data.msg || 'Proof uploaded successfully.');
      setStatus('success');
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.msg || 'Failed to upload proof.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900">Subscription & Payment</h1>
              <p className="text-slate-500 mt-3 max-w-2xl">
                Your trial is ending soon. Choose a plan, pay via UPI, and upload the screenshot here for manual activation.
              </p>
            </div>
            <div className="rounded-3xl bg-orange-50 border border-orange-100 px-6 py-4 text-orange-700">
              <div className="text-sm uppercase tracking-[0.2em] font-bold">UPI Payment</div>
              <div className="mt-3 text-3xl font-black">vyapar@icici</div>
              <div className="mt-1 text-sm text-orange-800">Use this UPI ID to make the payment.</div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="bg-[#f8fafc] border border-slate-200 rounded-3xl p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Recommended Plan</h2>
              <p className="text-slate-600 text-sm leading-relaxed">We recommend the Lite or Elite plan after your free trial. Pay via UPI and upload the receipt below.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>• 14-day trial included</li>
                <li>• Manual account activation after upload</li>
                <li>• No GST or paperwork required for now</li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Upload Payment Proof</h2>
              <form onSubmit={handleUpload} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Upload Screenshot</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-slate-700" />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">What to upload</p>
                  <p className="mt-2">Upload the UPI payment screenshot or receipt clearly showing the payment to <strong>vyapar@icici</strong>.</p>
                </div>

                <button type="submit" className="w-full inline-flex items-center justify-center rounded-3xl bg-orange-600 px-6 py-4 text-white font-bold hover:bg-orange-700 transition">
                  {status === 'uploading' ? 'Uploading...' : 'Upload Proof'}
                </button>

                {message && (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${status === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                    {message}
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-blue-50 p-6 text-slate-700">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Next steps</h3>
            <ol className="space-y-2 list-decimal list-inside text-sm leading-relaxed">
              <li>Complete the UPI payment using the above ID.</li>
              <li>Upload the screenshot here.</li>
              <li>We will verify and activate your account manually.</li>
              <li>Your subscription status will update once verified.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
