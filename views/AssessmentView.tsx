
import React, { useState, useRef, useEffect } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { ArrowLeft, Camera, Home, Zap, Droplets, Triangle, CheckCircle, AlertTriangle, Loader2, Sparkles, X, MapPin, RefreshCw, Aperture, Keyboard } from 'lucide-react';
import { t } from '../services/translations';
import { GoogleGenAI } from "../services/mockGenAI";
import { submitDamageAssessment } from '../services/api';

// Mock AI Analysis for demo purposes (since we can't upload real files in this env)
const MOCK_AI_RESPONSE = "Analysis: Detected significant shingle loss on approximately 40% of the visible roof surface. Potential water intrusion points identified near the chimney. Estimated Severity: High.";

export const AssessmentView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [step, setStep] = useState(1);
  const [damageType, setDamageType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<number>(1); // 1-3 (Low, Med, High)
  const [description, setDescription] = useState('');
  
  // Camera & Image State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Damage Categories
  const categories = [
    { id: 'STRUCTURAL', label: 'Structure/Roof', icon: <Home size={32} />, color: 'blue' },
    { id: 'FLOOD', label: 'Water/Flood', icon: <Droplets size={32} />, color: 'cyan' },
    { id: 'ELECTRICAL', label: 'Power/Gas', icon: <Zap size={32} />, color: 'yellow' },
    { id: 'ACCESS', label: 'Blocked Road', icon: <Triangle size={32} />, color: 'orange' },
  ];

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Keyboard listener for Spacebar/Enter to snap photo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCameraOpen && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        capturePhoto();
      }
    };

    if (isCameraOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCameraOpen]);

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    setCapturedImage(null);
    setAiAnalysis(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setIsCameraOpen(true);
      // Small delay to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera denied", err);
      alert("Could not access camera. Please allow permissions.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Ensure video is ready
      if (video.readyState < 2) return;

      // Visual Flash Effect
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
      
      // Set canvas size to match video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to image
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Small delay to let flash animation finish before showing static image
        setTimeout(() => {
          setCapturedImage(dataUrl);
          stopCameraStream();
          setIsCameraOpen(false);
          analyzeImage(dataUrl);
        }, 150);
      }
    }
  };

  const analyzeImage = (imageData: string) => {
    setIsAnalyzing(true);
    // Simulate AI Analysis delay
    setTimeout(() => {
      setIsAnalyzing(false);
      setAiAnalysis(MOCK_AI_RESPONSE);
      setDescription(prev => prev + (prev ? '\n\n' : '') + MOCK_AI_RESPONSE);
      setSeverity(3); // AI detected High severity
    }, 2500);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setAiAnalysis(null);
    startCamera();
  };

  const handleSubmitAssessment = async () => {
    if (!damageType) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitDamageAssessment({
        damageType,
        severity,
        description,
        imageDataUrl: capturedImage || null,
      });
      setStep(3);
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to submit assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => step === 1 ? setView('DASHBOARD') : setStep(1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-slate-900">{t('dash.assess')}</h1>
            <p className="text-xs text-slate-500">Damage Reporting Assistant</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900 mb-2">What was damaged?</h2>
              <p className="text-slate-600 text-sm">Select the category that best describes the issue.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setDamageType(cat.id);
                    setStep(2);
                  }}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all hover:scale-[1.02] active:scale-95 ${
                    damageType === cat.id 
                      ? `border-${cat.color}-500 bg-${cat.color}-50 text-${cat.color}-900 shadow-md` 
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-3 rounded-full ${damageType === cat.id ? 'bg-white' : 'bg-slate-100'}`}>
                    {cat.icon}
                  </div>
                  <span className="font-bold">{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex gap-3 items-start">
               <Sparkles className="text-purple-600 shrink-0 mt-1" size={20} />
               <div>
                 <h3 className="font-bold text-purple-900 text-sm">AI Assisted Mode</h3>
                 <p className="text-xs text-purple-700 mt-1">Take a photo in the next step, and our AI will automatically assess the severity and type of damage for you.</p>
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            
            {/* Camera / Photo Section */}
            <div className="space-y-3">
               <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">1. Visual Evidence</label>
               
               <div className="border-2 border-slate-300 rounded-xl bg-black min-h-[240px] relative overflow-hidden shadow-sm">
                 {/* Hidden Canvas for Capture */}
                 <canvas ref={canvasRef} className="hidden" />
                 
                 {/* Flash Overlay */}
                 {flash && <div className="absolute inset-0 bg-white z-50 transition-opacity duration-150 ease-out" />}

                 {isCameraOpen ? (
                   <div className="relative w-full h-full flex flex-col items-center justify-center bg-black group">
                     <video 
                       ref={videoRef} 
                       autoPlay 
                       playsInline 
                       muted
                       onClick={capturePhoto}
                       className="w-full h-full object-cover absolute inset-0 cursor-pointer"
                     />
                     
                     <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation(); // Prevent double triggering from video onClick
                           capturePhoto();
                         }}
                         className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg pointer-events-auto"
                         title="Take Photo (Spacebar)"
                       >
                         <div className="w-12 h-12 bg-red-600 rounded-full"></div>
                       </button>
                     </div>
                     
                     <div className="absolute top-4 right-4 z-10 pointer-events-none">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           stopCameraStream(); 
                           setIsCameraOpen(false); 
                         }} 
                         className="bg-black/50 text-white p-2 rounded-full backdrop-blur pointer-events-auto hover:bg-black/70"
                       >
                         <X size={20} />
                       </button>
                     </div>
                     
                     <div className="absolute top-4 left-4 z-10 pointer-events-none">
                       <span className="bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur font-bold uppercase flex items-center gap-1">
                         <Keyboard size={10} className="hidden md:block" /> Click or Press Space
                       </span>
                     </div>
                   </div>
                 ) : capturedImage ? (
                   <div className="relative w-full h-full">
                     <img src={capturedImage} alt="Damage Evidence" className="w-full h-full object-cover" />
                     {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                          <Loader2 size={48} className="animate-spin mb-3 text-brand-400" />
                          <span className="font-bold text-lg animate-pulse">AI Analyzing Structure...</span>
                        </div>
                     )}
                     {!isAnalyzing && (
                        <div className="absolute bottom-4 right-4">
                          <Button size="sm" onClick={retakePhoto} className="bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-lg">
                            <RefreshCw size={16} className="mr-2" /> Retake
                          </Button>
                        </div>
                     )}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-60 bg-slate-100 text-slate-400">
                     <Camera size={48} className="mb-3 opacity-50" />
                     <p className="font-bold text-slate-600">No Evidence Added</p>
                     <p className="text-xs mb-4">Photos help prioritize your claim</p>
                     <Button onClick={startCamera} className="font-bold bg-slate-800 text-white hover:bg-slate-700">
                       <Aperture size={18} className="mr-2" /> Open Camera
                     </Button>
                   </div>
                 )}
               </div>

               {aiAnalysis && !isAnalyzing && (
                 <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl animate-slide-up shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold text-xs uppercase tracking-wide">
                      <Sparkles size={16} /> Gemini AI Assessment
                    </div>
                    <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                      "{aiAnalysis}"
                    </p>
                 </div>
               )}
            </div>

            {/* Severity Slider */}
            <div className="space-y-3">
               <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">2. Severity Level</label>
               <div className="flex gap-2">
                 {[
                   { lvl: 1, label: 'Minor', color: 'green' },
                   { lvl: 2, label: 'Moderate', color: 'yellow' },
                   { lvl: 3, label: 'Severe', color: 'red' }
                 ].map((opt) => (
                   <button
                     key={opt.lvl}
                     onClick={() => setSeverity(opt.lvl)}
                     className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                       severity === opt.lvl 
                         ? `bg-${opt.color}-100 border-${opt.color}-500 text-${opt.color}-800 shadow-sm ring-1 ring-${opt.color}-500` 
                         : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                     }`}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
               <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">3. Details</label>
               <Textarea 
                 placeholder="Add additional notes here..." 
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="min-h-[100px] border-slate-300 focus:border-brand-500"
               />
            </div>

            <Button
              fullWidth
              size="lg"
              className="shadow-lg mt-4 bg-brand-600 hover:bg-brand-700 font-bold"
              onClick={handleSubmitAssessment}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
            </Button>
            {submitError && (
              <p className="text-xs text-red-600 font-semibold mt-2">{submitError}</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center text-center space-y-6 animate-fade-in pt-10">
             <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2 shadow-inner">
               <CheckCircle size={48} />
             </div>
             <div>
               <h2 className="text-2xl font-bold text-slate-900">Report Filed</h2>
               <p className="text-slate-600 font-medium">Your damage assessment has been logged.</p>
             </div>
             
             <div className="bg-white p-6 rounded-xl w-full text-left border border-slate-200 shadow-sm">
               <div className="flex justify-between mb-3 border-b border-slate-100 pb-2">
                 <span className="text-xs font-bold text-slate-500 uppercase">Case ID</span>
                 <span className="text-xs font-mono font-bold text-slate-900">DMG-{Math.floor(Math.random()*10000)}</span>
               </div>
               <div className="flex justify-between mb-3 border-b border-slate-100 pb-2">
                 <span className="text-xs font-bold text-slate-500 uppercase">Type</span>
                 <span className="text-sm font-bold text-slate-900">{damageType}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-xs font-bold text-slate-500 uppercase">Est. Severity</span>
                 <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                   severity === 3 ? 'bg-red-100 text-red-700' : severity === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                 }`}>
                   {severity === 3 ? 'Critical' : severity === 2 ? 'Moderate' : 'Minor'}
                 </span>
               </div>
             </div>

             <Button fullWidth variant="outline" onClick={() => setView('DASHBOARD')} className="border-slate-300 text-slate-700 font-bold">
               Return to Dashboard
             </Button>
          </div>
        )}

      </div>
    </div>
  );
};
