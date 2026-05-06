
import React, { useState } from 'react';
import { ViewState } from '../types';
import { ArrowLeft, Mail, Send, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';

interface ContactUsViewProps {
  setView: (view: ViewState) => void;
}

export const ContactUsView: React.FC<ContactUsViewProps> = ({ setView }) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const EMAIL = 'aerapp369@gmail.com';
  const RESPONSE_TIME = '7 business days';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = `Name: ${name}\n\n${message}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  const canSubmit = name.trim() && subject.trim() && message.trim();

  return (
    <div className="p-6 pb-28 space-y-6 animate-fade-in bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <button
          onClick={() => setView('SETTINGS')}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Contact Us</h1>
      </div>

      {/* Emerald banner card — centred with mail icon */}
      <div className="bg-emerald-600 rounded-2xl p-6 flex flex-col items-center text-center shadow-md">
        <div className="bg-white/20 p-3 rounded-full mb-4">
          <Mail size={28} className="text-white" />
        </div>
        <p className="text-white font-semibold text-base mb-1">Have a question or feedback?</p>
        <p className="text-emerald-100 text-sm mb-4">We'd love to hear from you.</p>

        {/* White email card inside banner */}
        <div className="bg-white rounded-xl px-5 py-3 w-full max-w-xs shadow-sm">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Email us at</p>
          <a
            href={`mailto:${EMAIL}`}
            className="text-lg font-black text-emerald-700 break-all hover:underline"
          >
            {EMAIL}
          </a>
        </div>
      </div>

      {/* Contact form */}
      {submitted ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3 text-center">
          <CheckCircle size={40} className="text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Email draft opened!</h2>
          <p className="text-sm text-slate-600">Complete and send it from your mail app. We aim to respond within {RESPONSE_TIME}.</p>
          <Button variant="outline" onClick={() => setSubmitted(false)} className="mt-2">
            Send another message
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Send us a message</h2>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this about?"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us how we can help…"
              rows={5}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <Button
            type="submit"
            fullWidth
            disabled={!canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send size={16} className="mr-2" />
            Open email draft
          </Button>

          {/* Footer card with secondary email link */}
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Or email us directly at</p>
            <a
              href={`mailto:${EMAIL}`}
              className="text-sm font-semibold text-emerald-700 hover:underline break-all"
            >
              {EMAIL}
            </a>
            <p className="text-[11px] text-slate-400 mt-1">We respond within {RESPONSE_TIME}.</p>
          </div>
        </form>
      )}
    </div>
  );
};
