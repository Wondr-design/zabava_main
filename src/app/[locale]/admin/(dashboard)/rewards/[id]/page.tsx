"use client";

import { useEffect, useState } from "react";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

import { RewardEditor } from "@/components/admin/rewards/reward-editor";
import type { RewardRecord } from "@/lib/data/rewards";
import { adminApi } from "@/lib/web/api-client";

type PageParams = Promise<{ id: string }>;

export default function RewardEditPage({ params }: { params: PageParams }) {
  const router = useLocalizedRouter();
  const [rewardId, setRewardId] = useState<string | null>(null);

  useEffect(() => {
    params.then((value) => setRewardId(value.id)).catch(() => {
      router.replace("/admin/rewards");
    });
  }, [params, router]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<RewardRecord | null>(null);

  useEffect(() => {
    if (!rewardId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await adminApi.rewardGet(rewardId, {});
        if (cancelled) return;
        setReward(res.reward);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load reward";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rewardId]);

  if (!rewardId || loading) {
    return <div className="px-6 py-8 text-sm text-muted-foreground">Loading reward…</div>;
  }

  if (error || !reward) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          {error ?? "Reward not found."}
        </div>
        <button
          type="button"
          onClick={() => router.push("/admin/rewards")}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
        >
          Back to rewards
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <RewardEditor
        reward={reward}
        mode="edit"
        onBack={() => router.push("/admin/rewards")}
        onSaved={(updatedId) => {
          router.replace(`/admin/rewards/${updatedId}`);
          router.refresh();
        }}
      />
    </div>
  );
}
