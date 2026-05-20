"use client";

import { useEffect, useRef, useCallback } from "react";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface JarvisPulseProps {
  state: VoiceState;
  audioLevel?: number; // 0-1 for dynamic scaling
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { core: 60, ring: 100, icon: 24 },
  md: { core: 80, ring: 140, icon: 32 },
  lg: { core: 100, ring: 180, icon: 40 },
};

export function JarvisPulse({
  state,
  audioLevel = 0,
  onClick,
  disabled = false,
  size = "md",
}: JarvisPulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const config = sizeConfig[size];
  
  // Dynamic wave visualization based on audio level
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.clearRect(0, 0, width, height);
    
    if (state === "listening" || state === "speaking") {
      const time = Date.now() / 1000;
      const waveCount = 3;
      const baseRadius = config.core / 2 + 10;
      
      for (let w = 0; w < waveCount; w++) {
        const waveOffset = (w * Math.PI * 2) / waveCount;
        const amplitude = 8 + audioLevel * 15;
        
        ctx.beginPath();
        for (let angle = 0; angle <= Math.PI * 2; angle += 0.05) {
          const wave = Math.sin(angle * 6 + time * 4 + waveOffset) * amplitude;
          const radius = baseRadius + wave + w * 12;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        
        const alpha = 0.4 - w * 0.1;
        ctx.strokeStyle = state === "speaking" 
          ? `rgba(52, 211, 153, ${alpha})` 
          : `rgba(34, 211, 238, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [state, audioLevel, config.core]);
  
  useEffect(() => {
    if (state === "listening" || state === "speaking") {
      drawWaveform();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, drawWaveform]);
  
  const getStateLabel = () => {
    switch (state) {
      case "listening": return "Listening...";
      case "processing": return "Processing...";
      case "speaking": return "Speaking...";
      default: return "Tap to speak";
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pulse Container */}
      <div 
        className="jarvis-pulse-container"
        style={{ width: config.ring, height: config.ring }}
      >
        {/* Canvas for dynamic waveform */}
        <canvas
          ref={canvasRef}
          width={config.ring * 2}
          height={config.ring * 2}
          className="absolute"
          style={{ 
            width: config.ring, 
            height: config.ring,
            pointerEvents: "none",
          }}
        />
        
        {/* Concentric pulse rings - only show when listening */}
        {state === "listening" && (
          <>
            <div className="jarvis-pulse-ring" />
            <div className="jarvis-pulse-ring" />
            <div className="jarvis-pulse-ring" />
          </>
        )}
        
        {/* Core button */}
        <button
          onClick={onClick}
          disabled={disabled || state === "processing"}
          className={`jarvis-pulse-core ${state} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{ width: config.core, height: config.core }}
          aria-label={getStateLabel()}
        >
          {/* Icon based on state */}
          {state === "processing" ? (
            <div className="jarvis-wave-container text-white">
              <div className="jarvis-wave-bar" />
              <div className="jarvis-wave-bar" />
              <div className="jarvis-wave-bar" />
              <div className="jarvis-wave-bar" />
              <div className="jarvis-wave-bar" />
            </div>
          ) : state === "speaking" ? (
            <svg 
              width={config.icon} 
              height={config.icon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2}
              className="text-white"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg 
              width={config.icon} 
              height={config.icon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2}
              className="text-white"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
      </div>
      
      {/* State label */}
      <span className={`text-sm font-medium transition-colors ${
        state === "listening" ? "text-cyan-400" :
        state === "speaking" ? "text-emerald-400" :
        state === "processing" ? "text-cyan-400" :
        "text-slate-400"
      }`}>
        {getStateLabel()}
      </span>
    </div>
  );
}

// Connection telemetry badge component
interface TelemetryBadgeProps {
  state: VoiceState | "connected" | "disconnected";
}

export function TelemetryBadge({ state }: TelemetryBadgeProps) {
  const getLabel = () => {
    switch (state) {
      case "connected": return "Connected";
      case "listening": return "Listening";
      case "processing": return "Processing";
      case "speaking": return "Speaking";
      case "disconnected": return "Offline";
      default: return "Idle";
    }
  };
  
  const badgeClass = state === "disconnected" ? "idle" :
    state === "connected" ? "connected" :
    state === "listening" ? "connected" :
    state === "speaking" ? "speaking" :
    state === "processing" ? "processing" : "idle";
  
  return (
    <div className={`telemetry-badge ${badgeClass}`}>
      <span className="indicator" />
      <span>{getLabel()}</span>
    </div>
  );
}
