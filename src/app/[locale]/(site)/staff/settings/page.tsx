"use client";

import { SectionCard } from "@/components/design-system";

export default function StaffSettingsPage() {
  return (
    <SectionCard
      title="Staff settings"
      description="Settings are currently handled by administrators."
    >
      <p className="text-sm text-[color:var(--ds-text-muted)]">
        Please contact an administrator if you need to update your profile or access rights.
      </p>
    </SectionCard>
  );
}
