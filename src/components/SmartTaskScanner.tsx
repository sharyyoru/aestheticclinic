"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, FileImage, X, Upload, Loader2 } from "lucide-react";

type ExtractedTask = {
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
};

type SmartTaskScannerProps = {
  onTasksExtracted: (tasks: ExtractedTask[]) => void;
};

export default function SmartTaskScanner({ onTasksExtracted }: SmartTaskScannerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzingSteps = [
    "Analyzing handwriting...",
    "Identifying action items...",
    "Structuring tasks...",
  ];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    await processFile(file);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    await processFile(file);
  }, []);

  const processFile = async (file: File) => {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload an image (JPEG, PNG, WebP, or GIF).");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Start analysis
    setIsAnalyzing(true);
    setAnalyzingStep(0);

    // Cycle through analyzing steps
    const stepInterval = setInterval(() => {
      setAnalyzingStep((prev) => (prev + 1) % analyzingSteps.length);
    }, 1500);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze-scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze image");
      }

      const data = await response.json();
      
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setPreviewImage(null);

      if (data.tasks && data.tasks.length > 0) {
        onTasksExtracted(data.tasks);
      } else {
        setError("No actionable items found in the image.");
      }
    } catch (err) {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setPreviewImage(null);
      setError(err instanceof Error ? err.message : "Failed to analyze image");
    }
  };

  const handleReset = () => {
    setPreviewImage(null);
    setIsAnalyzing(false);
    setError(null);
    setAnalyzingStep(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Smart Task Scanner</h2>
        <p className="text-sm text-slate-500">
          Upload an image of notes, whiteboard, or document to automatically extract tasks
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!isAnalyzing && !previewImage && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-2xl border-2 border-dashed p-12
                transition-all duration-300 ease-out
                ${isDragging
                  ? "border-sky-500 bg-sky-50/50 scale-[1.02]"
                  : "border-slate-300 bg-slate-50/50 hover:border-sky-400 hover:bg-slate-50"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="p-4 rounded-full bg-white shadow-sm"
                >
                  <Scan className="w-12 h-12 text-slate-400" />
                </motion.div>
                
                <div className="text-center space-y-2">
                  <p className="text-base font-medium text-slate-700">
                    {isDragging ? "Drop your image here" : "Drag & drop an image here"}
                  </p>
                  <p className="text-sm text-slate-500">or click to browse</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <FileImage className="w-4 h-4" />
                  <span>JPEG, PNG, WebP, GIF (max 10MB)</span>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        )}

        {(isAnalyzing || previewImage) && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-lg"
          >
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-64 object-cover"
              />
            )}

            {/* Scanning line animation */}
            {isAnalyzing && (
              <motion.div
                initial={{ top: 0 }}
                animate={{ top: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_20px_rgba(14,165,233,0.8)]"
              />
            )}

            {/* Overlay with analyzing status */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex flex-col items-center justify-center">
              {isAnalyzing ? (
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
                  <motion.p
                    key={analyzingStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white font-medium"
                  >
                    {analyzingSteps[analyzingStep]}
                  </motion.p>
                </div>
              ) : (
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
