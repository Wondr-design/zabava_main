"use client";

import { useEffect, useRef, useState } from "react";
import { 
  UserPlus, 
  Settings, 
  Rocket, 
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your partner account in minutes. No credit card required to get started.",
    color: "from-blue-500 to-blue-600",
  },
  {
    number: "02",
    icon: Settings,
    title: "Configure",
    description: "Set up your business profile, pricing, availability, and booking preferences.",
    color: "from-purple-500 to-purple-600",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Launch",
    description: "Go live and start accepting bookings. Your listing appears immediately.",
    color: "from-yellow-500 to-yellow-600",
  },
  {
    number: "04",
    icon: TrendingUp,
    title: "Grow",
    description: "Track performance, optimize listings, and watch your business grow.",
    color: "from-green-500 to-green-600",
  },
];

export function PremiumHowItWorks() {
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set());
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-index") || "0");
            setVisibleSteps((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.2 }
    );

    const cards = sectionRef.current?.querySelectorAll("[data-index]");
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 bg-white relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-medium">
            <Rocket className="w-4 h-4" />
            <span>Simple Process</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
            Get Started in{" "}
            <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              Minutes
            </span>
          </h2>
          <p className="text-xl text-gray-600">
            Join thousands of partners who've transformed their business with Zabava.
          </p>
        </div>

        {/* Steps */}
        <div
          ref={sectionRef}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative"
        >
          {/* Connection Line (Desktop) */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-200" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            const isVisible = visibleSteps.has(index);
            const isLast = index === steps.length - 1;

            return (
              <div key={index} className="relative">
                <Card
                  data-index={index}
                  className={cn(
                    "border-2 border-gray-100 hover:border-yellow-300 transition-all duration-300 hover:shadow-xl group relative",
                    isVisible ? "animate-fade-in-up opacity-100" : "opacity-0"
                  )}
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white font-bold text-lg shadow-lg z-10">
                    {step.number}
                  </div>

                  <CardHeader className="pt-8">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 group-hover:scale-110 transition-transform",
                        step.color
                      )}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      {step.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 text-base leading-relaxed">
                      {step.description}
                    </CardDescription>
                  </CardContent>
                </Card>

                {/* Arrow (Mobile/Tablet) */}
                {!isLast && (
                  <div className="lg:hidden absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-yellow-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">Ready to get started?</p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}

