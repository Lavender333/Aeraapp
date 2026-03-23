
import React, { useState, useRef, useEffect } from 'react';
import { ViewState, UserRole } from '../types';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { ArrowLeft, Camera, Home, Zap, Droplets, CheckCircle, AlertTriangle, Loader2, Sparkles, X, MapPin, RefreshCw, Aperture, Keyboard, Download } from 'lucide-react';
import { t } from '../services/translations';
import { submitDamageAssessment, getAssessmentPhotoSignedUrl, listDamageAssessmentsForCurrentUser, DamageAssessmentResult, analyzeDamagePhotoOnServer } from '../services/api';
import { StorageService } from '../services/storage';
import { analyzeDamagePhoto as analyzeDamagePhotoLocally } from '../services/visionAssessment';

export const AssessmentView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const normalizeRole = (role: any): UserRole => {
    const normalized = String(role || 'GENERAL_USER').toUpperCase();
    const validRoles: UserRole[] = ['ADMIN', 'CONTRACTOR', 'LOCAL_AUTHORITY', 'FIRST_RESPONDER', 'GENERAL_USER', 'INSTITUTION_ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'MEMBER'];
    return validRoles.includes(normalized as UserRole) ? (normalized as UserRole) : 'GENERAL_USER';
  };

  const [step, setStep] = useState(1);
  const [damageType, setDamageType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<number>(1); // 1-3 (Low, Med, High)
  const [description, setDescription] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('GENERAL_USER');
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [reportedAssessments, setReportedAssessments] = useState<DamageAssessmentResult[]>([]);
  const [assessmentPhotoUrls, setAssessmentPhotoUrls] = useState<Record<string, string>>({});
  
  // Camera & Image State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedPhotoUrl, setSubmittedPhotoUrl] = useState<string | null>(null);
  const [requiresCommunityConnection, setRequiresCommunityConnection] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [roofAnswers, setRoofAnswers] = useState({
    houseFloors: 'none',
    damagedShingles: 'none',
    flashingCracked: false,
    softSpots: false,
    exposedDecking: false,
    interiorLeaks: false,
    structuralSagging: false,
  });
  const [roofScore, setRoofScore] = useState<number>(1);

  // Damage Categories
  const categories = [
    { id: 'STRUCTURAL', label: 'Structure/Roof', icon: <Home size={32} />, color: 'blue' },
    { id: 'FLOOD', label: 'Water/Flood', icon: <Droplets size={32} />, color: 'cyan' },
    { id: 'ELECTRICAL', label: 'Power/Gas', icon: <Zap size={32} />, color: 'yellow' },
  ];

  const canViewReportedResults = userRole === 'ADMIN' || userRole === 'ORG_ADMIN' || userRole === 'INSTITUTION_ADMIN';

  const roofRatingMap: Record<number, { label: string; meaning: string; action: string }> = {
    1: { label: 'Maintenance', meaning: 'Normal wear, minor debris, maybe a loose shingle.', action: 'Cleaning & tune-up.' },
    2: { label: 'Minor Repair', meaning: '1–5 shingles damaged; flashing sealant may be cracked.', action: 'Targeted repair ($500–$1,500).' },
    3: { label: 'Moderate Repair', meaning: 'Widespread wind creases or broad visible shingle damage.', action: 'Sectional replacement.' },
    4: { label: 'Significant', meaning: 'Functional damage with structural concern or widespread failure.', action: 'Full replacement likely.' },
    5: { label: 'Catastrophic', meaning: 'Exposed decking, active interior leaks, or structural sagging.', action: 'Emergency tarping & replacement.' },
  };

  const calculateRoofScore = (answers: typeof roofAnswers) => {
    let score = 1;

    if (answers.damagedShingles === '1-5' || answers.flashingCracked) score = Math.max(score, 2);
    if (answers.damagedShingles === '6-20') score = Math.max(score, 3);
    if (answers.softSpots) score = Math.max(score, 4);
    if (answers.exposedDecking || answers.interiorLeaks || answers.structuralSagging || answers.damagedShingles === '20+') score = 5;

    return score;
  };

  const mapRoofScoreToSeverity = (score: number) => {
    if (score >= 4) return 3;
    if (score === 3) return 2;
    return 1;
  };

  const isRoofingTriageComplete =
    roofAnswers.houseFloors !== 'none' &&
    roofAnswers.damagedShingles !== 'none';

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  useEffect(() => {
    const profile = StorageService.getProfile();
    setUserRole(normalizeRole(profile.role));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (damageType !== 'STRUCTURAL') return;
    const nextRoofScore = calculateRoofScore(roofAnswers);
    setRoofScore(nextRoofScore);
    setSeverity(mapRoofScoreToSeverity(nextRoofScore));
  }, [damageType, roofAnswers]);

  const loadAssessmentResults = async () => {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const data = await listDamageAssessmentsForCurrentUser(75);
      setReportedAssessments(data);

      const withPhotos = data.filter((item) => !!item.photoPath).slice(0, 20);
      if (withPhotos.length > 0) {
        const photoEntries = await Promise.all(
          withPhotos.map(async (item) => {
            try {
              const url = await getAssessmentPhotoSignedUrl(item.photoPath as string);
              return [item.id, url] as const;
            } catch {
              return [item.id, ''] as const;
            }
          })
        );

        const urlMap: Record<string, string> = {};
        photoEntries.forEach(([id, url]) => {
          if (url) urlMap[id] = url;
        });
        setAssessmentPhotoUrls(urlMap);
      } else {
        setAssessmentPhotoUrls({});
      }
    } catch (err: any) {
      setResultsError(err?.message || 'Unable to load assessment results.');
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewReportedResults) return;
    loadAssessmentResults();
  }, [canViewReportedResults]);

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

  const compressImageDataUrl = async (dataUrl: string, maxDimension = 1600, quality = 0.78): Promise<string> => {
    const image = new Image();
    image.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load image.'));
    });

    const originalWidth = image.width || 1;
    const originalHeight = image.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
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
          videoRef.current.play().catch(() => {
            // Handle play() rejection (e.g., user gesture required)
          });
        }
      }, 100);
    } catch (err) {
      console.error("Camera denied", err);
      alert("Could not access camera. Please allow permissions.");
    }
  };

  const capturePhoto = async () => {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const compressed = await compressImageDataUrl(dataUrl);
        
        // Small delay to let flash animation finish before showing static image
        setTimeout(() => {
          setCapturedImage(compressed);
          stopCameraStream();
          setIsCameraOpen(false);
          analyzeImage(compressed);
        }, 150);
      }
    }
  };

  const handleUploadPhoto: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please select an image file.');
      return;
    }

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read image file.'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImageDataUrl(dataUrl);
      setCapturedImage(compressed);
      setAiAnalysis(null);
      analyzeImage(compressed);
      setSubmitError(null);
    } catch {
      setSubmitError('Unable to process selected photo. Please try a different image.');
    } finally {
      event.target.value = '';
    }
  };

  const analyzeImage = async (imageData: string) => {
    setIsAnalyzing(true);
    try {
      let result;
      try {
        result = await analyzeDamagePhotoOnServer({
          damageType: damageType || 'ELECTRICAL',
          imageDataUrl: imageData,
        });
      } catch {
        result = await analyzeDamagePhotoLocally(imageData, damageType || 'ELECTRICAL');
      }

      const severityLabel = result.suggestedSeverity === 3 ? 'Critical' : result.suggestedSeverity === 2 ? 'Moderate' : 'Minor';
      const regionLine = result.damageRegions.length
        ? `Hotspots: ${result.damageRegions.map((r, i) => `${i + 1}) ${r.label} (${Math.round(r.score * 100)}%)`).join('; ')}`
        : 'Hotspots: none with high confidence';
      const riskLine = result.riskSignals.length ? `Risk Signals: ${result.riskSignals.join(', ')}` : 'Risk Signals: none elevated';

      const generated = [
        `AI Analysis (${result.model}): ${result.summary}`,
        `Suggested severity: ${severityLabel} (confidence ${result.confidence}%).`,
        regionLine,
        riskLine,
      ].join(' ');

      setAiAnalysis(generated);
      setSeverity((prev) => Math.max(prev, result.suggestedSeverity));
      setDescription((prev) => {
        const withoutOldAi = prev.replace(/\n*AI Analysis(?:\s*\([^)]*\))?:[\s\S]*$/i, '').trim();
        return `${withoutOldAi}${withoutOldAi ? '\n\n' : ''}${generated}`;
      });
    } catch {
      setAiAnalysis('AI Analysis: Unable to run enhanced vision analysis. You can still submit this report manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveCapturedPhoto = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `assessment-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setAiAnalysis(null);
    startCamera();
  };

  const handleSubmitAssessment = async () => {
    if (!damageType) return;
    if (damageType === 'STRUCTURAL' && !isRoofingTriageComplete) {
      setSubmitError('Complete the Roofing Triage fields before submitting this structural report.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const profile = StorageService.getProfile();
      if (!String(profile.communityId || '').trim()) {
        setRequiresCommunityConnection(true);
        setSubmitError('Connect to a community first in Settings so your report routes to your org.');
        return;
      }

      const finalDescription = (() => {
        if (damageType !== 'STRUCTURAL') return description;
        const rating = roofRatingMap[roofScore];
        const roofSummary = [
          `House Floors: ${roofAnswers.houseFloors === '3+' ? '3 or more' : roofAnswers.houseFloors}`,
          `Roof Score: ${roofScore}/5 (${rating.label})`,
          `Meaning: ${rating.meaning}`,
          `Recommended Action: ${rating.action}`,
        ].join('\n');
        const base = String(description || '').trim();
        return `${base}${base ? '\n\n' : ''}${roofSummary}`;
      })();

      setRequiresCommunityConnection(false);
      const result = await submitDamageAssessment({
        damageType,
        severity,
        description: finalDescription,
        imageDataUrl: capturedImage || null,
        communityId: profile.communityId || null,
      });
      if (result?.photo_path) {
        try {
          const signedUrl = await getAssessmentPhotoSignedUrl(result.photo_path);
          setSubmittedPhotoUrl(signedUrl);
        } catch (err) {
          setSubmittedPhotoUrl(null);
        }
      } else {
        setSubmittedPhotoUrl(null);
      }
      await loadAssessmentResults();
      setStep(3);
    } catch (err: any) {
      setRequiresCommunityConnection(false);
      setSubmitError(err?.message || 'Unable to submit assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (canViewReportedResults) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
        <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="font-bold text-lg text-slate-900">{t('dash.assess')}</h1>
                <p className="text-xs text-slate-500">Reported Assessment Results</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={loadAssessmentResults} disabled={resultsLoading}>
              <RefreshCw size={14} className="mr-1" /> Refresh
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {resultsLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-3 text-slate-600">
              <Loader2 size={18} className="animate-spin" />
              Loading reported assessments...
            </div>
          )}

          {!resultsLoading && resultsError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">
              {resultsError}
            </div>
          )}

          {!resultsLoading && !resultsError && reportedAssessments.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600">
              <AlertTriangle size={24} className="mx-auto mb-3 text-slate-400" />
              No reported assessments found yet.
            </div>
          )}

          {!resultsLoading && !resultsError && reportedAssessments.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.damageType}</p>
                  <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                  item.severity >= 3 ? 'bg-red-100 text-red-700' : item.severity === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                }`}>
                  {item.severity >= 3 ? 'Critical' : item.severity === 2 ? 'Moderate' : 'Minor'}
                </span>
              </div>

              {(item.orgName || item.orgCode) && (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Organization:</span> {item.orgName || item.orgCode}
                </p>
              )}

              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Reporter:</span> {item.reporterName}
                {item.reporterPhone ? ` • ${item.reporterPhone}` : ''}
              </p>

              {item.location && (
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <MapPin size={12} /> {item.location}
                </p>
              )}

              {item.description && (
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3">{item.description}</p>
              )}

              {assessmentPhotoUrls[item.id] && (
                <img
                  src={assessmentPhotoUrls[item.id]}
                  alt="Damage evidence"
                  className="w-full max-h-56 object-cover rounded-lg border border-slate-200"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            
            {/* Camera / Photo Section */}
            {damageType !== 'ELECTRICAL' ? (
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
                         {!isMobile ? <Keyboard size={10} className="hidden md:block" /> : null}
                         {isMobile ? 'Tap shutter to capture' : 'Click or press space'}
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
                        <div className="absolute bottom-4 right-4 flex gap-2">
                          <Button size="sm" variant="outline" onClick={saveCapturedPhoto} className="bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-lg">
                            <Download size={16} className="mr-1" /> Save
                          </Button>
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
                     <div className="flex flex-wrap gap-2 justify-center">
                       <Button onClick={startCamera} className="font-bold bg-slate-800 text-white hover:bg-slate-700">
                         <Aperture size={18} className="mr-2" /> Open Camera
                       </Button>
                       <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="font-bold">
                         Upload Photo
                       </Button>
                     </div>
                     <input
                       ref={fileInputRef}
                       type="file"
                       accept="image/*"
                       className="hidden"
                       onChange={handleUploadPhoto}
                     />
                   </div>
                 )}
               </div>

               {aiAnalysis && !isAnalyzing && (
                 <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl animate-slide-up shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold text-xs uppercase tracking-wide">
                       <Sparkles size={16} /> Computer Vision Assessment
                    </div>
                    <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                      "{aiAnalysis}"
                    </p>
                 </div>
               )}
            </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">1. Visual Evidence</label>
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-900">Photo capture is disabled for Power/Gas assessments.</p>
                  <p className="text-xs text-amber-800 mt-1">Submit details through severity and notes so teams can respond quickly.</p>
                </div>
              </div>
            )}

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

            {damageType === 'STRUCTURAL' && (
              <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
                <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">Roofing Triage (1–5)</label>
                <p className="text-xs text-slate-500">Required: House floors and Damaged shingles.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-slate-700 font-semibold">How many floors does your house have?</span>
                    <select className="w-full border border-slate-300 rounded-lg p-2" value={roofAnswers.houseFloors} onChange={(e) => setRoofAnswers((prev) => ({ ...prev, houseFloors: e.target.value }))}>
                      <option value="none">Select floors</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="3+">3 or more</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-700 font-semibold">Damaged shingles</span>
                    <select className="w-full border border-slate-300 rounded-lg p-2" value={roofAnswers.damagedShingles} onChange={(e) => setRoofAnswers((prev) => ({ ...prev, damagedShingles: e.target.value }))}>
                      <option value="none">None / unsure</option>
                      <option value="1-5">1–5 shingles</option>
                      <option value="6-20">6–20 shingles</option>
                      <option value="20+">20+ shingles / widespread</option>
                    </select>
                  </label>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {[
                    ['flashingCracked', 'Flashing or sealant cracked'],
                    ['softSpots', 'Roof soft spots (structural feel)'],
                    ['exposedDecking', 'Exposed decking visible'],
                    ['interiorLeaks', 'Active interior leaks'],
                    ['structuralSagging', 'Structural sagging'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-slate-700">{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean((roofAnswers as any)[key])}
                        onChange={(e) => setRoofAnswers((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                    </label>
                  ))}
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-xs font-bold text-indigo-800 uppercase">Roof Score</p>
                  <p className="text-lg font-black text-indigo-900">{roofScore} — {roofRatingMap[roofScore].label}</p>
                  <p className="text-xs text-indigo-900 mt-1">{roofRatingMap[roofScore].meaning}</p>
                  <p className="text-xs text-indigo-700 mt-1">Action: {roofRatingMap[roofScore].action}</p>
                </div>
                {!isRoofingTriageComplete && (
                  <p className="text-xs font-semibold text-amber-700">Please complete all required roofing triage fields to submit.</p>
                )}
              </div>
            )}

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

            <div className="sticky bottom-0 bg-slate-50 pt-3 pb-2 space-y-2">
              <Button
                fullWidth
                size="lg"
                className="shadow-lg bg-brand-600 hover:bg-brand-700 font-bold"
                onClick={handleSubmitAssessment}
                disabled={isSubmitting || (damageType === 'STRUCTURAL' && !isRoofingTriageComplete)}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
              </Button>
              {submitError && (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 font-semibold">{submitError}</p>
                  {requiresCommunityConnection && (
                    <Button size="sm" variant="outline" onClick={() => setView('SETTINGS')}>
                      Go to Settings
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col animate-fade-in min-h-[calc(100vh-220px)]">
             <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-6">
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
                 {(submittedPhotoUrl || capturedImage) && (
                   <div className="mb-4">
                     <p className="text-xs font-bold text-slate-500 uppercase mb-2">Photo Preview</p>
                     <img
                       src={submittedPhotoUrl || capturedImage || ''}
                       alt="Submitted damage"
                       className="w-full max-h-56 object-cover rounded-lg border border-slate-200"
                     />
                     {submittedPhotoUrl && (
                       <p className="text-[10px] text-slate-500 mt-1">Private link expires in 1 hour.</p>
                     )}
                   </div>
                 )}
                 <div className="flex justify-between mb-3 border-b border-slate-100 pb-2">
                   <span className="text-xs font-bold text-slate-500 uppercase">Type</span>
                   <span className="text-sm font-bold text-slate-900">{damageType}</span>
                 </div>
                 {damageType === 'STRUCTURAL' && (
                   <div className="flex justify-between mb-3 border-b border-slate-100 pb-2">
                     <span className="text-xs font-bold text-slate-500 uppercase">Roof Score</span>
                     <span className="text-sm font-bold text-slate-900">{roofScore} / 5 • {roofRatingMap[roofScore].label}</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-slate-500 uppercase">Est. Severity</span>
                   <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                     severity === 3 ? 'bg-red-100 text-red-700' : severity === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                   }`}>
                     {severity === 3 ? 'Critical' : severity === 2 ? 'Moderate' : 'Minor'}
                   </span>
                 </div>
               </div>
             </div>

             <div className="sticky bottom-0 bg-slate-50 pt-3 pb-2 space-y-2">
               <Button fullWidth variant="secondary" onClick={() => setStep(4)}>
                 View My Reports
               </Button>
               <Button fullWidth variant="outline" onClick={() => setView('DASHBOARD')} className="border-slate-300 text-slate-700 font-bold">
                 Return to Dashboard
               </Button>
             </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">My Submitted Reports</h2>
              <Button size="sm" variant="outline" onClick={loadAssessmentResults} disabled={resultsLoading}>
                <RefreshCw size={14} className="mr-1" /> Refresh
              </Button>
            </div>
            {resultsLoading && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading your reports...
              </div>
            )}
            {!resultsLoading && reportedAssessments.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                No submitted reports yet.
              </div>
            )}
            {!resultsLoading && reportedAssessments.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-bold text-slate-900">{item.damageType}</p>
                  <span className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {item.description && <p className="text-sm text-slate-700">{item.description}</p>}
                {assessmentPhotoUrls[item.id] && (
                  <img src={assessmentPhotoUrls[item.id]} alt="Submitted evidence" className="w-full max-h-52 object-cover rounded-lg border border-slate-200" />
                )}
              </div>
            ))}
            <Button fullWidth variant="outline" onClick={() => setStep(1)}>
              Submit Another Report
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};
