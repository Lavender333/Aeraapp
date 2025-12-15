
import React, { useState, useEffect } from 'react';
import { ViewState } from '../types';
import { GoogleGenAI } from "../services/mockGenAI";
import { ArrowLeft, Search, MapPin, Navigation, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';

export const MapView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // Get user location on mount for better grounding
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => console.error("Error getting location", err),
        { enableHighAccuracy: true } // FORCE HIGH ACCURACY
      );
    }
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setResponse(null);
    setPlaces([]);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config: any = {
        tools: [{ googleMaps: {} }],
      };

      // Add location context if available
      if (userLocation) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.lat,
              longitude: userLocation.lng
            }
          }
        };
      }

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: searchQuery,
        config: config
      });

      setResponse(result.text || "No details found.");

      // Extract Maps Grounding Data
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedPlaces = chunks
        .map((chunk: any) => chunk.web?.uri ? null : chunk.maps) // Filter for maps data
        .filter((mapData: any) => mapData); // Remove nulls

      setPlaces(extractedPlaces);

    } catch (error) {
      console.error("Maps Grounding Error:", error);
      setResponse("Unable to connect to map services. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickQueries = [
    "Nearest emergency shelter",
    "Open hospitals nearby",
    "Where can I buy water?",
    "Gas stations with power"
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-bold text-lg text-slate-900">Map Assistant</h1>
        </div>

        <div className="relative">
          <Input 
            placeholder="Ask for places (e.g. 'Find nearby shelters')..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-12"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          />
          <button 
            onClick={() => handleSearch(query)}
            disabled={isLoading}
            className="absolute right-2 top-2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          </button>
        </div>

        {/* Quick Chips */}
        <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar">
          {quickQueries.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuery(q);
                handleSearch(q);
              }}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full whitespace-nowrap border border-slate-200 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {!response && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
             <MapPin size={64} className="mb-4" />
             <p>Use the search bar to find resources near you.</p>
          </div>
        )}

        {/* AI Response Text */}
        {response && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-3 text-brand-600 font-bold text-sm uppercase tracking-wide">
              <Navigation size={16} /> AERA Assistant
            </div>
            <div className="prose prose-sm text-slate-800 leading-relaxed">
              {response}
            </div>
          </div>
        )}

        {/* Places List */}
        {places.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pl-1">Located Places</h3>
            {places.map((place: any, idx: number) => (
              <Card key={idx} className="flex items-start gap-4 hover:border-brand-300 transition-colors">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                  <MapPin size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{place.title}</h4>
                  <p className="text-xs text-slate-500 mb-2 truncate">{place.address || "Location details via Google Maps"}</p>
                  
                  {place.placeAnswerSources?.reviewSnippets && (
                     <p className="text-xs text-slate-600 italic mb-3 line-clamp-2">
                       "{place.placeAnswerSources.reviewSnippets[0].text}"
                     </p>
                  )}

                  <a 
                    href={place.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
                  >
                    View on Maps <ExternalLink size={12} />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
