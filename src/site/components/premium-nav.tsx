"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LocalizedLink } from "@/components/ui/localized-link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/partners", label: "Partners" },
  { href: "/special-flash-deals", label: "Deals" },
  { href: "/faq", label: "FAQ" },
  { href: "/reviews", label: "Reviews" },
];

export function PremiumNav() {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.endsWith("/");
    return pathname.includes(href);
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200"
          : "bg-transparent"
      )}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <LocalizedLink
            href="/"
            className="flex items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-gray-900 font-bold text-xl">Z</span>
            </div>
            <span
              className={cn(
                "text-2xl font-bold transition-colors",
                scrolled ? "text-gray-900" : "text-white"
              )}
            >
              Zabava
            </span>
          </LocalizedLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <LocalizedLink
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive(item.href)
                    ? scrolled
                      ? "bg-yellow-500 text-gray-900"
                      : "bg-white/20 text-white"
                    : scrolled
                    ? "text-gray-700 hover:bg-gray-100"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                {item.label}
              </LocalizedLink>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <Button
              variant="ghost"
              className={cn(
                "font-medium",
                scrolled ? "text-gray-700" : "text-white"
              )}
            >
              Sign In
            </Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Get Started
            </Button>
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  scrolled ? "text-gray-900" : "text-white"
                )}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-white">
              <div className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <LocalizedLink
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-yellow-500 text-gray-900"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {item.label}
                  </LocalizedLink>
                ))}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-700"
                  >
                    Sign In
                  </Button>
                  <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold">
                    Get Started
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

