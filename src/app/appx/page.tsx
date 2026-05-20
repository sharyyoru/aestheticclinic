"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { JarvisPulse, TelemetryBadge } from "@/components/appx/JarvisPulse";
import { ClinicalDataView, type Appointment, type Invoice, type Note } from "@/components/appx/ClinicalTable";
import { getAudioService, type VoiceState } from "@/utils/appx/audio-service";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  data?: Record<string, unknown>;
  actions?: { label: string; action: string; params?: Record<string, unknown> }[];
};

type Change = {
  id: string;
  type: "create" | "update" | "delete";
  entity: string;
  description: string;
  timestamp: number;
  data?: Record<string, unknown>;
};

type SessionStatus = "idle" | "active" | "summary";
type InputMode = "voice" | "type";

export default function AppxPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Patient selection
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isSearchingByVoice, setIsSearchingByVoice] = useState(false);
  
  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [summary, setSummary] = useState("");
  
  // Input
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  
  // Clinical data
  const [clinicalData, setClinicalData] = useState<{
    appointments: Appointment[];
    invoices: Invoice[];
    notes: Note[];
  }>({ appointments: [], invoices: [], notes: [] });
  const [showClinicalData, setShowClinicalData] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldContinueListening = useRef(false);
  const voicesLoadedRef = useRef(false);
  
  // Preload voices for TTS (important for mobile)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoadedRef.current = true;
        console.log("Voices loaded:", voices.length);
      }
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    // Workaround for mobile: trigger speech synthesis on first user interaction
    const unlockAudio = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance("");
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
      }
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
    
    document.addEventListener("touchstart", unlockAudio, { once: true });
    document.addEventListener("click", unlockAudio, { once: true });
    
    return () => {
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
  }, []);
  
  // Auth check - redirect to appx login if not authenticated
  useEffect(() => {
    let isMounted = true;
    
    async function checkAuth() {
      const { data } = await supabaseClient.auth.getSession();
      
      if (!isMounted) return;
      
      if (!data.session) {
        // Not authenticated - redirect to appx login
        router.replace("/appx/login");
        return;
      }
      
      // Get user details
      const { data: userData } = await supabaseClient.auth.getUser();
      if (!isMounted) return;
      
      if (userData?.user) {
        const meta = userData.user.user_metadata as Record<string, unknown>;
        const name = `${meta.first_name || ""} ${meta.last_name || ""}`.trim() || userData.user.email || "User";
        setUser({ id: userData.user.id, name });
      }
      
      setAuthChecked(true);
      setLoading(false);
    }
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/appx/login");
      }
    });
    
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);
  
  // Logout function
  const handleLogout = useCallback(async () => {
    await supabaseClient.auth.signOut();
    router.replace("/appx/login");
  }, [router]);
  
  // Patient search - only search when authenticated
  useEffect(() => {
    if (!authChecked || !user) {
      return;
    }
    
    if (!patientSearch.trim() || patientSearch.length < 2) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const term = patientSearch.trim();
        
        // Search patients - note: no 'mobile' column exists
        const { data, error } = await supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone, dob")
          .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(10);
        
        if (error) {
          console.error("Patient search error:", error.message, error.details);
          setPatientResults([]);
        } else {
          console.log("Patient search results:", data?.length || 0);
          setPatientResults((data as Patient[]) || []);
          if (data && data.length > 0) {
            setShowPatientDropdown(true);
          }
        }
      } catch (err) {
        console.error("Patient search catch error:", err);
        setPatientResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [patientSearch, authChecked, user]);
  
  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Store a ref to handleSubmit for use in speech recognition
  const handleSubmitRef = useRef<((query?: string) => Promise<void>) | null>(null);
  
  // Initialize speech recognition with continuous mode
  useEffect(() => {
    if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      let finalTranscript = "";
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join("");
        
        // If searching for patient by voice, update patient search
        if (isSearchingByVoice) {
          setPatientSearch(transcript);
        } else {
          setInput(transcript);
        }
        
        if (event.results[0].isFinal) {
          finalTranscript = transcript;
          setIsListening(false);
          
          if (isSearchingByVoice) {
            // Voice patient search - just set the search text, results will auto-show
            setIsSearchingByVoice(false);
            setShowPatientDropdown(true);
          } else if (finalTranscript.trim() && handleSubmitRef.current) {
            // Auto-submit after voice input is finalized
            setTimeout(() => {
              handleSubmitRef.current?.(finalTranscript.trim());
            }, 300);
          }
        }
      };
      
      recognition.onerror = () => {
        setIsListening(false);
        setIsSearchingByVoice(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        // Continue listening in voice mode if enabled (only when patient selected)
        if (shouldContinueListening.current && !isSpeaking && selectedPatient) {
          setTimeout(() => {
            if (shouldContinueListening.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
              } catch (e) {
                // Ignore - might already be running
              }
            }
          }, 500);
        }
      };
      
      recognitionRef.current = recognition;
    }
  }, [isSpeaking, isSearchingByVoice, selectedPatient]);
  
  // Start/stop continuous listening
  const startContinuousListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldContinueListening.current = true;
    setInput("");
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // Ignore - might already be running
    }
  }, []);
  
  const stopContinuousListening = useCallback(() => {
    shouldContinueListening.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);
  
  // Start voice search for patient
  const startVoicePatientSearch = useCallback(() => {
    if (!recognitionRef.current) return;
    setPatientSearch("");
    setIsSearchingByVoice(true);
    setShowPatientDropdown(false);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      setIsSearchingByVoice(false);
    }
  }, []);
  
  const toggleListening = useCallback(() => {
    if (inputMode === "voice") {
      if (isListening) {
        stopContinuousListening();
      } else {
        startContinuousListening();
      }
    } else {
      // Single tap mode for type input
      if (!recognitionRef.current) return;
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        setInput("");
        recognitionRef.current.start();
        setIsListening(true);
      }
    }
  }, [isListening, inputMode, startContinuousListening, stopContinuousListening]);
  
  const selectPatient = useCallback(async (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch("");
    setShowPatientDropdown(false);
    setSessionStatus("active");
    
    // Create session
    const { data: session } = await supabaseClient
      .from("appx_sessions")
      .insert({
        user_id: user?.id,
        patient_id: patient.id,
        status: "active",
      })
      .select("id")
      .single();
    
    if (session) {
      setSessionId(session.id);
    }
    
    // Add welcome message
    const welcomeText = `Ready to help with ${patient.first_name} ${patient.last_name}. What would you like to do?`;
    const welcomeMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `${welcomeText}\n\nYou can ask me to:\n• Show appointments, invoices, or notes\n• Check pending payments\n• Add notes or create tasks\n• Update patient information\n• And much more...`,
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
    
    // Speak welcome and start listening in voice mode
    setTimeout(() => {
      if (voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(welcomeText);
        utterance.rate = 1.0;
        utterance.onend = () => {
          setIsSpeaking(false);
          if (inputMode === "voice") {
            startContinuousListening();
          }
        };
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else if (inputMode === "type") {
        inputRef.current?.focus();
      }
    }, 100);
  }, [user?.id, voiceEnabled, inputMode, startContinuousListening]);
  
  // Text-to-speech function with continuous conversation support
  const speak = useCallback((text: string, onComplete?: () => void) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      onComplete?.();
      return;
    }
    
    // Stop listening while speaking
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean text for speech (remove markdown, emojis, special chars)
    const cleanText = text
      .replace(/[✓✗•]/g, "")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500); // Limit length
    
    if (!cleanText) {
      onComplete?.();
      return;
    }
    
    setIsSpeaking(true);
    console.log("Speaking:", cleanText.slice(0, 50) + "...");
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";
    
    // Get best available voice
    const voices = window.speechSynthesis.getVoices();
    console.log("Available voices:", voices.length);
    
    // Prefer these voices in order
    const preferredVoiceNames = ["Samantha", "Karen", "Daniel", "Google", "Microsoft", "Alex"];
    let selectedVoice = null;
    
    for (const name of preferredVoiceNames) {
      selectedVoice = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
      if (selectedVoice) break;
    }
    
    // Fallback to any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith("en"));
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log("Using voice:", selectedVoice.name);
    }
    
    utterance.onend = () => {
      console.log("Speech ended");
      setIsSpeaking(false);
      onComplete?.();
      // Resume listening if in voice mode
      if (inputMode === "voice" && shouldContinueListening.current && selectedPatient) {
        setTimeout(() => {
          if (recognitionRef.current && shouldContinueListening.current) {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch (e) {
              // Ignore
            }
          }
        }, 300);
      }
    };
    
    utterance.onerror = (e) => {
      console.error("Speech error:", e);
      setIsSpeaking(false);
      onComplete?.();
    };
    
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, isListening, inputMode, selectedPatient]);
  
  const handleSubmit = useCallback(async (directQuery?: string) => {
    const query = directQuery || input.trim();
    if (!query || !selectedPatient || isProcessing) return;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);
    
    try {
      const res = await fetch("/api/appx/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.content,
          patientId: selectedPatient.id,
          sessionId,
          context: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      const data = await res.json();
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response || "I'm sorry, I couldn't process that request.",
        timestamp: Date.now(),
        data: data.data,
        actions: data.actions,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak the response (Jarvis-like)
      speak(data.response || "I couldn't process that.");
      
      // Update patient data if changed
      if (data.updatedPatient) {
        setSelectedPatient(prev => prev ? { ...prev, ...data.updatedPatient } : null);
      }
      
      // Track executed changes
      if (data.executed?.success) {
        const newChange: Change = {
          id: crypto.randomUUID(),
          type: "update",
          entity: "patient",
          description: data.executed.message,
          timestamp: Date.now(),
        };
        setChanges(prev => [...prev, newChange]);
      }
      
      // Track legacy changes if any
      if (data.change) {
        const newChange: Change = {
          id: crypto.randomUUID(),
          ...data.change,
          timestamp: Date.now(),
        };
        setChanges(prev => [...prev, newChange]);
      }
    } catch (e) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      speak("Sorry, something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  }, [input, selectedPatient, sessionId, messages, isProcessing, speak]);
  
  // Update ref to handleSubmit for voice recognition callback
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);
  
  const executeAction = useCallback(async (action: string, params?: Record<string, unknown>) => {
    if (!selectedPatient) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch("/api/appx/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          params: { ...params, patientId: selectedPatient.id },
          sessionId,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        const successMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message || "Action completed successfully.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, successMsg]);
        
        if (data.change) {
          setChanges(prev => [...prev, { id: crypto.randomUUID(), ...data.change, timestamp: Date.now() }]);
        }
      }
    } catch {
      // Error handling
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPatient, sessionId]);
  
  const endSession = useCallback(async () => {
    if (!sessionId) return;
    
    setSessionStatus("summary");
    
    // Generate summary
    try {
      const res = await fetch("/api/appx/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          patientId: selectedPatient?.id,
          changes,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      const data = await res.json();
      setSummary(data.summary || "No changes were made during this session.");
    } catch {
      setSummary("Session ended. " + (changes.length > 0 ? `${changes.length} change(s) were made.` : "No changes were made."));
    }
  }, [sessionId, selectedPatient, changes, messages]);
  
  const confirmSession = useCallback(async (editedSummary?: string) => {
    if (!sessionId) return;
    
    await supabaseClient
      .from("appx_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        summary: editedSummary || summary,
      })
      .eq("id", sessionId);
    
    // Reset
    setSessionId(null);
    setSessionStatus("idle");
    setSelectedPatient(null);
    setMessages([]);
    setChanges([]);
    setSummary("");
  }, [sessionId, summary]);
  
  const clearPatient = useCallback(() => {
    if (changes.length > 0) {
      endSession();
    } else {
      setSelectedPatient(null);
      setMessages([]);
      setSessionStatus("idle");
      if (sessionId) {
        supabaseClient.from("appx_sessions").update({ status: "cancelled" }).eq("id", sessionId);
      }
      setSessionId(null);
    }
    // Stop any ongoing voice
    stopContinuousListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [changes.length, endSession, sessionId, stopContinuousListening]);
  
  // Start new conversation with same patient
  const startNewConversation = useCallback(async () => {
    if (!selectedPatient || !user) return;
    
    // Stop any ongoing voice
    stopContinuousListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    
    // End current session if exists
    if (sessionId) {
      await supabaseClient
        .from("appx_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    
    // Create new session
    const { data: session } = await supabaseClient
      .from("appx_sessions")
      .insert({
        user_id: user.id,
        patient_id: selectedPatient.id,
        status: "active",
      })
      .select("id")
      .single();
    
    if (session) {
      setSessionId(session.id);
    }
    
    // Reset messages
    setChanges([]);
    const welcomeText = `New conversation started for ${selectedPatient.first_name} ${selectedPatient.last_name}. How can I help?`;
    const welcomeMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: welcomeText,
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
    
    // Speak and start listening
    speak(welcomeText, () => {
      if (inputMode === "voice") {
        startContinuousListening();
      }
    });
  }, [selectedPatient, user, sessionId, stopContinuousListening, speak, inputMode, startContinuousListening]);
  
  // Show loading while checking authentication
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen jarvis-shell flex items-center justify-center">
        <div className="text-center">
          <div className="jarvis-pulse-container mb-6">
            <div className="jarvis-pulse-core idle w-16 h-16">
              <div className="jarvis-wave-container text-cyan-400">
                <div className="jarvis-wave-bar" />
                <div className="jarvis-wave-bar" />
                <div className="jarvis-wave-bar" />
              </div>
            </div>
          </div>
          <p className="text-cyan-400 text-sm font-medium">Initializing Aliice...</p>
          <p className="text-slate-500 text-xs mt-1">Medical AI Assistant</p>
        </div>
      </div>
    );
  }
  
  // This should not render as we redirect in useEffect, but just in case
  if (!user) {
    return (
      <div className="min-h-screen jarvis-shell flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Compute voice state for UI
  const computedVoiceState: VoiceState = isProcessing ? "processing" : isSpeaking ? "speaking" : isListening ? "listening" : "idle";

  return (
    <div className="min-h-screen jarvis-shell flex flex-col">
      {/* Header - Glassmorphism */}
      <header className="flex-shrink-0 px-4 py-3 jarvis-glass border-b border-slate-700/30">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image 
                src="/logos/AliiceAgent.jpg" 
                alt="Aliice" 
                width={40} 
                height={40} 
                className="rounded-full shadow-lg ring-2 ring-cyan-500/30"
              />
              {/* Status indicator dot */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                computedVoiceState === "listening" ? "bg-cyan-400 animate-pulse" :
                computedVoiceState === "speaking" ? "bg-emerald-400 animate-pulse" :
                computedVoiceState === "processing" ? "bg-amber-400 animate-pulse" :
                "bg-slate-500"
              }`} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Aliice</h1>
              <p className="text-[10px] text-cyan-400/80 font-medium">Medical AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Telemetry Badge */}
            <TelemetryBadge state={computedVoiceState === "idle" ? "connected" : computedVoiceState} />
            
            <span className="text-xs text-slate-500 hidden sm:block">|</span>
            <span className="text-xs text-slate-400 hidden sm:block">{user.name}</span>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 rounded-full transition-colors"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full overflow-hidden">
        {/* Patient Selection / Info */}
        <div className="flex-shrink-0 p-4">
          {!selectedPatient ? (
            <div className="relative">
              {/* Mode toggle for patient search */}
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center bg-slate-700/50 rounded-full p-1">
                  <button
                    onClick={() => setInputMode("voice")}
                    className={`px-4 py-2 text-sm rounded-full transition-colors ${
                      inputMode === "voice" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🎤 Voice
                  </button>
                  <button
                    onClick={() => setInputMode("type")}
                    className={`px-4 py-2 text-sm rounded-full transition-colors ${
                      inputMode === "type" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ⌨️ Type
                  </button>
                </div>
              </div>
              
              {/* Voice search UI */}
              {inputMode === "voice" ? (
                <div className="flex flex-col items-center py-6">
                  <button
                    onClick={startVoicePatientSearch}
                    disabled={isListening}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      isListening && isSearchingByVoice
                        ? "bg-red-500 animate-pulse ring-4 ring-red-500/30"
                        : "bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500"
                    }`}
                  >
                    <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  
                  <p className="mt-4 text-sm text-slate-400">
                    {isListening && isSearchingByVoice ? "Listening... Say patient name" : "Tap to search by voice"}
                  </p>
                  
                  {patientSearch && (
                    <p className="mt-2 text-white text-lg">&ldquo;{patientSearch}&rdquo;</p>
                  )}
                </div>
              ) : (
                /* Type search UI */
                <div className="relative">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    placeholder="🔍 Search patient by name, email, or phone..."
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
              
              {/* Search results dropdown */}
              {showPatientDropdown && patientResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-2xl max-h-[300px] overflow-y-auto">
                  {patientResults.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => selectPatient(patient)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                        {patient.first_name?.[0]}{patient.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {patient.email || patient.phone}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <p className="text-center text-slate-500 text-sm mt-6">
                {inputMode === "voice" ? "Say a patient name to search" : "Type to search for a patient"}
              </p>
            </div>
          ) : (
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold ring-2 ring-sky-500">
                  {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedPatient.phone || selectedPatient.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/patients/${selectedPatient.id}`}
                    target="_blank"
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                    title="Open patient profile"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                  <button
                    onClick={clearPatient}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors"
                    title="End session"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {changes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-emerald-400">
                    ✓ {changes.length} change{changes.length !== 1 ? "s" : ""} made this session
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Messages Area */}
        {sessionStatus === "active" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-sky-500 text-white rounded-br-md"
                      : "bg-slate-700/80 text-slate-100 rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  
                  {/* Data display */}
                  {msg.data && (
                    <div className="mt-3 p-3 bg-slate-800/50 rounded-xl text-xs space-y-2">
                      {Array.isArray(msg.data.items) && msg.data.items.map((item: Record<string, unknown>, idx: number) => (
                        <div key={idx} className="p-2 bg-slate-900/50 rounded-lg">
                          {Object.entries(item).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate-400">{key}:</span>
                              <span className="text-white">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => executeAction(action.action, action.params)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-full font-medium transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-sky-200" : "text-slate-500"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-700/80 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Summary Modal */}
        {sessionStatus === "summary" && (
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Session Summary
              </h2>
              
              {changes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Changes Made:</h3>
                  <div className="space-y-2">
                    {changes.map((change) => (
                      <div key={change.id} className="flex items-start gap-2 text-sm">
                        <span className="text-emerald-400">✓</span>
                        <span className="text-slate-300">{change.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mb-4">
                <label className="text-sm font-medium text-slate-400 mb-2 block">Summary:</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => confirmSession(summary)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                >
                  Confirm & Close
                </button>
                <button
                  onClick={() => setSessionStatus("active")}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Idle state */}
        {sessionStatus === "idle" && !selectedPatient && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Welcome, {user.name.split(" ")[0]}</h2>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">
                Search for a patient above to start managing their records with AI assistance.
              </p>
            </div>
          </div>
        )}
      </main>
      
      {/* Input Bar - Jarvis Glass */}
      {selectedPatient && sessionStatus === "active" && (
        <div className="flex-shrink-0 p-4 jarvis-glass border-t border-slate-700/30">
          <div className="max-w-lg mx-auto">
            {/* Mode toggle & New conversation */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center bg-slate-800/60 rounded-full p-1 border border-slate-700/50">
                <button
                  onClick={() => { setInputMode("voice"); stopContinuousListening(); }}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all font-medium ${
                    inputMode === "voice" 
                      ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🎤 Voice
                </button>
                <button
                  onClick={() => { setInputMode("type"); stopContinuousListening(); }}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all font-medium ${
                    inputMode === "type" 
                      ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⌨️ Type
                </button>
              </div>
              <button
                onClick={startNewConversation}
                className="px-3 py-1.5 text-xs text-cyan-400 hover:text-white hover:bg-cyan-500/20 rounded-full transition-colors border border-cyan-500/30"
              >
                + New Chat
              </button>
            </div>
            
            {/* Voice Mode UI - Jarvis Pulse */}
            {inputMode === "voice" ? (
              <div className="flex flex-col items-center py-6">
                {/* Jarvis Pulse Component */}
                <JarvisPulse
                  state={computedVoiceState}
                  audioLevel={audioLevel}
                  onClick={toggleListening}
                  disabled={isProcessing}
                  size="lg"
                />
                
                {/* Show transcript */}
                {input && (
                  <div className="mt-4 px-4 py-2 jarvis-glass rounded-xl max-w-xs">
                    <p className="text-cyan-400 text-sm text-center">&ldquo;{input}&rdquo;</p>
                  </div>
                )}
              </div>
            ) : (
              /* Type Mode UI */
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleListening}
                  disabled={isProcessing}
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? "bg-red-500 animate-pulse"
                      : "bg-slate-700 hover:bg-slate-600"
                  } disabled:opacity-50`}
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder={isListening ? "Listening..." : "Type your request..."}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  />
                </div>
                
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isProcessing}
                  className="flex-shrink-0 w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-sky-500"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Quick actions - Jarvis style */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                { label: "📅 Appointments", cmd: "Show appointments" },
                { label: "💳 Invoices", cmd: "Pending invoices" },
                { label: "📝 Add Note", cmd: "Add note" },
                { label: "📊 Records", cmd: "Show medical records" },
              ].map((item) => (
                <button
                  key={item.cmd}
                  onClick={() => handleSubmit(item.cmd)}
                  disabled={isProcessing || isSpeaking}
                  className="jarvis-action-card px-3 py-2 text-xs font-medium text-slate-300 hover:text-cyan-400 disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
