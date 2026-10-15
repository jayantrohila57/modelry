"use client";

import { CheckCircle2, CreditCard, Gem, History, Loader2, Receipt, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  apiClient,
  getApiErrorMessage,
  getApiResponseData,
  type RouterOutputs,
  type UnwrapApiData,
} from "@/core/api/api.client";
import { useSession } from "@/core/auth/auth.client";
import { ApiErrorState } from "@/shared/components/feedback/api-error-state";
import Section from "@/shared/components/layout/section/section";
import Shell from "@/shared/components/layout/shell";
import { useSettingsDialog } from "@/shared/components/provider/global-modal.provider";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { PATH } from "@/shared/config/routes";
import {
  formatBillingDate,
  formatCredits,
  formatCurrency,
  formatLedgerKindLabel,
  formatPaymentEventLabel,
  formatSubscriptionStatusLabel,
} from "./billing.format";

type BillingSummary = UnwrapApiData<RouterOutputs["billing"]["summary"]>;
type BillingUsage = UnwrapApiData<RouterOutputs["billing"]["usage"]>;
type BillingOrder = UnwrapApiData<RouterOutputs["billing"]["orders"]>[number];
type BillingPayment = UnwrapApiData<RouterOutputs["billing"]["payments"]>[number];
type BillingPlan = UnwrapApiData<RouterOutputs["billing"]["plans"]>[number];
type CheckoutPayload = UnwrapApiData<RouterOutputs["billing"]["createCheckout"]>;

type RazorpayCheckoutResult = {
  razorpay_payment_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
};

declare global {
  interface Window {
    Razorpay?: new (
      options: Record<string, unknown>,
    ) => {
      open: () => void;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

async function ensureRazorpayCheckout() {
  if (window.Razorpay) return window.Razorpay;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="checkout"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "checkout";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });

  if (!window.Razorpay) {
    throw new Error("Razorpay checkout is unavailable");
  }

  return window.Razorpay;
}

function useHasMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = String(status ?? "unknown").toLowerCase();
  const variant =
    value === "active" || value === "captured" || value === "completed"
      ? "default"
      : value === "failed"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{formatSubscriptionStatusLabel(value)}</Badge>;
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Wallet;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function BillingSurfaceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

function BillingPlansGrid({
  plans,
  currentPlanCode,
  onSubscribe,
  pendingPlanCode,
  subscriptionLocked,
}: {
  plans: BillingPlan[];
  currentPlanCode?: string | null;
  onSubscribe?: (planCode: "starter" | "pro") => void;
  pendingPlanCode?: string | null;
  subscriptionLocked?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => {
        const isFree = plan.code === "free";
        const isCurrent = currentPlanCode === plan.code;
        const canCheckout = !isFree && !!onSubscribe && !subscriptionLocked;
        const isLoading = pendingPlanCode === plan.code;

        return (
          <Card
            key={plan.code}
            className={plan.highlighted ? "ring-2 ring-primary/60 shadow-lg shadow-primary/10" : ""}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlighted ? <Badge>Popular</Badge> : null}
                    {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                  </div>
                  <CardDescription>{plan.tagline}</CardDescription>
                </div>
                <Gem className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-semibold tracking-tight">
                  {formatCurrency(plan.priceCents, plan.currency)}
                </div>
                <p className="text-xs text-muted-foreground">per {plan.billingInterval}</p>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <div className="rounded-2xl border bg-muted/40 p-3">
                <div className="text-sm font-medium">{formatCredits(plan.creditsPerCycle)} credits</div>
                <div className="text-xs text-muted-foreground">available every billing cycle</div>
              </div>
              <div className="space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-3.5 text-primary" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              {isFree ? (
                <Button variant="outline" className="w-full" disabled>
                  {plan.ctaLabel}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={!canCheckout || isCurrent || isLoading}
                  onClick={() => onSubscribe?.(plan.code as "starter" | "pro")}
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isCurrent ? "Current plan" : subscriptionLocked ? "Manage current plan" : plan.ctaLabel}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function OrdersTable({ orders }: { orders: BillingOrder[] }) {
  if (orders.length === 0) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Receipt className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No billing orders yet</EmptyTitle>
          <EmptyDescription>Your subscription lifecycle entries will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <div className="font-medium">{order.plan?.name ?? order.planCode}</div>
              <div className="text-xs text-muted-foreground">{order.providerSubscriptionId ?? order.provider}</div>
            </TableCell>
            <TableCell>
              <StatusBadge status={order.status} />
            </TableCell>
            <TableCell>{formatCurrency(order.amountCents, order.currency)}</TableCell>
            <TableCell>{formatBillingDate(order.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PaymentsTable({ payments }: { payments: BillingPayment[] }) {
  if (payments.length === 0) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No payments recorded</EmptyTitle>
          <EmptyDescription>Successful and failed Razorpay payment events will show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>
              <div className="font-medium">{formatPaymentEventLabel(payment.eventType)}</div>
              <div className="text-xs text-muted-foreground">{payment.providerEventId}</div>
            </TableCell>
            <TableCell>
              <StatusBadge status={payment.status} />
            </TableCell>
            <TableCell>{formatCurrency(payment.amountCents, payment.currency)}</TableCell>
            <TableCell>{formatBillingDate(payment.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LedgerTable({ usage }: { usage: BillingUsage }) {
  if (usage.ledger.length === 0) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wallet className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No credit history yet</EmptyTitle>
          <EmptyDescription>
            Starter grants, subscription credits, refunds, and usage adjustments will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          <TableHead>Delta</TableHead>
          <TableHead>Balance after</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {usage.ledger.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>
              <div className="font-medium">{formatLedgerKindLabel(entry.kind)}</div>
              <div className="text-xs text-muted-foreground">{entry.note ?? entry.source}</div>
            </TableCell>
            <TableCell className={entry.deltaCredits >= 0 ? "text-green-600" : "text-red-600"}>
              {entry.deltaCredits >= 0 ? "+" : ""}
              {formatCredits(entry.deltaCredits)}
            </TableCell>
            <TableCell>{formatCredits(entry.balanceAfterCredits)}</TableCell>
            <TableCell>{formatBillingDate(entry.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

async function openCheckoutFlow(input: {
  payload: CheckoutPayload;
  onSuccess: (result: RazorpayCheckoutResult) => void;
  dismissMessage: string;
}) {
  const Razorpay = await ensureRazorpayCheckout();
  const checkout = new Razorpay({
    key: input.payload.keyId,
    subscription_id: input.payload.providerSubscriptionId,
    name: "Modelry",
    description: `${input.payload.planName} monthly subscription`,
    image: "/logo.png",
    handler: input.onSuccess,
    modal: {
      ondismiss: () => {
        toast.info(input.dismissMessage);
      },
    },
    prefill: input.payload.prefill,
    notes: input.payload.notes,
    theme: {
      color: "#0f172a",
    },
  });
  checkout.open();
}

function buildSuccessUrl(result: RazorpayCheckoutResult, payload: CheckoutPayload) {
  const params = new URLSearchParams({
    providerSubscriptionId: result.razorpay_subscription_id ?? payload.providerSubscriptionId,
    planName: payload.planName,
  });

  if (result.razorpay_payment_id) {
    params.set("razorpayPaymentId", result.razorpay_payment_id);
  }

  if (result.razorpay_signature) {
    params.set("razorpaySignature", result.razorpay_signature);
  }

  return `${PATH.PRICING.SUCCESS}?${params.toString()}`;
}

export function BillingSubscriptionSettings() {
  const router = useRouter();
  const { closeSettings } = useSettingsDialog();
  const utils = apiClient.useUtils();
  const { data: session } = useSession();
  const mounted = useHasMounted();
  const summaryQuery = apiClient.billing.summary.useQuery(undefined, {
    enabled: mounted && !!session,
  });
  const plansQuery = apiClient.billing.plans.useQuery(undefined, {
    enabled: mounted && !!session,
  });

  const createCheckoutMutation = apiClient.billing.createCheckout.useMutation({
    onSuccess: async (response) => {
      const payload = getApiResponseData(response);
      if (!payload) {
        toast.error(response.message || "Unable to start Razorpay checkout");
        return;
      }
      try {
        await openCheckoutFlow({
          payload,
          onSuccess: (result) => {
            closeSettings();
            window.location.assign(buildSuccessUrl(result, payload));
          },
          dismissMessage: "Checkout closed. You can retry whenever you're ready.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to start Razorpay checkout");
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const cancelSubscriptionMutation = apiClient.billing.cancelSubscription.useMutation({
    onSuccess: async () => {
      toast.success("Subscription marked for cancellation.");
      await Promise.all([
        utils.billing.summary.invalidate(),
        utils.billing.orders.invalidate(),
        utils.billing.payments.invalidate(),
        utils.viewer.session.invalidate(),
      ]);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const summary = getApiResponseData(summaryQuery.data);
  const plans = getApiResponseData(plansQuery.data);

  if (!mounted || summaryQuery.isLoading || plansQuery.isLoading) {
    return <BillingSurfaceSkeleton />;
  }

  if (summaryQuery.isError) {
    return (
      <ApiErrorState
        title="Subscription unavailable"
        message={getApiErrorMessage(summaryQuery.error, "Failed to load subscription details.")}
        onRetry={() => void summaryQuery.refetch()}
      />
    );
  }

  if (plansQuery.isError) {
    return (
      <ApiErrorState
        title="Plans unavailable"
        message={getApiErrorMessage(plansQuery.error, "Failed to load plans.")}
        onRetry={() => void plansQuery.refetch()}
      />
    );
  }

  if (!session || !summary || !plans) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CreditCard className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Sign in to manage billing</EmptyTitle>
          <EmptyDescription>Your subscription and wallet details appear after sign in.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const activeSubscription = summary.activeSubscription ?? null;

  return (
    <div className="space-y-6 p-1 w-full">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Current Plan"
          value={summary.currentPlan?.name ?? "Free"}
          description={`Status: ${formatSubscriptionStatusLabel(summary.subscriptionStatus)}`}
          icon={CreditCard}
        />
        <SummaryCard
          title="Wallet Balance"
          value={formatCredits(summary.wallet.balanceCredits)}
          description="Credits available right now"
          icon={Wallet}
        />
        <SummaryCard
          title="Renewal"
          value={formatBillingDate(summary.nextRenewalAt)}
          description="Next billing cycle date"
          icon={History}
        />
        <SummaryCard
          title="Recent Payments"
          value={String(summary.recentPayments.length)}
          description="Recent provider events tracked"
          icon={Sparkles}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription summary</CardTitle>
          <CardDescription>Manage your current plan and review the most recent billing activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{summary.currentPlan?.name ?? "Free"}</p>
                <StatusBadge status={summary.subscriptionStatus} />
              </div>
              <p className="text-sm text-muted-foreground">
                {summary.nextRenewalAt
                  ? `Current billing cycle ends on ${formatBillingDate(summary.nextRenewalAt)}`
                  : "No active recurring billing cycle yet."}
              </p>
            </div>
            {activeSubscription ? (
              <Button
                variant="outline"
                onClick={() => cancelSubscriptionMutation.mutate({ subscriptionId: activeSubscription.id })}
              >
                Cancel subscription
              </Button>
            ) : (
              <Button asChild>
                <Link href={PATH.PRICING.ROOT}>View plans</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!summary.hasPaidPlan ? (
        <BillingPlansGrid
          plans={plans}
          currentPlanCode={summary.currentPlan?.code}
          pendingPlanCode={createCheckoutMutation.variables?.planCode ?? null}
          onSubscribe={(planCode) => createCheckoutMutation.mutate({ planCode })}
          subscriptionLocked={!summary.canStartCheckout}
        />
      ) : null}
    </div>
  );
}

export function BillingUsageSettings() {
  const { data: session } = useSession();
  const mounted = useHasMounted();
  const usageQuery = apiClient.billing.usage.useQuery(undefined, {
    enabled: mounted && !!session,
  });

  const usage = getApiResponseData(usageQuery.data);

  if (!mounted || usageQuery.isLoading) {
    return <BillingSurfaceSkeleton />;
  }

  if (usageQuery.isError) {
    return (
      <ApiErrorState
        title="Usage unavailable"
        message={getApiErrorMessage(usageQuery.error, "Failed to load usage details.")}
        onRetry={() => void usageQuery.refetch()}
      />
    );
  }

  if (!session || !usage) {
    return null;
  }

  return (
    <div className="space-y-6 p-1 w-full">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Starter Credits"
          value={formatCredits(usage.breakdown.starterCreditsGranted)}
          description="Granted one time on first login"
          icon={Wallet}
        />
        <SummaryCard
          title="Subscription Credits"
          value={formatCredits(usage.breakdown.subscriptionCreditsGranted)}
          description="Granted through paid billing cycles"
          icon={CreditCard}
        />
        <SummaryCard
          title="Usage Spent"
          value={formatCredits(usage.breakdown.usageCreditsSpent)}
          description="Credits consumed by product usage"
          icon={History}
        />
        <SummaryCard
          title="Refunds"
          value={formatCredits(usage.breakdown.refundCredits)}
          description="Credits returned back to wallet"
          icon={Sparkles}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total Tokens"
          value={formatCredits(usage.analytics.totalTokens)}
          description="Prompt plus completion usage"
          icon={Sparkles}
        />
        <SummaryCard
          title="Prompt Tokens"
          value={formatCredits(usage.analytics.totalPromptTokens)}
          description="Input token volume"
          icon={Sparkles}
        />
        <SummaryCard
          title="Completion Tokens"
          value={formatCredits(usage.analytics.totalCompletionTokens)}
          description="Output token volume"
          icon={Sparkles}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credit ledger</CardTitle>
          <CardDescription>Starter grants, subscription grants, refunds, and usage adjustments.</CardDescription>
        </CardHeader>
        <CardContent>
          <LedgerTable usage={usage} />
        </CardContent>
      </Card>
    </div>
  );
}

export function BillingPaymentsSettings() {
  const { data: session } = useSession();
  const mounted = useHasMounted();
  const paymentsQuery = apiClient.billing.payments.useQuery(undefined, {
    enabled: mounted && !!session,
  });

  const payments = getApiResponseData(paymentsQuery.data);

  if (!mounted || paymentsQuery.isLoading) {
    return <BillingSurfaceSkeleton />;
  }

  if (paymentsQuery.isError) {
    return (
      <ApiErrorState
        title="Payments unavailable"
        message={getApiErrorMessage(paymentsQuery.error, "Failed to load payment history.")}
        onRetry={() => void paymentsQuery.refetch()}
      />
    );
  }

  if (!session || !payments) {
    return null;
  }

  return (
    <div className="space-y-6 p-1 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
          <CardDescription>Normalized provider payment events for your subscription lifecycle.</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={payments} />
        </CardContent>
      </Card>
    </div>
  );
}

export function BillingOrdersSettings() {
  const { data: session } = useSession();
  const mounted = useHasMounted();
  const ordersQuery = apiClient.billing.orders.useQuery(undefined, {
    enabled: mounted && !!session,
  });

  const orders = getApiResponseData(ordersQuery.data);

  if (!mounted || ordersQuery.isLoading) {
    return <BillingSurfaceSkeleton />;
  }

  if (ordersQuery.isError) {
    return (
      <ApiErrorState
        title="Orders unavailable"
        message={getApiErrorMessage(ordersQuery.error, "Failed to load order history.")}
        onRetry={() => void ordersQuery.refetch()}
      />
    );
  }

  if (!session || !orders) {
    return null;
  }

  return (
    <div className="space-y-6 p-1 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Order history</CardTitle>
          <CardDescription>
            Subscription intent and provider lifecycle records for the current customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTable orders={orders} />
        </CardContent>
      </Card>
    </div>
  );
}

export function PricingPageContent() {
  const router = useRouter();
  const { openSettings } = useSettingsDialog();
  const { data: session } = useSession();
  const mounted = useHasMounted();
  const plansQuery = apiClient.billing.plans.useQuery();
  const summaryQuery = apiClient.billing.summary.useQuery(undefined, {
    enabled: mounted && !!session,
  });

  const createCheckoutMutation = apiClient.billing.createCheckout.useMutation({
    onSuccess: async (response) => {
      const payload = getApiResponseData(response);
      if (!payload) {
        toast.error(response.message || "Unable to start Razorpay checkout");
        return;
      }
      try {
        await openCheckoutFlow({
          payload,
          onSuccess: (result) => {
            window.location.assign(buildSuccessUrl(result, payload));
          },
          dismissMessage: "Checkout closed.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to start Razorpay checkout");
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const plans = getApiResponseData(plansQuery.data);
  const summary = getApiResponseData(summaryQuery.data);
  const currentPlanCode = summary?.currentPlan?.code ?? "free";
  const action = !mounted
    ? "Checking your account state..."
    : summary?.hasPaidPlan
      ? "Manage current subscription"
      : session
        ? "View billing details"
        : "Sign in to subscribe";
  const actionLink = !mounted ? PATH.PRICING.ROOT : !session ? PATH.AUTH.SIGN_IN : PATH.PRICING.ROOT;

  return (
    <Shell>
      <Shell.Section className="flex h-full w-full flex-col items-center justify-center">
        <Section
          badge="Plans & Billing"
          title="Choose a plan that keeps the product valuable before it gets complicated."
          description="Start free, compare plans when you are ready, and manage subscription, credits, and payment history inside the app."
          action={!summary?.hasPaidPlan ? action : undefined}
          actionLink={!summary?.hasPaidPlan ? actionLink : undefined}
        >
          {summaryQuery.isError ? (
            <ApiErrorState
              title="Subscription unavailable"
              message={getApiErrorMessage(summaryQuery.error, "Failed to load your billing summary.")}
              onRetry={() => void summaryQuery.refetch()}
            />
          ) : plansQuery.isError ? (
            <ApiErrorState
              title="Plans unavailable"
              message={getApiErrorMessage(plansQuery.error, "Failed to load pricing plans.")}
              onRetry={() => void plansQuery.refetch()}
            />
          ) : summary?.hasPaidPlan ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Current subscription</CardTitle>
                <CardDescription>
                  You're already on a paid plan. Compare plans here or manage the current subscription from billing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Badge>{summary.currentPlan?.name ?? "Paid plan"}</Badge>
                <span className="text-sm text-muted-foreground">
                  Renewal: {formatBillingDate(summary.nextRenewalAt)}
                </span>
                <span className="text-sm text-muted-foreground">
                  Wallet: {formatCredits(summary.wallet.balanceCredits)} credits
                </span>
                <Button variant="outline" onClick={() => openSettings("subscription")}>
                  Manage Subscription
                </Button>
                <Button variant="ghost" onClick={() => openSettings("payments")}>
                  View Payments
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {plansQuery.isLoading || !plans ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-[420px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <BillingPlansGrid
              plans={plans}
              currentPlanCode={currentPlanCode}
              pendingPlanCode={createCheckoutMutation.variables?.planCode ?? null}
              subscriptionLocked={Boolean(summary?.hasPaidPlan)}
              onSubscribe={
                session && !summary?.hasPaidPlan ? (planCode) => createCheckoutMutation.mutate({ planCode }) : undefined
              }
            />
          )}
        </Section>
      </Shell.Section>
    </Shell>
  );
}

export function PricingSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptedRef = useRef(false);
  const { openSettings } = useSettingsDialog();
  const mounted = useHasMounted();
  const { data: session } = useSession();
  const utils = apiClient.useUtils();
  const providerSubscriptionId = searchParams.get("providerSubscriptionId") ?? "";
  const razorpayPaymentId = searchParams.get("razorpayPaymentId") ?? undefined;
  const razorpaySignature = searchParams.get("razorpaySignature") ?? undefined;
  const planName = searchParams.get("planName") ?? "your plan";

  const confirmCheckoutMutation = apiClient.billing.confirmCheckout.useMutation({
    onSuccess: async (response) => {
      const confirmed = getApiResponseData(response);
      if (!confirmed) {
        toast.error(response.message || "Verification failed");
        return;
      }
      await Promise.all([
        utils.billing.summary.invalidate(),
        utils.billing.usage.invalidate(),
        utils.billing.orders.invalidate(),
        utils.billing.payments.invalidate(),
        utils.billing.subscription.invalidate(),
        utils.viewer.session.invalidate(),
      ]);
    },
  });

  const summaryQuery = apiClient.billing.summary.useQuery(undefined, {
    enabled: mounted && !!session && confirmCheckoutMutation.isSuccess,
  });
  const summary = getApiResponseData(summaryQuery.data);

  useEffect(() => {
    if (!mounted || !session || !providerSubscriptionId || attemptedRef.current) {
      return;
    }

    attemptedRef.current = true;
    confirmCheckoutMutation.mutate({
      providerSubscriptionId,
      razorpayPaymentId,
      razorpaySignature,
    });
  }, [mounted, providerSubscriptionId, razorpayPaymentId, razorpaySignature, session, confirmCheckoutMutation]);

  if (!mounted) {
    return <BillingSurfaceSkeleton />;
  }

  if (!session) {
    return (
      <Shell>
        <Shell.Section className="flex h-full w-full flex-col items-center justify-center">
          <Section
            badge="Payment Verification"
            title="Sign in to finish verifying your payment"
            description="We need your signed-in session to attach the subscription and credits to the correct account."
            action="Sign in"
            actionLink={PATH.AUTH.SIGN_IN}
          >
            <div />
          </Section>
        </Shell.Section>
      </Shell>
    );
  }

  if (!providerSubscriptionId) {
    return (
      <Shell>
        <Shell.Section className="flex h-full w-full flex-col items-center justify-center">
          <Section
            badge="Payment Verification"
            title="Missing payment confirmation details"
            description="The checkout finished without the required subscription reference. Return to pricing and start again if needed."
            action="Back to pricing"
            actionLink={PATH.PRICING.ROOT}
          >
            <div />
          </Section>
        </Shell.Section>
      </Shell>
    );
  }

  return (
    <Shell>
      <Shell.Section className="flex h-full w-full flex-col items-center justify-center">
        <Section
          badge="Payment Verification"
          title={confirmCheckoutMutation.isSuccess ? `${planName} is now active` : `Verifying ${planName}`}
          description={
            confirmCheckoutMutation.isSuccess
              ? "Your subscription, credits, orders, and payment history have been refreshed."
              : "We are confirming the payment with Razorpay and syncing the billing state to your account."
          }
        >
          {confirmCheckoutMutation.isPending ? (
            <BillingSurfaceSkeleton />
          ) : confirmCheckoutMutation.isError ? (
            <Card>
              <CardHeader>
                <CardTitle>Verification failed</CardTitle>
                <CardDescription>
                  {getApiErrorMessage(confirmCheckoutMutation.error, "Verification failed.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button
                  onClick={() =>
                    confirmCheckoutMutation.mutate({
                      providerSubscriptionId,
                      razorpayPaymentId,
                      razorpaySignature,
                    })
                  }
                >
                  Retry verification
                </Button>
                <Button variant="outline" onClick={() => router.push(PATH.PRICING.ROOT)}>
                  Back to pricing
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-6 text-green-600" />
                    <div>
                      <CardTitle>Subscription verified successfully</CardTitle>
                      <CardDescription>
                        Your customer account is now updated with the latest billing state.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <SummaryCard
                    title="Current Plan"
                    value={summary?.currentPlan?.name ?? planName}
                    description="Active customer plan"
                    icon={CreditCard}
                  />
                  <SummaryCard
                    title="Wallet Balance"
                    value={formatCredits(summary?.wallet.balanceCredits ?? 0)}
                    description="Credits available after sync"
                    icon={Wallet}
                  />
                  <SummaryCard
                    title="Renewal"
                    value={formatBillingDate(summary?.nextRenewalAt)}
                    description="Current billing cycle date"
                    icon={History}
                  />
                </CardContent>
                <CardFooter className="flex flex-wrap gap-3">
                  <Button onClick={() => openSettings("subscription")}>Open Subscription</Button>
                  <Button variant="outline" onClick={() => openSettings("payments")}>
                    Open Payments
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href={PATH.CHAT.ROOT}>Go to Chat</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </Section>
      </Shell.Section>
    </Shell>
  );
}
