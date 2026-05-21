"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  Moon, 
  Star,
  Volume2,
  Loader2,
  Wand2,
  ChevronDown
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

const VOICES = [
  { id: "nova", label: "Nova", description: "Warm & gentle" },
  { id: "shimmer", label: "Shimmer", description: "Soft & dreamy" },
  { id: "alloy", label: "Alloy", description: "Calm & neutral" },
  { id: "echo", label: "Echo", description: "Deep & soothing" },
  { id: "fable", label: "Fable", description: "British & warm" },
  { id: "onyx", label: "Onyx", description: "Deep & rich" },
];

export default function AliiceStoryPage() {
  const [childName, setChildName] = useState("");
  const [theme, setTheme] = useState<StoryTheme>("fantasy");
  const [customPrompt, setCustomPrompt] = useState("");
  const [voice, setVoice] = useState("nova");
  
  const [story, setStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  // Update progress during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [story]);

  const generateStory = async () => {
    setIsGenerating(true);
    setError("");
    setStory("");
    
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

  const generateAudio = async () => {
    if (!story) return;
    
    setIsGeneratingAudio(true);
    setError("");
    
    try {
      const response = await fetch("/api/story/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: story, voice }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      const audioBlob = await response.blob();
      
      // Revoke previous URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
      }
    } catch (err) {
      setError("Failed to generate audio. Please try again.");
      console.error(err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 text-white overflow-hidden">
      {/* Animated stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.7 + 0.3,
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
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Narrator Voice
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoice(v.id)}
                    className={`px-4 py-2 rounded-xl text-sm transition-all text-left ${
                      voice === v.id
                        ? "bg-purple-500/50 border-2 border-purple-400"
                        : "bg-white/10 border border-white/20 hover:bg-white/20"
                    }`}
                  >
                    <div className="font-medium">{v.label}</div>
                    <div className="text-xs text-white/60">{v.description}</div>
                  </button>
                ))}
              </div>
            </div>

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
                <div className="whitespace-pre-wrap leading-relaxed text-purple-100/90 font-serif">
                  {story}
                </div>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
              <audio ref={audioRef} className="hidden" />
              
              {!audioUrlRef.current && !isGeneratingAudio && (
                <button
                  onClick={generateAudio}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25"
                >
                  <Volume2 className="w-5 h-5" />
                  Generate Audio Narration
                </button>
              )}

              {isGeneratingAudio && (
                <div className="text-center py-4">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
                  <p className="text-purple-200">Creating audio narration...</p>
                  <p className="text-purple-300/60 text-sm">This may take a moment</p>
                </div>
              )}

              {audioUrlRef.current && !isGeneratingAudio && (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div 
                    className="h-2 bg-white/20 rounded-full cursor-pointer overflow-hidden"
                    onClick={handleProgressClick}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Time */}
                  <div className="flex justify-between text-sm text-purple-300/60">
                    <span>{formatTime((progress / 100) * duration)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={restart}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={togglePlayPause}
                      className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-full transition-all shadow-lg shadow-amber-500/25"
                    >
                      {isPlaying ? (
                        <Pause className="w-7 h-7" />
                      ) : (
                        <Play className="w-7 h-7 ml-1" />
                      )}
                    </button>
                    <button
                      onClick={generateAudio}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                      title="Regenerate with different voice"
                    >
                      <Sparkles className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* New Story Button */}
            <button
              onClick={() => {
                setStory("");
                if (audioUrlRef.current) {
                  URL.revokeObjectURL(audioUrlRef.current);
                  audioUrlRef.current = null;
                }
                setProgress(0);
                setIsPlaying(false);
              }}
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
