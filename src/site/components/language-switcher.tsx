"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";
import { useLocale } from "@/i18n/provider";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  onLocaleChange?: (locale: Locale) => void;
  className?: string;
}

const sizeConfig = {
  sm: {
    button: "h-8 w-8",
    icon: "h-4 w-4",
    badge: "text-[10px] px-1.5 py-0.5",
  },
  md: {
    button: "h-10 w-10",
    icon: "h-5 w-5",
    badge: "text-xs px-2 py-0.5",
  },
  lg: {
    button: "h-12 w-12",
    icon: "h-6 w-6",
    badge: "text-sm px-2.5 py-1",
  },
};

export function LanguageSwitcher({
  size = "md",
  showBadge = true,
  onLocaleChange,
  className,
}: LanguageSwitcherProps) {
  const currentLocale = useLocale();
  const [isPressed, setIsPressed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [accentFlash, setAccentFlash] = useState(false);
  const prevLocaleRef = useRef(currentLocale);
  const shouldReduceMotion = useReducedMotion();

  const altLocale = locales.find((loc) => loc !== currentLocale) || locales[0];
  const config = sizeConfig[size];

  // Trigger rotation and accent flash when locale changes
  useEffect(() => {
    if (prevLocaleRef.current !== currentLocale) {
      if (!shouldReduceMotion) {
        setRotation((prev) => prev + 120);
      }
      setAccentFlash(true);
      setTimeout(() => setAccentFlash(false), 300);
      prevLocaleRef.current = currentLocale;
    }
  }, [currentLocale, shouldReduceMotion]);

  const handleClick = useCallback(() => {
    if (onLocaleChange) {
      onLocaleChange(altLocale);
    }
  }, [altLocale, onLocaleChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const localeLabel = currentLocale.toUpperCase();

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={cn(
        "relative flex items-center justify-center rounded-full",
        "bg-muted/70 dark:bg-muted/70",
        "border border-border",
        "text-foreground/80",
        "cursor-pointer",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        config.button,
        className
      )}
      whileHover={
        shouldReduceMotion
          ? {}
          : {
              scale: 1.03,
              y: -1,
              transition: { duration: 0.15, ease: "easeOut" },
            }
      }
      whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
      animate={{
        scale: isPressed && !shouldReduceMotion ? 0.97 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      style={{
        backgroundColor: accentFlash ? "rgba(251, 191, 36, 0.2)" : undefined,
      }}
      aria-label={`Switch language to ${altLocale.toUpperCase()}`}
    >
      {/* Globe Icon with Rotation */}
      <motion.div
        animate={
          shouldReduceMotion
            ? {}
            : {
                rotate: rotation,
              }
        }
        transition={{
          duration: 0.25,
          ease: "easeOut",
        }}
        className="relative"
      >
        <motion.div
          whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <Globe
            className={cn(
              config.icon,
              "text-foreground/80 transition-colors duration-200",
              accentFlash && "text-[#fbbf24]"
            )}
          />
        </motion.div>
      </motion.div>

      {/* Language Badge */}
      {showBadge && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentLocale}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{
              duration: shouldReduceMotion ? 0.12 : 0.2,
              ease: "easeOut",
            }}
            className={cn(
              "absolute -bottom-1 -right-1",
              "rounded-full",
              "bg-primary/90 dark:bg-primary/90",
              "text-primary-foreground dark:text-primary-foreground",
              "font-semibold uppercase tracking-wider",
              "shadow-sm",
              "z-10",
              config.badge
            )}
          >
            {localeLabel}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Hover Shadow Effect */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        initial={false}
        animate={{
          boxShadow: isPressed
            ? "0 1px 2px rgba(0, 0, 0, 0.1)"
            : "0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)",
        }}
        transition={{ duration: 0.15 }}
      />
    </motion.button>
  );
}

