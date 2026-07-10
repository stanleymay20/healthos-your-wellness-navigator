import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openBillingPortal } from "@/lib/billing/client-actions";
import { getUserPlan, type UserPlan } from "@/services/billing";

type Props = {
  userId: string | null;
  accessToken: string | null;
};

function formatRenewal(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BillingSection({ userId, accessToken }: Props) {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getUserPlan(userId).then((p) => {
      if (!cancelled) {
        setPlan(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onManage() {
    if (!accessToken) return;
    setBusy(true);
    const res = await openBillingPortal(accessToken);
    setBusy(false);
    if (!res.ok) {
      toast.error(
        res.status === 404
          ? "You don't have a subscription yet."
          : `Couldn't open billing portal: ${res.error}`,
      );
      return;
    }
    // Redirect to the Stripe-hosted portal.
    window.location.href = res.url;
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading your plan…</p>
    );
  }

  const isPaid = !!plan && plan.plan !== "free" && plan.active;
  const label = plan?.plan ?? "free";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-medium">
            Current plan:{" "}
            <span className="capitalize">{label}</span>
          </div>
          {isPaid && plan?.currentPeriodEnd ? (
            <div className="text-xs text-muted-foreground mt-0.5">
              {plan.cancelAtPeriodEnd
                ? `Access ends ${formatRenewal(plan.currentPeriodEnd)}`
                : `Renews ${formatRenewal(plan.currentPeriodEnd)}`}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          {isPaid ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onManage}
              disabled={busy || !accessToken}
            >
              {busy ? "Opening…" : "Manage subscription"}
            </Button>
          ) : (
            <a href="/pricing" className="inline-block">
              <Button className="rounded-full">Upgrade</Button>
            </a>
          )}
        </div>
      </div>
      {plan?.cancelAtPeriodEnd ? (
        <p className="text-xs text-warning">
          Your subscription is set to cancel. You'll keep access until the end
          of the current billing period.
        </p>
      ) : null}
    </div>
  );
}
