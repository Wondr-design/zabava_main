# Public Website Components Documentation

This document lists all components used on the public website, their file locations, and where they are being used.

---

## Core Site Components (`src/site/`)

### 1. **SiteNav**
- **File Path**: `src/site/components/site-nav.tsx`
- **Description**: Sticky navigation header with language switcher
- **Used In**:
  - `src/app/[locale]/(public-website)/page.tsx` (Home page)
  - `src/app/[locale]/partners/page.tsx` (Partners directory)
  - `src/app/[locale]/partners/[slug]/page.tsx` (Partner detail page)
  - `src/app/[locale]/partners/[slug]/book/page.tsx` (Booking page)
  - `src/app/[locale]/(public-website)/categories/[slug]/page.tsx` (Category page)
  - `src/app/[locale]/(public-website)/special-flash-deals/page.tsx` (Special deals listing)
  - `src/app/[locale]/(public-website)/special-flash-deals/[slug]/page.tsx` (Deal detail page)
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)
  - `src/app/[locale]/(public-website)/bonus/page.tsx` (Bonus page)

### 2. **HomeHero**
- **File Path**: `src/site/sections/home-hero.tsx`
- **Description**: Hero section with category cards and animated gradient background
- **Used In**:
  - `src/app/[locale]/(public-website)/page.tsx` (Home page)

### 3. **FeaturedPartners**
- **File Path**: `src/site/partners/featured-partners.tsx`
- **Description**: Featured partner cards grid with hover effects
- **Used In**:
  - `src/app/[locale]/(public-website)/page.tsx` (Home page)
  - `src/app/[locale]/(public-website)/categories/[slug]/page.tsx` (Category page)

### 4. **HomeReviews**
- **File Path**: `src/site/sections/home-reviews.tsx`
- **Description**: Testimonials/reviews section with grid layout
- **Used In**:
  - `src/app/[locale]/(public-website)/page.tsx` (Home page)

### 5. **HomeFaq**
- **File Path**: `src/site/sections/home-faq.tsx`
- **Description**: FAQ accordion section using HTML `<details>` element
- **Used In**:
  - `src/app/[locale]/(public-website)/page.tsx` (Home page)

### 6. **PartnerDirectory**
- **File Path**: `src/site/partners/partner-directory.tsx`
- **Description**: Partner listing with search functionality and category filters
- **Used In**:
  - `src/app/[locale]/partners/page.tsx` (Partners directory page)

### 7. **PartnerGallery**
- **File Path**: `src/site/partners/partner-gallery.tsx`
- **Description**: Image gallery carousel using Swiper library
- **Used In**:
  - `src/app/[locale]/partners/[slug]/page.tsx` (Partner detail page)

### 8. **QrPreviewCard**
- **File Path**: `src/site/components/qr-preview-card.tsx`
- **Description**: QR code preview and download card component
- **Used In**:
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)
  - `src/site/forms/partner-form-runner.tsx` (Partner form runner)

### 9. **EmailVerification**
- **File Path**: `src/site/components/email-verification.tsx`
- **Description**: Email verification form component with code input
- **Used In**:
  - `src/site/forms/partner-form-runner.tsx` (Partner form runner)
  - `src/app/[locale]/(public-website)/bonus/page.tsx` (Bonus page)
  - `src/components/auth/reset-password-panel.tsx` (Password reset)
  - `src/app/[locale]/staff/signup/page.tsx` (Staff signup)
  - `src/app/[locale]/partner/signup/page.tsx` (Partner signup)
  - `src/app/[locale]/admin/(auth)/signup/page.tsx` (Admin signup)

### 10. **PartnerFormRunner**
- **File Path**: `src/site/forms/partner-form-runner.tsx`
- **Description**: Partner booking form runner with validation
- **Used In**:
  - `src/app/[locale]/partners/[slug]/book/page.tsx` (Booking page)
  - `src/app/[locale]/(public-website)/special-flash-deals/[slug]/page.tsx` (Deal detail page)

### 11. **RewardRedemptionRunner**
- **File Path**: `src/site/forms/reward-redemption-runner.tsx`
- **Description**: Reward redemption form runner
- **Used In**:
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)

---

## UI Components (`src/components/ui/`)

### 12. **LocalizedLink**
- **File Path**: `src/components/ui/localized-link.tsx`
- **Description**: Localized navigation links that preserve locale
- **Used In**:
  - `src/site/components/site-nav.tsx` (Site navigation)
  - `src/app/[locale]/partners/[slug]/page.tsx` (Partner detail page)
  - `src/app/[locale]/partners/[slug]/book/page.tsx` (Booking page)
  - `src/app/[locale]/(public-website)/categories/[slug]/page.tsx` (Category page)
  - `src/app/[locale]/(public-website)/special-flash-deals/page.tsx` (Special deals listing)
  - `src/app/[locale]/(public-website)/special-flash-deals/[slug]/page.tsx` (Deal detail page)
  - `src/site/partners/featured-partners.tsx` (Featured partners)
  - `src/site/partners/partner-directory.tsx` (Partner directory)
  - `src/site/sections/home-hero.tsx` (Home hero)
  - `src/site/forms/partner-form-runner.tsx` (Partner form runner)
  - Multiple admin and partner dashboard pages

### 13. **Button**
- **File Path**: `src/components/ui/button.tsx`
- **Description**: Button component from shadcn/ui
- **Used In**:
  - `src/site/components/qr-preview-card.tsx` (QR preview card)
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)
  - `src/app/[locale]/(public-website)/bonus/page.tsx` (Bonus page)
  - Multiple admin dashboard pages

### 14. **Input**
- **File Path**: `src/components/ui/input.tsx`
- **Description**: Text input field component
- **Used In**:
  - `src/site/partners/partner-directory.tsx` (Partner directory search)
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)
  - Multiple admin dashboard pages

### 15. **Textarea**
- **File Path**: `src/components/ui/textarea.tsx`
- **Description**: Textarea input component
- **Used In**:
  - `src/site/forms/partner-form-runner.tsx` (Partner form runner)
  - `src/site/forms/reward-redemption-runner.tsx` (Reward redemption runner)
  - Multiple admin dashboard pages

### 16. **Badge**
- **File Path**: `src/components/ui/badge.tsx`
- **Description**: Badge component for labels and status indicators
- **Used In**:
  - `src/app/[locale]/(public-website)/special-flash-deals/page.tsx` (Special deals listing)
  - `src/app/[locale]/(public-website)/special-flash-deals/[slug]/page.tsx` (Deal detail page)
  - Multiple admin dashboard pages

### 17. **Separator**
- **File Path**: `src/components/ui/separator.tsx`
- **Description**: Separator/divider component
- **Used In**:
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)
  - Multiple admin dashboard pages

### 18. **Select**
- **File Path**: `src/components/ui/select.tsx`
- **Description**: Select dropdown component
- **Used In**:
  - `src/app/[locale]/(public-website)/bonus/share/[token]/bonus-share-client.tsx` (Bonus share page)
  - Multiple admin dashboard pages

---

## Design System Components (`src/components/design-system/`)

### 19. **DesignButton**
- **File Path**: `src/components/design-system/button.tsx`
- **Description**: Design system button component
- **Used In**:
  - `src/site/components/email-verification.tsx` (Email verification)

### 20. **DesignInput**
- **File Path**: `src/components/design-system/input.tsx`
- **Description**: Design system input component
- **Used In**:
  - `src/site/components/email-verification.tsx` (Email verification)

### 21. **DesignFormField**
- **File Path**: `src/components/design-system/form-field.tsx`
- **Description**: Design system form field wrapper
- **Used In**:
  - `src/site/components/email-verification.tsx` (Email verification)

---

## CMS Components

### 22. **CmsRenderer**
- **File Path**: `src/components/cms/cms-renderer.tsx`
- **Description**: CMS content renderer for dynamic content blocks
- **Used In**:
  - `src/app/[locale]/(public-website)/special-flash-deals/page.tsx` (Special deals listing)
  - `src/app/[locale]/(public-website)/faq/page.tsx` (FAQ page)
  - `src/app/[locale]/(public-website)/reviews/page.tsx` (Reviews page)
  - `src/app/[locale]/(public-website)/privacy/page.tsx` (Privacy page)

---

## Third-Party Libraries

### 23. **Framer Motion**
- **Package**: `framer-motion`
- **Components Used**: `motion`, `Variants`
- **Used In**:
  - `src/site/sections/home-hero.tsx` (Home hero animations)
  - `src/site/partners/featured-partners.tsx` (Partner cards animations)

### 24. **Swiper**
- **Package**: `swiper/react`
- **Components Used**: `Swiper`, `SwiperSlide`
- **Used In**:
  - `src/site/partners/partner-gallery.tsx` (Partner gallery carousel)

### 25. **Lucide React Icons**
- **Package**: `lucide-react`
- **Icons Used**:
  - `ArrowRight` - Used in: `home-hero.tsx`, `featured-partners.tsx`
  - `MapPin` - Used in: `featured-partners.tsx`
  - `Star` - Used in: `featured-partners.tsx`
  - `ChevronLeft` - Used in: `partner-gallery.tsx`
  - `ChevronRight` - Used in: `partner-gallery.tsx`
  - `QrCode` - Used in: `qr-preview-card.tsx`
  - `Loader2` - Used in: `email-verification.tsx`, `bonus-share-client.tsx`
  - `ShieldCheck` - Used in: `email-verification.tsx`
  - `CalendarDays` - Used in: `bonus-share-client.tsx`
  - `Clock` - Used in: `bonus-share-client.tsx`
  - `Copy` - Used in: `bonus-share-client.tsx`
  - `Gift` - Used in: `bonus-share-client.tsx`

---

## Next.js Built-in Components

### 26. **Image**
- **Package**: `next/image`
- **Used In**:
  - `src/site/partners/featured-partners.tsx` (Partner images)
  - `src/site/partners/partner-directory.tsx` (Partner images)
  - `src/site/partners/partner-gallery.tsx` (Gallery images)
  - `src/site/components/qr-preview-card.tsx` (QR code images)
  - `src/app/[locale]/partners/[slug]/page.tsx` (Partner detail images)
  - `src/app/[locale]/(public-website)/special-flash-deals/page.tsx` (Deal images)

### 27. **Link**
- **Package**: `next/link`
- **Used In**:
  - `src/app/[locale]/partners/[slug]/page.tsx` (Partner detail page links)

### 28. **Suspense**
- **Package**: `react` (via Next.js)
- **Used In**:
  - `src/app/[locale]/(public-website)/page.tsx` (Home page - wraps FeaturedPartners)

---

## Component Usage by Page

### Home Page (`/`)
- `SiteNav`
- `HomeHero`
- `FeaturedPartners` (wrapped in Suspense)
- `HomeReviews`
- `HomeFaq`

### Partners Directory (`/partners`)
- `SiteNav`
- `PartnerDirectory`

### Partner Detail (`/partners/[slug]`)
- `SiteNav`
- `PartnerGallery`
- `LocalizedLink`
- `Image`
- `Link`

### Partner Booking (`/partners/[slug]/book`)
- `SiteNav`
- `PartnerFormRunner`
- `LocalizedLink`

### Category Page (`/categories/[slug]`)
- `SiteNav`
- `FeaturedPartners`
- `LocalizedLink`

### Special Flash Deals Listing (`/special-flash-deals`)
- `SiteNav`
- `Badge`
- `LocalizedLink`
- `CmsRenderer`
- `Image`

### Special Flash Deal Detail (`/special-flash-deals/[slug]`)
- `SiteNav`
- `Badge`
- `LocalizedLink`
- `PartnerFormRunner`

### Bonus Share (`/bonus/share/[token]`)
- `SiteNav`
- `QrPreviewCard`
- `RewardRedemptionRunner`
- `Button`
- `Input`
- `Separator`
- `Select`

### Bonus Page (`/bonus`)
- `SiteNav`
- `EmailVerification`
- `Button`

### FAQ Page (`/faq`)
- `CmsRenderer`

### Reviews Page (`/reviews`)
- `CmsRenderer`

### Privacy Page (`/privacy`)
- `CmsRenderer`

---

## Summary Statistics

- **Total Custom Components**: 22
- **UI Library Components**: 7 (shadcn/ui)
- **Third-Party Libraries**: 2 (Framer Motion, Swiper)
- **Icon Library**: Lucide React (11+ icons)
- **Next.js Components**: 3 (Image, Link, Suspense)

---

## Notes

- All public site components use a dark theme with slate-950 background
- Gradient accents use violet/indigo/purple color scheme
- Glassmorphism effects (backdrop-blur, semi-transparent backgrounds) are used throughout
- Components are responsive and mobile-first
- All interactive elements have minimum 44px touch targets for accessibility
- Animations use Framer Motion for smooth transitions

---

*Last Updated: January 2025*

