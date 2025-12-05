"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function PremiumLoader() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setLoading(false), 300);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  if (!loading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] bg-gradient-to-br from-yellow-50 via-white to-yellow-50/50 flex items-center justify-center transition-opacity duration-300",
        !loading && "opacity-0 pointer-events-none"
      )}
    >
      <div className="text-center space-y-8">
        {/* Logo Animation */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center mx-auto shadow-2xl animate-scale-in">
            <span className="text-4xl font-bold text-gray-900">Z</span>
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 mx-auto blur-xl opacity-50 animate-pulse" />
        </div>

        {/* Progress Bar */}
        <div className="w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading Text */}
        <p className="text-gray-600 font-medium animate-pulse">
          Loading your experience...
        </p>
      </div>
    </div>
  );
}

