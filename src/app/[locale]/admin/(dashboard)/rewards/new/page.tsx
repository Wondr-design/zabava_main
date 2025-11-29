"use client";

import { useLocalizedRouter } from "@/i18n/use-localized-router";

import { RewardEditor } from "@/components/admin/rewards/reward-editor";

export default function RewardCreatePage() {
  const router = useLocalizedRouter();

  return (
    <div className="px-6 py-8">
      <RewardEditor
        reward={null}
        mode="create"
        onBack={() => router.push("/admin/rewards")}
        onSaved={(id) => router.push(id ? `/admin/rewards/${id}` : "/admin/rewards")}
      />
    </div>
  );
}
