"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Moon, 
  Star,
  Volume2,
  Loader2,
  Wand2,
  Square,
  VolumeX
} from "lucide-react";

type StoryTheme = "adventure" | "fantasy" | "animals" | "space" | "ocean" | "friendship";

const THEMES: { id: StoryTheme; label: string; emoji: string }[] = [
  { id: "adventure", label: "Adventure", emoji: "🗺️" },
  { id: "fantasy", label: "Fantasy", emoji: "🧚" },
  { id: "animals", label: "Animals", emoji: "🦊" },
  { id: "space", label: "Space", emoji: "🚀" },
  { id: "ocean", label: "Ocean", emoji: "🐋" },
  { id: "friendship", label: "Friendship", emoji: "💫" },
];

export default function AliiceStoryPage() {
  const [childName, setChildName] = useState("");
  const [theme, setTheme] = useState<StoryTheme>("fantasy");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  
  const [story, setStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSpeechSupported(false);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith("en"));
      setAvailableVoices(englishVoices.length > 0 ? englishVoices.slice(0, 8) : voices.slice(0, 8));
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const generateStory = async () => {
    setIsGenerating(true);
    setError("");
    setStory("");
    stopSpeech();
    
    try {
      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: childName || "little one",
          theme,
          customPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate story");
      }

      const data = await response.json();
      setStory(data.story);
    } catch (err) {
      setError("Failed to generate story. Please try again.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const startSpeech = () => {
    if (!story || !speechSupported) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(story);
    utterance.rate = 0.85; // Slower for bedtime
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    if (availableVoices[selectedVoiceIndex]) {
      utterance.voice = availableVoices[selectedVoiceIndex];
    }
    
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const resumeSpeech = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const togglePlayPause = () => {
    if (!isPlaying) {
      startSpeech();
    } else if (isPaused) {
      resumeSpeech();
    } else {
      pauseSpeech();
    }
  };

  const resetStory = () => {
    stopSpeech();
    setStory("");
  };

  // Generate stable star positions
  const [stars] = useState(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      opacity: Math.random() * 0.7 + 0.3,
    }))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 text-white overflow-hidden">
      {/* Animated stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.delay}s`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* Moon */}
      <div className="fixed top-10 right-10 w-24 h-24 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full opacity-80 blur-sm" />
      <div className="fixed top-10 right-10 w-24 h-24 bg-gradient-to-br from-amber-50 to-amber-100 rounded-full opacity-90" />

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Moon className="w-8 h-8 text-amber-200" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Aliice Story
            </h1>
            <Star className="w-6 h-6 text-amber-200" />
          </div>
          <p className="text-purple-200/80 text-lg">
            Magical bedtime stories, just for you ✨
          </p>
        </div>

        {/* Story Configuration */}
        {!story && (
          <div className="space-y-6 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
            {/* Child's Name */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Child&apos;s Name (optional)
              </label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Enter name..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>

            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Story Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      theme === t.id
                        ? "bg-purple-500/50 border-2 border-purple-400 text-white"
                        : "bg-white/10 border border-white/20 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <span className="ml-2">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Special Request (optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Include a friendly dragon named Sparky..."
                rows={3}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none"
              />
            </div>

            {/* Voice Selection */}
            {speechSupported && availableVoices.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Narrator Voice
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableVoices.slice(0, 6).map((v, idx) => (
                    <button
                      key={v.name}
                      onClick={() => setSelectedVoiceIndex(idx)}
                      className={`px-4 py-2 rounded-xl text-sm transition-all text-left ${
                        selectedVoiceIndex === idx
                          ? "bg-purple-500/50 border-2 border-purple-400"
                          : "bg-white/10 border border-white/20 hover:bg-white/20"
                      }`}
                    >
                      <div className="font-medium truncate">{v.name.replace("Microsoft ", "").replace("Google ", "").split(" ")[0]}</div>
                      <div className="text-xs text-white/60">{v.lang}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={generateStory}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating your story...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Create Bedtime Story
                </>
              )}
            </button>

            {!speechSupported && (
              <p className="text-amber-400/80 text-center text-sm">
                ⚠️ Text-to-speech is not supported in your browser
              </p>
            )}

            {error && (
              <p className="text-red-400 text-center">{error}</p>
            )}
          </div>
        )}

        {/* Story Display */}
        {story && (
          <div className="space-y-6">
            {/* Story Text */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
              <div className="prose prose-invert prose-lg max-w-none">
                <div className="whitespace-pre-wrap leading-relaxed text-purple-100/90 font-serif text-lg">
                  {story}
                </div>
              </div>
            </div>

            {/* Audio Controls */}
            {speechSupported && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={stopSpeech}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                    title="Stop"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-full transition-all shadow-lg shadow-amber-500/25"
                  >
                    {isPlaying && !isPaused ? (
                      <Pause className="w-7 h-7" />
                    ) : (
                      <Play className="w-7 h-7 ml-1" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      stopSpeech();
                      startSpeech();
                    }}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                    title="Restart"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
                
                {isPlaying && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-purple-200/60">
                    <Volume2 className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">{isPaused ? "Paused" : "Reading story..."}</span>
                  </div>
                )}

                {/* Voice selector when story is showing */}
                {availableVoices.length > 0 && !isPlaying && (
                  <div className="mt-4">
                    <select
                      value={selectedVoiceIndex}
                      onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      {availableVoices.map((v, idx) => (
                        <option key={v.name} value={idx} className="bg-slate-800">
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* New Story Button */}
            <button
              onClick={resetStory}
              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium flex items-center justify-center gap-2 transition-all border border-white/20"
            >
              <Wand2 className="w-4 h-4" />
              Create Another Story
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-purple-300/40 text-sm">
          Made with 💜 by Aliice
        </div>
      </div>
    </div>
  );
}
