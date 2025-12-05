"use client";

import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Owner, Adventure Escapes",
    company: "Escape Room Network",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    rating: 5,
    text: "Zabava transformed our booking process. We've seen a 45% increase in bookings and our customers love the seamless experience. The analytics dashboard helps us make data-driven decisions.",
  },
  {
    name: "Michael Rodriguez",
    role: "Operations Manager",
    company: "Thrill Seekers Co.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    rating: 5,
    text: "The platform is incredibly intuitive. Setup took less than 30 minutes and we were accepting bookings the same day. Customer support is responsive and helpful.",
  },
  {
    name: "Emma Thompson",
    role: "Founder",
    company: "Urban Adventures",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
    rating: 5,
    text: "Zabava's loyalty program integration has been a game-changer. We've built a community of repeat customers and our retention rate has doubled. Highly recommend!",
  },
  {
    name: "David Kim",
    role: "CEO",
    company: "Experience Hub",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    rating: 5,
    text: "The best investment we've made. Revenue is up 60% since joining. The automated marketing tools save us hours every week and drive real results.",
  },
  {
    name: "Lisa Anderson",
    role: "Marketing Director",
    company: "Adventure Collective",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa",
    rating: 5,
    text: "Outstanding platform with exceptional support. The mobile optimization means our customers can book on-the-go, and we've seen a significant increase in last-minute bookings.",
  },
  {
    name: "James Wilson",
    role: "Owner",
    company: "Extreme Experiences",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
    rating: 5,
    text: "Zabava has streamlined our entire operation. From bookings to payments to customer management, everything is in one place. It's been transformational for our business.",
  },
];

export function PremiumTestimonials() {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-yellow-50/30 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-medium">
            <Star className="w-4 h-4" />
            <span>Trusted by Partners</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
            Loved by{" "}
            <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              Partners Worldwide
            </span>
          </h2>
          <p className="text-xl text-gray-600">
            See what our partners are saying about their experience with Zabava.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className={cn(
                "border-2 border-gray-100 hover:border-yellow-300 transition-all duration-300 hover:shadow-xl group",
                "animate-fade-in-up"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 space-y-4">
                {/* Quote Icon */}
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Quote className="w-5 h-5 text-yellow-600" />
                </div>

                {/* Rating */}
                <div className="flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-gray-700 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <Avatar>
                    <AvatarImage src={testimonial.image} alt={testimonial.name} />
                    <AvatarFallback>
                      {testimonial.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {testimonial.role}
                    </div>
                    <div className="text-xs text-gray-500">
                      {testimonial.company}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

