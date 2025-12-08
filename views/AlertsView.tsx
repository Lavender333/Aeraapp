
import React, { useState } from 'react';
import { ViewState } from '../types';
import { GoogleGenAI } from "@google/genai";
import { ArrowLeft, Bell, Search, Globe, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { t } from '../services/translations';

export const AlertsView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [newsSummary, setNewsSummary] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setNewsSummary(null);
    setSources([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: searchQuery,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      setNewsSummary(result.text || "No recent updates found.");

      // Extract Search Grounding Data (Sources)
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedSources = chunks
        .map((chunk: any) => chunk.web)
        .filter((webData: any) => webData);

      setSources(extractedSources);

    } catch (error) {
      console.error("Search Grounding Error:", error);
      setNewsSummary("Unable to fetch live updates. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickTopics = [
    "Flooding updates in my area",
    "Local emergency shelter status",
    "Power outage map and restoration times",
    "Road closures near me"
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-bold text-lg text-slate-900">{t('alerts.title')}</h1>
        </div>

        <div className="relative">
          <Input 
            placeholder={t('alerts.search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-12"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          />
          <button 
            onClick={() => handleSearch(query)}
            disabled={isLoading}
            className="absolute right-2 top-2 p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Default / Static Alerts */}
        {!newsSummary && !isLoading && (
          <div className="space-y-4">
             <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{t('alerts.official')}</h3>
             {[1, 2].map((i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900">Severe Weather Warning</h3>
                    <span className="text-xs text-slate-500">Official</span>
                  </div>
                  <p className="text-slate-600 text-sm">Heavy rainfall expected. Please seek higher ground immediately.</p>
                </div>
              ))}
              
              <div className="mt-8">
                 <h3 className="font-bold text-slate-500 text-sm uppercase tracking-wider mb-3">{t('alerts.quick_scan')}</h3>
                 <div className="grid grid-cols-1 gap-2">
                    {quickTopics.map((topic) => (
                      <button 
                        key={topic}
                        onClick={() => {
                          setQuery(topic);
                          handleSearch(topic);
                        }}
                        className="text-left p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:border-brand-300 hover:text-brand-700 transition-colors flex items-center gap-2"
                      >
                         <Globe size={16} className="text-slate-400" />
                         {topic}
                      </button>
                    ))}
                 </div>
              </div>
          </div>
        )}

        {/* AI Results */}
        {newsSummary && (
          <div className="animate-slide-up space-y-6">
            <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm">
               <div className="flex items-center gap-2 mb-4 text-orange-600 font-bold text-sm uppercase tracking-wide">
                 <Bell size={18} /> {t('alerts.ai_summary')}
               </div>
               <div className="prose prose-sm text-slate-800 leading-relaxed">
                 {newsSummary}
               </div>
            </div>

            {sources.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-3 pl-1">{t('alerts.sources')}</h3>
                <div className="space-y-2">
                  {sources.map((source: any, idx: number) => (
                    <a 
                      key={idx}
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    >
                       <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-blue-700 group-hover:underline truncate pr-4">{source.title}</span>
                          <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-500" />
                       </div>
                       <span className="text-xs text-slate-500 truncate block mt-1">{source.uri}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};