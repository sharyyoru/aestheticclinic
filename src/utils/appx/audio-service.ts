/**
 * Medical Jarvis Audio Service
 * Handles ambient voice pipeline with full-duplex communication
 * 
 * Features:
 * - Continuous ambient listening
 * - Real-time audio level monitoring
 * - Interruptible speech synthesis
 * - WebSocket-ready for Retell AI integration
 */

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export interface AudioEngineHook {
  onStateChange: (state: VoiceState) => void;
  onSpeechStart: () => void;
  onSpeechEnd: (transcript: string) => void;
  onAiReplyStart: () => void;
  onAiReplyEnd: () => void;
  onAudioLevel: (level: number) => void;
  onError: (error: string) => void;
}

// Use browser's native SpeechRecognition type via any for cross-browser compatibility
/* eslint-disable @typescript-eslint/no-explicit-any */
type BrowserSpeechRecognition = any;

export class AmbientAudioService {
  private recognition: BrowserSpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  
  private state: VoiceState = "idle";
  private hooks: AudioEngineHook | null = null;
  private isAmbientMode: boolean = false;
  private shouldResumeListening: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;
  private voicesLoaded: boolean = false;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  
  constructor() {
    if (typeof window === "undefined") return;
    
    // Initialize Speech Recognition
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.setupRecognitionHandlers();
    }
    
    // Initialize Speech Synthesis
    if ("speechSynthesis" in window) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
      this.synthesis.onvoiceschanged = () => this.loadVoices();
    }
  }
  
  private loadVoices(): void {
    if (!this.synthesis) return;
    
    const voices = this.synthesis.getVoices();
    if (voices.length === 0) return;
    
    this.voicesLoaded = true;
    
    // Prefer high-quality voices in order
    const preferredNames = ["Samantha", "Karen", "Daniel", "Moira", "Alex", "Google", "Microsoft"];
    
    for (const name of preferredNames) {
      const voice = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
      if (voice) {
        this.preferredVoice = voice;
        console.log("[AudioService] Selected voice:", voice.name);
        break;
      }
    }
    
    // Fallback to any English voice
    if (!this.preferredVoice) {
      this.preferredVoice = voices.find(v => v.lang.startsWith("en")) || null;
    }
  }
  
  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;
    
    let finalTranscript = "";
    
    this.recognition.onstart = () => {
      this.setState("listening");
      this.hooks?.onSpeechStart();
      this.startAudioLevelMonitoring();
    };
    
    this.recognition.onresult = (event: any) => {
      const results = event.results;
      let transcript = "";
      
      for (let i = 0; i < results.length; i++) {
        transcript += results[i][0].transcript;
      }
      
      if (results[results.length - 1].isFinal) {
        finalTranscript = transcript;
      }
    };
    
    this.recognition.onspeechend = () => {
      // Speech has ended, will process in onend
    };
    
    this.recognition.onend = () => {
      this.stopAudioLevelMonitoring();
      
      if (finalTranscript.trim()) {
        this.hooks?.onSpeechEnd(finalTranscript.trim());
        finalTranscript = "";
      }
      
      // Auto-resume in ambient mode if not speaking
      if (this.isAmbientMode && this.state !== "speaking" && this.state !== "processing") {
        setTimeout(() => {
          if (this.isAmbientMode && this.state === "idle") {
            this.startListening();
          }
        }, 300);
      } else {
        this.setState("idle");
      }
    };
    
    this.recognition.onerror = (event: Event) => {
      const errorEvent = event as Event & { error?: string };
      const errorType = errorEvent.error || "unknown";
      
      // Don't treat "no-speech" as critical error in ambient mode
      if (errorType === "no-speech" && this.isAmbientMode) {
        // Just restart listening
        setTimeout(() => {
          if (this.isAmbientMode) {
            this.startListening();
          }
        }, 500);
        return;
      }
      
      // Handle aborted (user interrupted)
      if (errorType === "aborted") {
        return;
      }
      
      this.hooks?.onError(`Speech recognition error: ${errorType}`);
      this.setState("idle");
    };
  }
  
  private async startAudioLevelMonitoring(): Promise<void> {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.audioLevelInterval = setInterval(() => {
        if (!this.analyser) return;
        
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1);
        
        this.hooks?.onAudioLevel(normalizedLevel);
      }, 50);
    } catch (err) {
      console.warn("[AudioService] Could not start audio monitoring:", err);
    }
  }
  
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
    
    this.hooks?.onAudioLevel(0);
  }
  
  private setState(newState: VoiceState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.hooks?.onStateChange(newState);
    }
  }
  
  // Public API
  
  setHooks(hooks: AudioEngineHook): void {
    this.hooks = hooks;
  }
  
  getState(): VoiceState {
    return this.state;
  }
  
  isSupported(): boolean {
    return !!(this.recognition && this.synthesis);
  }
  
  startListening(): void {
    if (!this.recognition) {
      this.hooks?.onError("Speech recognition not supported");
      return;
    }
    
    if (this.state === "speaking") {
      this.shouldResumeListening = true;
      return;
    }
    
    try {
      this.recognition.start();
    } catch (err) {
      // May already be running
      console.warn("[AudioService] Start listening error:", err);
    }
  }
  
  stopListening(): void {
    this.shouldResumeListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        // May not be running
      }
    }
    
    this.stopAudioLevelMonitoring();
    this.setState("idle");
  }
  
  enableAmbientMode(): void {
    this.isAmbientMode = true;
    this.startListening();
  }
  
  disableAmbientMode(): void {
    this.isAmbientMode = false;
    this.stopListening();
  }
  
  isAmbientEnabled(): boolean {
    return this.isAmbientMode;
  }
  
  speak(text: string, onComplete?: () => void): void {
    if (!this.synthesis) {
      onComplete?.();
      return;
    }
    
    // Stop any ongoing speech
    this.interruptSpeech();
    
    // Stop listening while speaking
    if (this.recognition && this.state === "listening") {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    
    // Clean text for speech
    const cleanText = text
      .replace(/[✓✗•]/g, "")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    
    if (!cleanText) {
      onComplete?.();
      return;
    }
    
    this.setState("speaking");
    this.hooks?.onAiReplyStart();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";
    
    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }
    
    utterance.onend = () => {
      this.currentUtterance = null;
      this.setState("idle");
      this.hooks?.onAiReplyEnd();
      onComplete?.();
      
      // Resume listening if in ambient mode
      if (this.isAmbientMode || this.shouldResumeListening) {
        this.shouldResumeListening = false;
        setTimeout(() => this.startListening(), 200);
      }
    };
    
    utterance.onerror = () => {
      this.currentUtterance = null;
      this.setState("idle");
      this.hooks?.onAiReplyEnd();
      onComplete?.();
    };
    
    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }
  
  interruptSpeech(): void {
    if (!this.synthesis) return;
    
    this.synthesis.cancel();
    this.currentUtterance = null;
    
    if (this.state === "speaking") {
      this.setState("idle");
      this.hooks?.onAiReplyEnd();
    }
  }
  
  setProcessing(): void {
    this.setState("processing");
  }
  
  destroy(): void {
    this.disableAmbientMode();
    this.stopAudioLevelMonitoring();
    this.interruptSpeech();
    
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.onstart = null;
    }
  }
}

// Singleton instance
let audioServiceInstance: AmbientAudioService | null = null;

export function getAudioService(): AmbientAudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = new AmbientAudioService();
  }
  return audioServiceInstance;
}

// React hook for using the audio service
export function useAudioServiceHooks(
  onTranscript: (transcript: string) => void,
  onStateChange: (state: VoiceState) => void,
  onAudioLevel?: (level: number) => void
): void {
  if (typeof window === "undefined") return;
  
  const service = getAudioService();
  
  service.setHooks({
    onStateChange,
    onSpeechStart: () => {},
    onSpeechEnd: onTranscript,
    onAiReplyStart: () => {},
    onAiReplyEnd: () => {},
    onAudioLevel: onAudioLevel || (() => {}),
    onError: (err) => console.error("[AudioService]", err),
  });
}
