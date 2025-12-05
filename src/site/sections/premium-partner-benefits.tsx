"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const benefits = [
  "Zero setup fees or hidden costs",
  "Increase bookings by up to 40%",
  "Automated customer communication",
  "Real-time inventory management",
  "Customizable booking forms",
  "Multi-language support",
  "24/7 customer support",
  "Advanced analytics & reporting",
  "Mobile-optimized experience",
  "Secure payment processing",
  "Loyalty program integration",
  "Marketing tools & promotions",
];

const stats = [
  { value: "500+", label: "Active Partners" },
  { value: "2M+", label: "Bookings Processed" },
  { value: "40%", label: "Avg. Revenue Growth" },
  { value: "99.9%", label: "Uptime Guarantee" },
];

export function PremiumPartnerBenefits() {
  return (
    <section className="py-24 bg-gradient-to-br from-yellow-50 via-white to-gray-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Benefits */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-medium w-fit">
                <span>For Partners</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
                Grow Your Business with{" "}
                <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                  Zabava
                </span>
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Join hundreds of successful experience businesses using Zabava to streamline operations, 
                increase bookings, and delight customers.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 group"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center mt-0.5 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold px-8 shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                Become a Partner
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-8"
              >
                Schedule a Demo
              </Button>
            </div>
          </div>

          {/* Right Side - Stats Cards */}
          <div className="grid grid-cols-2 gap-6">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className={cn(
                  "border-2 border-gray-100 hover:border-yellow-300 transition-all duration-300 hover:shadow-xl text-center p-6",
                  "animate-fade-in-up"
                )}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-0 space-y-2">
                  <div className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

