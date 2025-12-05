"use client";

import { useEffect, useRef, useState } from "react";
import { 
  BarChart3, 
  CreditCard, 
  Shield, 
  Zap, 
  Users, 
  TrendingUp,
  Smartphone,
  Globe
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track bookings, revenue, and customer engagement with comprehensive dashboards and insights.",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: CreditCard,
    title: "Seamless Payments",
    description: "Accept payments instantly with integrated payment processing. No setup fees, transparent pricing.",
    color: "from-green-500 to-green-600",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption and compliance. Your data and your customers' data are always protected.",
    color: "from-purple-500 to-purple-600",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Sub-second load times. Optimized for performance so your customers never wait.",
    color: "from-yellow-500 to-yellow-600",
  },
  {
    icon: Users,
    title: "Customer Management",
    description: "Build lasting relationships with automated loyalty programs and personalized experiences.",
    color: "from-pink-500 to-pink-600",
  },
  {
    icon: TrendingUp,
    title: "Revenue Growth",
    description: "Increase bookings by up to 40% with smart recommendations and targeted promotions.",
    color: "from-orange-500 to-orange-600",
  },
  {
    icon: Smartphone,
    title: "Mobile Optimized",
    description: "Beautiful mobile experience. Your customers can book and manage everything on any device.",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Expand your business internationally with multi-language and multi-currency support.",
    color: "from-teal-500 to-teal-600",
  },
];

export function PremiumFeatures() {
  const [visibleFeatures, setVisibleFeatures] = useState<Set<number>>(new Set());
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-index") || "0");
            setVisibleFeatures((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = sectionRef.current?.querySelectorAll("[data-index]");
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-medium">
            <Zap className="w-4 h-4" />
            <span>Everything You Need</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
            Powerful Features for{" "}
            <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              Modern Businesses
            </span>
          </h2>
          <p className="text-xl text-gray-600">
            All the tools you need to grow your experience business, all in one platform.
          </p>
        </div>

        {/* Features Grid */}
        <div
          ref={sectionRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isVisible = visibleFeatures.has(index);

            return (
              <Card
                key={index}
                data-index={index}
                className={cn(
                  "border-2 border-gray-100 hover:border-yellow-300 transition-all duration-300 hover:shadow-xl group cursor-pointer",
                  isVisible ? "animate-fade-in-up opacity-100" : "opacity-0"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4 group-hover:scale-110 transition-transform",
                      feature.color
                    )}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

