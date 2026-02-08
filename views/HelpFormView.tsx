
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, HelpRequestData, StepId } from '../types';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { ProgressBar } from '../components/ProgressBar';
import { StorageService } from '../services/storage';
import { notifyEmergencyContact } from '../services/api';
import { t } from '../services/translations';
import { ArrowLeft, CheckCircle, AlertOctagon, Ambulance, Flame, Droplets, Zap, Shield, Camera, StopCircle, RefreshCw, MessageSquare, Navigation, MapPin, X, Wifi, Settings, HelpCircle, Globe, AlertTriangle, WifiOff, Clock } from 'lucide-react';

interface HelpFormViewProps {
  setView: (view: ViewState) => void;
}

const INITIAL_DATA: HelpRequestData = {
  isSafe: null,
  location: '',
  emergencyType: '',
  isInjured: null,
  injuryDetails: '',
  situationDescription: '',
  canEvacuate: null,
  hazardsPresent: null,
  hazardDetails: '',
  peopleCount: 1,
  petsPresent: null,
  hasWater: null,
  hasFood: null,
  hasMeds: null,
  hasPower: null,
  hasPhone: null,
  needsTransport: null,
  vulnerableGroups: [],
  medicalConditions: '',
  damageType: '',
  consentToShare: false,
};

export const HelpFormView: React.FC<HelpFormViewProps> = ({ setView }) => {
  const [step, setStep] = useState<StepId>(1);
  const [data, setData] = useState<HelpRequestData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  
  // Location State
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastLocUpdate, setLastLocUpdate] = useState<string>('');
  const [isIpFallback, setIsIpFallback] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const hasPrefilledLocation = useRef(false);
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // Reset form state on mount to allow multiple requests
  useEffect(() => {
    setStep(1);
    setData(INITIAL_DATA);
    setIsSubmitting(false);
    setIsSuccess(false);
    setSubmittedId(null);
    setLocationError(null);
    setPermissionDenied(false);
    setIsTracking(true);
    setGpsAccuracy(null);
    setLastLocUpdate('');
    setIsIpFallback(false);
    hasPrefilledLocation.current = false;
  }, []);

  // Load profile for contact info
  useEffect(() => {
    const profile = StorageService.getProfile();
    setEmergencyContactPhone(profile.emergencyContactPhone || '');
    
    // Check if permission was already granted previously
    navigator.permissions?.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
            setIsTracking(true);
        }
    });

    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Prefill with last known location if GPS hasn't populated yet
  useEffect(() => {
    if (hasPrefilledLocation.current) return;
    const lastKnown = StorageService.getLastKnownLocation();
    if (lastKnown) {
      hasPrefilledLocation.current = true;
      setData(prev => prev.location ? prev : { ...prev, location: lastKnown.location });
      setLastLocUpdate(new Date(lastKnown.timestamp).toLocaleTimeString());
      setIsTracking(false);
      setIsIpFallback(false);
    }
  }, []);

  // IP Location Fallback (disabled for privacy)
  const fetchIpLocation = async () => {
    setIsIpFallback(false);
    setLocationError("Location services unavailable. Please enter address manually.");
  };

  // Live Location Logic
  useEffect(() => {
    let watchId: number;

    // Helper to start tracking
    const startTracking = () => {
      setLocationError(null);
      setPermissionDenied(false);
      setIsIpFallback(false);
      
      const successHandler = (position: GeolocationPosition) => {
          const { latitude, longitude, accuracy } = position.coords;
          const locString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          setData(prev => ({
            ...prev,
            location: locString
          }));
          setGpsAccuracy(Math.round(accuracy));
          setLastLocUpdate(new Date().toLocaleTimeString());
          setLocationError(null); 
          setPermissionDenied(false);
          setIsIpFallback(false);

          // Track backend if submitted
          if (submittedId) {
            StorageService.updateRequestLocation(submittedId, locString);
          }
      };

      const errorHandler = (error: GeolocationPositionError) => {
          let errorMessage = "Location unavailable";
          let stopTracking = false;

          switch(error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = "GPS denied. Please enter address manually.";
              setPermissionDenied(true);
              fetchIpLocation();
              stopTracking = true;
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = "Signal weak. Please enter address manually.";
              fetchIpLocation();
              stopTracking = true;
              break;
            case 3: // TIMEOUT
              errorMessage = "GPS Timeout. Retrying...";
              break;
            default:
              errorMessage = "GPS Error";
          }
          
          if (!isIpFallback && !stopTracking) {
             setLocationError(errorMessage);
          }
          setGpsAccuracy(null);
          
          if (stopTracking) {
            setIsTracking(false);
          }
      };

      const geoOptions = { 
        enableHighAccuracy: true, 
        maximumAge: 0, // FORCE FRESH READINGS (No cache)
        timeout: 30000 // Give GPS hardware more time to lock
      };

      watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, geoOptions);
    };

    if (isTracking && "geolocation" in navigator) {
      startTracking();
    } else if (isTracking && !("geolocation" in navigator)) {
      setLocationError("GPS not supported. Using Network Location.");
      fetchIpLocation();
      setIsTracking(false);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, submittedId]);

  // Camera Management
  const toggleCamera = async () => {
    if (isCameraOn) {
      // Stop camera
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraOn(false);
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraOn(true);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        alert("Unable to access camera. Please check permissions in Settings.");
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (isCameraOn) {
         const stream = videoRef.current?.srcObject as MediaStream;
         stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOn]);

  const updateData = (updates: Partial<HelpRequestData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 5) as StepId);
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1) as StepId);

  const handleSubmit = async () => {
    if (!data.consentToShare) return;
    setIsSubmitting(true);
    
    const lastKnown = StorageService.getLastKnownLocation();
    const locationToUse = data.location || lastKnown?.location || '';
    if (locationToUse && !data.location) {
      setData(prev => ({ ...prev, location: locationToUse }));
    }
    try {
      const record = await StorageService.submitRequest({ ...data, location: locationToUse });
      setSubmittedId(record.id);
      if (data.emergencyContactPhone) {
        notifyEmergencyContact({
          contactName: data.emergencyContactName,
          contactPhone: data.emergencyContactPhone,
          userName: data.fullName,
          emergencyType: data.emergencyType,
          description: data.situationDescription,
          location: locationToUse,
          requestId: record.id,
        }).catch((err) => console.warn('Emergency contact notify failed', err));
      }
      setIsSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Failed to submit request. Saved locally; will retry when online.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextContact = () => {
    // Robust phone extraction: strip everything except digits and +
    const phoneNumber = emergencyContactPhone.replace(/[^\d+]/g, '');
    
    const statusText = data.isSafe === null ? 'Unknown Status' : (data.isSafe ? 'Safe' : 'IN DANGER');
    const typeText = data.emergencyType || 'Emergency';
    const locText = data.location || 'GPS Unavailable';
    const descText = data.situationDescription ? `- ${data.situationDescription}` : '';
    
    const body = `I used the AERA app to request emergency assistance.\n\nType: ${typeText} ${descText}\nLocation: ${locText}\nStatus: ${statusText}`;
    
    // Use proper separator for iOS vs Android
    const separator = navigator.userAgent.match(/iPhone|iPad|iPod/i) ? '&' : '?';
    
    window.location.href = `sms:${phoneNumber}${separator}body=${encodeURIComponent(body)}`;
  };

  // --- GPS SIGNAL VISUALIZER ---
  const renderSignalBars = (accuracy: number) => {
    // Logic: <15m = 4 bars (Excellent), <30m = 3 bars (Good), <60m = 2 bars (Fair/Yellow), >60m = 1 bar (Weak/Red)
    let bars = 0;
    let colorClass = 'bg-slate-300';

    if (accuracy <= 15) { bars = 4; colorClass = 'bg-green-500'; }
    else if (accuracy <= 30) { bars = 3; colorClass = 'bg-green-500'; }
    else if (accuracy <= 60) { bars = 2; colorClass = 'bg-yellow-500'; }
    else { bars = 1; colorClass = 'bg-red-500'; }

    return (
      <div className="flex items-end gap-1 h-3" role="img" aria-label={`GPS Signal Strength: ${bars} of 4 bars`}>
        <div className={`w-1 rounded-sm ${bars >= 1 ? colorClass : 'bg-slate-200'} h-1.5`}></div>
        <div className={`w-1 rounded-sm ${bars >= 2 ? colorClass : 'bg-slate-200'} h-2`}></div>
        <div className={`w-1 rounded-sm ${bars >= 3 ? colorClass : 'bg-slate-200'} h-2.5`}></div>
        <div className={`w-1 rounded-sm ${bars >= 4 ? colorClass : 'bg-slate-200'} h-3`}></div>
      </div>
    );
  };

  const getSignalText = (accuracy: number | null) => {
    if (!accuracy) return '';
    if (accuracy <= 15) return 'Excellent Signal';
    if (accuracy <= 30) return 'Good Signal';
    if (accuracy <= 60) return 'Fair Signal';
    return 'Weak Signal';
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-fade-in pb-safe">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 relative ${isOfflineMode ? 'bg-amber-100' : 'bg-green-100'}`}>
          <div className={`absolute inset-0 rounded-full border-4 ${isOfflineMode ? 'border-amber-500/30' : 'border-green-500/30'} animate-[ping_2s_ease-out_infinite]`}></div>
          {isOfflineMode ? (
            <Clock size={48} className="text-amber-600 relative z-10" />
          ) : (
            <CheckCircle size={48} className="text-green-700 relative z-10" />
          )}
        </div>
        
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">
          {isOfflineMode ? "Saved to Outbox" : t('help.success_title')}
        </h2>
        
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl text-sm font-bold mb-8 flex flex-col items-center gap-2 max-w-xs mx-auto animate-pulse">
           <div className="flex items-center gap-2">
             <RefreshCw size={18} className="animate-spin" />
             Live Location Sharing Active
           </div>
           <span className="font-mono text-xs bg-white/60 px-2 py-1 rounded text-blue-800 border border-blue-100">
             {data.location || "Locating..."}
           </span>
        </div>

        <p className="text-slate-800 font-medium mb-8 max-w-sm">
          {isOfflineMode 
            ? "Your report has been saved to your device. It will automatically upload to responders as soon as you connect to the internet."
            : t('help.success_desc')
          }
        </p>
        
        <div className="w-full space-y-4">
          {emergencyContactPhone && (
            <Button fullWidth onClick={handleTextContact} className="bg-slate-900 hover:bg-slate-800 text-white">
              <MessageSquare className="mr-2" size={20} />
              {t('help.text_contact')}
            </Button>
          )}
          <Button fullWidth variant="outline" onClick={() => setView('DASHBOARD')} className="border-slate-300 text-slate-900 font-bold">
            {t('help.return_dash')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => step === 1 ? setView('DASHBOARD') : prevStep()} className="p-2 -ml-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-bold text-xl text-slate-900">{t('help.title')}</h1>
          <button 
            onClick={() => setView('DASHBOARD')}
            className="p-2 -mr-2 text-slate-400 hover:text-red-600 transition-colors"
            title={t('btn.cancel')}
          >
            <X size={24} />
          </button>
        </div>
        <ProgressBar current={step} total={5} />
      </div>

      <div className="flex-1 p-6 space-y-8 animate-fade-in overflow-y-auto pb-32">
        
        {/* Step 1: Immediate Safety */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xl font-bold text-slate-900">{t('help.safe_q')}</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => updateData({ isSafe: true })}
                  className={`p-4 rounded-xl border-2 font-bold transition-all ${
                    data.isSafe === true ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {t('help.yes_safe')}
                </button>
                <button
                  onClick={() => updateData({ isSafe: false })}
                  className={`p-4 rounded-xl border-2 font-bold transition-all ${
                    data.isSafe === false ? 'border-red-600 bg-red-50 text-red-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {t('help.no_danger')}
                </button>
              </div>
            </div>

            {/* DANGER INTERCEPT */}
            {data.isSafe === false && (
              <div className="bg-red-600 text-white p-6 rounded-xl shadow-xl animate-pulse space-y-4 border-4 border-red-800">
                <div className="flex items-center gap-3">
                  <AlertOctagon size={48} className="text-white" />
                  <div>
                    <h3 className="text-xl font-extrabold uppercase tracking-wider">Immediate Danger</h3>
                    <p className="font-medium text-red-100">Do not rely solely on this app.</p>
                  </div>
                </div>
                <Button 
                  fullWidth 
                  size="xl" 
                  className="bg-white text-red-700 hover:bg-red-50 font-black text-2xl shadow-lg"
                  onClick={() => window.location.href = "tel:911"}
                >
                  CALL 911 NOW
                </Button>
                <p className="text-center text-sm font-bold opacity-80">
                  If you cannot call, continue filling this form.
                </p>
              </div>
            )}

            <div className="relative">
              <div className="flex justify-between items-center mb-1.5">
                 <label className="block text-sm font-medium text-slate-700">
                   {t('help.location')}
                 </label>
                 {isTracking && (
                   <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 animate-pulse">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> LIVE TRACKING
                   </span>
                 )}
                 {isIpFallback && (
                   <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                     <Globe size={10} /> APPROX (IP)
                   </span>
                 )}
              </div>
              
              <Input 
                placeholder={isTracking ? t('help.detecting') : t('help.manual')} 
                value={data.location || ""}
                onChange={(e) => {
                  setIsTracking(false);
                  setIsIpFallback(false);
                  updateData({ location: e.target.value });
                }}
                className={`bg-white font-mono text-sm border-slate-300 text-slate-900 font-semibold pr-24 ${
                  isTracking ? 'border-brand-500 ring-1 ring-brand-500' : 
                  isIpFallback ? 'border-amber-500 ring-1 ring-amber-500' :
                  permissionDenied ? 'border-red-500' : ''
                }`}
                error={!isTracking && !isIpFallback && !data.location && locationError && !permissionDenied ? locationError : undefined}
              />
              
              <div className="absolute right-1 top-[2.1rem]">
                <button
                  onClick={() => {
                    if (permissionDenied) {
                      // If previously denied, try IP fallback first, then try enabling GPS
                      if (!isIpFallback) fetchIpLocation();
                      else setIsTracking(true); 
                    } else {
                      setIsTracking(!isTracking);
                      if (!isTracking) setLocationError(null);
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    isTracking 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                  }`}
                >
                  {isTracking ? (
                    <>
                      <StopCircle size={14} className="animate-pulse" /> {t('help.stop_share')}
                    </>
                  ) : (
                    <>
                      <Navigation size={14} /> {t('help.use_gps')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Permission Denied Instruction Card - Only show if NO location data */}
            {permissionDenied && !data.location && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-slide-up">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-full text-red-600">
                    <Settings size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-red-900 text-sm mb-1">GPS Permission Denied</h4>
                    <p className="text-xs text-red-700 mb-3">
                      Your browser has blocked location access.
                    </p>
                    <ul className="text-xs text-slate-700 space-y-2 bg-white p-3 rounded border border-red-100">
                      <li className="flex items-start gap-2">
                        <span className="font-bold">iOS (Safari):</span> 
                        <span>Tap <span className="font-bold text-blue-600">aA</span> or <span className="font-bold text-blue-600">Lock</span> icon in URL bar &rarr; Website Settings &rarr; Location &rarr; Allow.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">Android (Chrome):</span> 
                        <span>Tap <span className="font-bold text-blue-600">Lock Icon</span> in URL bar &rarr; Permissions &rarr; Location &rarr; Allow.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">System:</span>
                        <span>Check device Settings &rarr; Privacy &rarr; Location Services &rarr; Enable for Browser.</span>
                      </li>
                    </ul>
                    <Button 
                      size="sm" 
                      onClick={() => setIsTracking(true)} 
                      className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      <RefreshCw size={14} className="mr-2"/> Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* GPS Visualizer */}
            {isTracking && gpsAccuracy !== null && (
               <div className="bg-slate-100 rounded-lg p-3 border border-slate-200 -mt-2 shadow-inner">
                 <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      {renderSignalBars(gpsAccuracy)}
                      <div>
                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider leading-none mb-0.5">
                          {getSignalText(gpsAccuracy)}
                        </p>
                        <p className="text-xs text-slate-500 font-mono leading-none">
                          ± {gpsAccuracy}m precision
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end text-[10px] text-slate-400 font-bold uppercase mb-0.5">
                        <Wifi size={10} /> Last Update
                      </div>
                      <p className="text-xs text-slate-600 font-mono font-bold leading-none">{lastLocUpdate}</p>
                    </div>
                 </div>
                 
                 {/* Weak Signal Advice */}
                 {gpsAccuracy > 50 && (
                   <div className="flex items-center gap-1.5 mt-2 bg-amber-50 p-1.5 rounded border border-amber-100">
                     <AlertTriangle size={12} className="text-amber-600" />
                     <p className="text-[10px] text-amber-700 font-bold">
                       Signal weak. Move outdoors or near windows for better precision.
                     </p>
                   </div>
                 )}
               </div>
            )}

            {isTracking && !locationError && gpsAccuracy === null && !isIpFallback && (
               <p className="text-xs text-brand-600 font-medium -mt-2 animate-pulse flex items-center gap-1">
                 <RefreshCw size={12} className="animate-spin" /> Acquiring satellite lock...
               </p>
            )}

            <div className="space-y-3">
              <label className="text-xl font-bold text-slate-900">{t('help.what_need')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'Medical', icon: <Ambulance size={24}/>, color: 'red' },
                  { id: 'Fire', icon: <Flame size={24}/>, color: 'orange' },
                  { id: 'Flood', icon: <Droplets size={24}/>, color: 'blue' },
                  { id: 'Police', icon: <Shield size={24}/>, color: 'slate' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => updateData({ emergencyType: type.id })}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      data.emergencyType === type.id 
                      ? `border-${type.color}-600 bg-${type.color}-50 text-${type.color}-900 ring-2 ring-${type.color}-600 ring-offset-1` 
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {type.icon}
                    <span className="font-bold text-lg">{type.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xl font-bold text-slate-900">{t('help.injured_q')}</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((opt) => {
                  const val = opt === 'Yes';
                  return (
                    <Button 
                      key={opt}
                      type="button"
                      variant={data.isInjured === val ? 'primary' : 'outline'}
                      onClick={() => updateData({ isInjured: val })}
                      className={`flex-1 font-bold ${data.isInjured !== val ? 'border-slate-300 text-slate-700' : ''}`}
                    >
                      {opt === 'Yes' ? 'Yes' : 'No'}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Situation Details */}
        {step === 2 && (
          <div className="space-y-6">
            <Textarea 
              label={t('help.situation')}
              placeholder="E.g. Water is rising rapidly, trapped in attic..."
              value={data.situationDescription}
              onChange={(e) => updateData({ situationDescription: e.target.value })}
              className="border-slate-300 text-slate-900"
            />

            <div className="space-y-3">
              <label className="text-lg font-bold text-slate-900">{t('help.evac_q')}</label>
              <div className="flex gap-3">
                <Button 
                   variant={data.canEvacuate === true ? 'primary' : 'outline'} 
                   onClick={() => updateData({ canEvacuate: true })}
                   className="flex-1 font-bold"
                >Yes</Button>
                <Button 
                   variant={data.canEvacuate === false ? 'danger' : 'outline'} 
                   onClick={() => updateData({ canEvacuate: false })}
                   className="flex-1 font-bold"
                >No</Button>
              </div>
            </div>

            <Input 
              type="number" 
              label={t('help.people_count')}
              min={1}
              value={data.peopleCount}
              onChange={(e) => updateData({ peopleCount: parseInt(e.target.value) })}
              className="border-slate-300 text-slate-900 font-bold"
            />

            <div className="space-y-3">
              <label className="text-lg font-bold text-slate-900">{t('help.pets_q')}</label>
              <div className="flex gap-3">
                <Button 
                   variant={data.petsPresent === true ? 'primary' : 'outline'} 
                   onClick={() => updateData({ petsPresent: true })}
                   className="flex-1 font-bold"
                >Yes</Button>
                <Button 
                   variant={data.petsPresent === false ? 'secondary' : 'outline'} 
                   onClick={() => updateData({ petsPresent: false })}
                   className="flex-1 font-bold"
                >No</Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Resources */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-slate-900">{t('help.resources_title')}</h3>
            <p className="text-slate-600 font-medium text-base">{t('help.resources_desc')}</p>
            
            {[
              { key: 'hasWater', label: 'Clean Water', icon: <Droplets size={18}/> },
              { key: 'hasFood', label: 'Food', icon: <span className="text-lg">🥫</span> },
              { key: 'hasMeds', label: 'Medications', icon: <span className="text-lg">💊</span> },
              { key: 'hasPower', label: 'Electricity', icon: <Zap size={18}/> },
              { key: 'hasPhone', label: 'Phone Service', icon: <span className="text-lg">📶</span> },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-300 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-700">{item.icon}</div>
                  <span className="font-bold text-slate-900">{item.label}</span>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => updateData({ [item.key]: true })}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      // @ts-ignore
                      data[item.key] === true ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                   >Yes</button>
                   <button 
                    onClick={() => updateData({ [item.key]: false })}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      // @ts-ignore
                      data[item.key] === false ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                   >No</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Vulnerabilities & Media */}
        {step === 4 && (
          <div className="space-y-6">
             <div className="space-y-3">
              <label className="text-lg font-bold text-slate-900">{t('help.vuln_title')}</label>
              <div className="grid grid-cols-2 gap-3">
                {['Elderly', 'Infants', 'Disabled', 'Pregnant'].map(group => (
                  <button
                    key={group}
                    onClick={() => {
                      const current = data.vulnerableGroups;
                      const next = current.includes(group) 
                        ? current.filter(g => g !== group)
                        : [...current, group];
                      updateData({ vulnerableGroups: next });
                    }}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                      data.vulnerableGroups.includes(group)
                      ? 'bg-brand-50 border-brand-500 text-brand-800'
                      : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
             </div>

             <Textarea 
               label={t('help.medical_cond')}
               placeholder="Diabetes, requires dialysis, wheelchair user..."
               value={data.medicalConditions}
               onChange={(e) => updateData({ medicalConditions: e.target.value })}
               className="border-slate-300"
             />

             <div className="space-y-3">
              <label className="text-lg font-bold text-slate-900">{t('help.upload')}</label>
              
              <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-black aspect-video relative shadow-sm">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
                />
                {!isCameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                    <Camera size={48} className="mb-2 opacity-50" />
                    <span className="text-sm font-medium">Camera is off</span>
                  </div>
                )}
              </div>

              <Button 
                type="button" 
                variant={isCameraOn ? "danger" : "secondary"} 
                onClick={toggleCamera}
                className="w-full font-bold border-slate-300"
              >
                {isCameraOn ? (
                  <>
                    <StopCircle className="mr-2" size={20} /> Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="mr-2" size={20} /> Use Camera
                  </>
                )}
              </Button>
             </div>
          </div>
        )}

        {/* Step 5: Submission */}
        {step === 5 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-slate-900">{t('help.review')}</h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 text-yellow-900 text-sm font-medium">
               <AlertOctagon className="shrink-0 text-yellow-700" size={20} />
               <p>By submitting this form, you are sharing your location and sensitive data with verified emergency responders.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-4 space-y-4 shadow-sm">
               <div className="flex justify-between border-b border-slate-100 pb-2">
                 <span className="text-slate-600 font-medium">Emergency Type</span>
                 <span className="font-bold text-slate-900">{data.emergencyType || 'Not specified'}</span>
               </div>
               <div className="flex justify-between border-b border-slate-100 pb-2">
                 <span className="text-slate-600 font-medium">People Count</span>
                 <span className="font-bold text-slate-900">{data.peopleCount}</span>
               </div>
               <div className="flex justify-between border-b border-slate-100 pb-2">
                 <span className="text-slate-600 font-medium">Injuries</span>
                 <span className="font-bold text-slate-900">{data.isInjured ? 'Yes' : 'No'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-600 font-medium">Location</span>
                 <div className="text-right">
                   <span className="block font-bold truncate max-w-[150px] font-mono text-xs text-slate-900">
                     {data.location || 'Pending...'}
                   </span>
                   {isTracking ? (
                     <div className="flex flex-col items-end">
                       <span className="text-[10px] text-green-700 font-bold flex items-center justify-end gap-1">
                         <RefreshCw size={10} className="animate-spin" /> Live
                       </span>
                       {gpsAccuracy && (
                         <span className="text-[10px] text-slate-500 font-mono">±{gpsAccuracy}m</span>
                       )}
                     </div>
                   ) : isIpFallback ? (
                     <span className="text-[10px] text-amber-600 font-bold flex items-center justify-end gap-1">
                       <Globe size={10} /> Network (Approx)
                     </span>
                   ) : (
                     <span className="text-[10px] text-slate-500 font-bold flex items-center justify-end gap-1">
                       <MapPin size={10} /> Manual/Frozen
                     </span>
                   )}
                 </div>
               </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 border border-slate-300 rounded-xl bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-400"
                  checked={data.consentToShare}
                  onChange={(e) => updateData({ consentToShare: e.target.checked })}
                />
                <span className="text-sm font-bold text-slate-800">{t('help.consent')}</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-30">
        <div className="max-w-md mx-auto flex gap-4">
          {step < 5 ? (
             <Button fullWidth onClick={nextStep} size="lg" className="font-bold text-lg">{t('btn.next')}</Button>
          ) : (
             <Button 
               fullWidth 
               size="lg" 
               disabled={!data.consentToShare || isSubmitting}
               onClick={handleSubmit}
               className="bg-red-600 hover:bg-red-700 font-bold text-lg shadow-lg shadow-red-200"
             >
               {isSubmitting ? (isOfflineMode ? 'Saving...' : 'Sending...') : (isOfflineMode ? 'Save for Sync' : t('help.submit_btn'))}
             </Button>
          )}
        </div>
      </div>
    </div>
  );
};
