"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

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
  mobile: string | null;
  avatar_url: string | null;
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
  
  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [summary, setSummary] = useState("");
  
  // Input
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
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
  
  // Patient search
  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 2) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const term = patientSearch.trim().toLowerCase();
        const words = term.split(/\s+/).filter(w => w.length >= 2);
        
        let query = supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone, mobile, avatar_url, dob")
          .limit(10);
        
        if (words.length >= 2) {
          for (const word of words) {
            query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`);
          }
        } else {
          query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,mobile.ilike.%${term}%`);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error("Patient search error:", error);
          setPatientResults([]);
        } else {
          setPatientResults((data as Patient[]) || []);
          if (data && data.length > 0) {
            setShowPatientDropdown(true);
          }
        }
      } catch (err) {
        console.error("Patient search error:", err);
        setPatientResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [patientSearch]);
  
  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Store a ref to handleSubmit for use in speech recognition
  const handleSubmitRef = useRef<((query?: string) => Promise<void>) | null>(null);
  
  // Initialize speech recognition
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
        setInput(transcript);
        
        if (event.results[0].isFinal) {
          finalTranscript = transcript;
          setIsListening(false);
          // Auto-submit after voice input is finalized
          if (finalTranscript.trim() && handleSubmitRef.current) {
            setTimeout(() => {
              handleSubmitRef.current?.(finalTranscript.trim());
            }, 300);
          }
        }
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);
  
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);
  
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
    const welcomeMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Ready to help with ${patient.first_name} ${patient.last_name}. What would you like to do?\n\nYou can ask me to:\n• Show appointments, invoices, or notes\n• Check pending payments\n• Add notes or create tasks\n• Update patient information\n• And much more...`,
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
    
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [user?.id]);
  
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
      
      // Track changes if any
      if (data.change) {
        const newChange: Change = {
          id: crypto.randomUUID(),
          ...data.change,
          timestamp: Date.now(),
        };
        setChanges(prev => [...prev, newChange]);
        
        // Update session
        if (sessionId) {
          await supabaseClient
            .from("appx_sessions")
            .update({
              commands: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
              changes: [...changes, newChange],
            })
            .eq("id", sessionId);
        }
      }
    } catch (e) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, selectedPatient, sessionId, messages, changes, isProcessing]);
  
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
  }, [changes.length, endSession, sessionId]);
  
  // Show loading while checking authentication
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Checking your session...</p>
        </div>
      </div>
    );
  }
  
  // This should not render as we redirect in useEffect, but just in case
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Aliice Assistant</h1>
              <p className="text-[10px] text-slate-400">Aesthetics Clinic</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">{user.name}</span>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
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
              
              {showPatientDropdown && patientResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-2xl max-h-[300px] overflow-y-auto">
                  {patientResults.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => selectPatient(patient)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 transition-colors text-left"
                    >
                      {patient.avatar_url ? (
                        <img src={patient.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                          {patient.first_name?.[0]}{patient.last_name?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {patient.email || patient.phone || patient.mobile}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <p className="text-center text-slate-500 text-sm mt-6">
                Select a patient to start your session
              </p>
            </div>
          ) : (
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                {selectedPatient.avatar_url ? (
                  <img src={selectedPatient.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-sky-500" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold ring-2 ring-sky-500">
                    {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedPatient.phone || selectedPatient.mobile || selectedPatient.email}
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
      
      {/* Input Bar */}
      {selectedPatient && sessionStatus === "active" && (
        <div className="flex-shrink-0 p-4 bg-slate-800/50 backdrop-blur-xl border-t border-slate-700/50">
          <div className="max-w-lg mx-auto">
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
                  placeholder={isListening ? "Listening..." : "Type or speak your request..."}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 pr-12"
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
            
            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {["Show appointments", "Pending invoices", "Add note", "Recent activity"].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleSubmit(cmd)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600 text-slate-300 text-xs rounded-full transition-colors disabled:opacity-50"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
