import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Reward {
  id: string;
  imageUrl: string | null;
  pointsCost: number;
  partnerName: string;
  name: string;
  category?: string | null;
  partnerLogoUrl?: string | null;
  limitStatus?: string;
  canRedeem?: boolean;
  isAvailable?: boolean;
  onRedeem: () => void;
  loading?: boolean;
}

export function GlassContentCard({ reward }: { reward: Reward }) {
  const partnerInitials = reward.partnerName
    .split(/\s+/)
    .map((segment) => segment.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const limitBlocked = reward.limitStatus && reward.limitStatus !== "available";
  const isActionable =
    reward.canRedeem && !limitBlocked && reward.isAvailable !== false;

  return (
    <div className="relative group">
      <div className="relative">
        {/* Background Image Layer with subtle gradient */}
        <div className="h-96 rounded-3xl overflow-hidden shadow-lg bg-slate-900">
          {reward.imageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={reward.imageUrl}
                alt={reward.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60"></div>
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <span className="text-slate-600 text-4xl font-bold opacity-20">
                {partnerInitials}
              </span>
            </div>
          )}
        </div>

        {/* Floating Content Card with glassmorphic styling */}
        <div className="absolute -bottom-8 left-4 right-4 sm:left-6 sm:right-6 transform group-hover:-translate-y-2 transition-transform duration-300">
          <div className="w-full rounded-3xl bg-slate-950/50 backdrop-blur-md border border-white/10 shadow-2xl">
            <div className="p-6 w-full">
              {/* Category Tag at Top - Tag text size: text-xs */}
              {reward.category && (
                <div className="mb-4">
                  <span className="inline-block bg-white/10 text-white/90 text-xs px-3 py-1 rounded-full backdrop-blur-sm border border-white/10 uppercase tracking-wider font-medium">
                    {reward.category}
                  </span>
                </div>
              )}

              {/* Partner Logo Box, Name, Title, and Points */}
              <div className="flex items-start gap-4 mb-4 pb-4 border-b border-white/10">
                <div className="w-10 h-10 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-400/20 overflow-hidden relative">
                  {reward.partnerLogoUrl ? (
                    <Image
                      src={reward.partnerLogoUrl}
                      alt={reward.partnerName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-black font-bold text-sm">
                      {partnerInitials}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-amber-300 text-[10px] sm:text-xs uppercase tracking-widest mb-1 font-bold truncate">
                    {reward.partnerName}
                  </p>
                  <h3 className="text-white leading-tight text-[15px] sm:text-[16px] font-semibold">
                    {reward.name}
                  </h3>
                </div>

                {/* Points Div */}
                <div className="bg-white/10 border border-white/10 rounded-lg px-1 py-1 flex flex-row items-center justify-center flex-shrink-0 shadow-sm min-w-[60px]">
                  <span className="text-white font-bold text-sm">
                    {reward.pointsCost.toLocaleString()}
                  </span>
                  <span className="text-slate-300 text-[8px] uppercase tracking-wide">
                    pts
                  </span>
                </div>
              </div>

              {/* Redeem Button */}
              <button
                onClick={reward.onRedeem}
                disabled={!isActionable || reward.loading}
                className={cn(
                  "w-full py-3 rounded-xl transition-all duration-300 font-bold text-sm uppercase tracking-wide shadow-lg",
                  isActionable
                    ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-black hover:shadow-amber-500/25 hover:brightness-110"
                    : "bg-slate-800/50 text-slate-400 cursor-not-allowed border border-white/5"
                )}
              >
                {reward.loading
                  ? "Processing..."
                  : limitBlocked
                    ? "Unavailable"
                    : !reward.canRedeem
                      ? "Need more points"
                      : "Redeem Now"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="h-10"></div>
    </div>
  );
}
