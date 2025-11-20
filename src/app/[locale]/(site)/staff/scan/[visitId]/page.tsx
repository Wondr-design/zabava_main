import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { StaffVisitEditor } from "@/components/staff/staff-visit-editor";
import { StaffBonusRedemptionView } from "@/components/staff/bonus-redemption-view";
import { getVisitById } from "@/lib/data/visits";
import { getPartnerFormById, type PartnerFormConfig } from "@/lib/data/partner-forms";
import { verifyJwt } from "@/lib/auth/jwt";
import { getRedemptionByCode } from "@/lib/data/redemptions";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

type StaffScanPageContext = {
  params: Promise<{ locale: string; visitId: string }>;
  searchParams: Promise<{ email?: string }>;
};

interface JwtPayload {
  role?: string;
  partnerId?: string;
  staffId?: string;
}

export default async function StaffScanPage({ params }: StaffScanPageContext) {
  const { visitId, locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const loginPath = buildLocalizedPath("/staff/login", locale);
  const visit = await getVisitById(visitId);
  if (!visit) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("zabava_token")?.value ?? "";

  if (!token) {
    redirect(loginPath);
  }

  let payload: JwtPayload | null = null;
  try {
    payload = verifyJwt<JwtPayload>(token);
  } catch {
    redirect(loginPath);
  }

  if (!payload || (payload.role !== "staff" && payload.role !== "admin")) {
    redirect(loginPath);
  }

  if (
    payload.role === "staff" &&
    payload.partnerId &&
    visit.partner_id &&
    payload.partnerId.toLowerCase() !== visit.partner_id.toLowerCase()
  ) {
    notFound();
  }

  if (visit.status === "visited" || visit.visited_at) {
    notFound();
  }

  if ((visit as { qr_type?: string }).qr_type === "bonus") {
    const redemption = visit.redemption_code
      ? await getRedemptionByCode(visit.redemption_code).catch(() => null)
      : null;
    if (
      redemption &&
      ["used", "rejected"].includes((redemption.status ?? "").toLowerCase())
    ) {
      notFound();
    }
    return (
      <main className="theme-staff min-h-screen bg-[color:var(--ds-surface-base)] px-4 pb-16 pt-10 text-[color:var(--ds-text-strong)] sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              Bonus redemption
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {visit.email}
            </h1>
            <p className="text-sm text-[color:var(--ds-text-muted)]">
              Review the bonus form submission and confirm the redemption below.
            </p>
          </section>

          <StaffBonusRedemptionView visit={visit} redemption={redemption} />
        </div>
      </main>
    );
  }

  const options = await deriveStaffVisitOptions(visit.payload ?? {});

  return (
    <main className="theme-staff min-h-screen bg-[color:var(--ds-surface-base)] px-4 pb-16 pt-10 text-[color:var(--ds-text-strong)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
            Visit scan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {visit.email}
          </h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Review details, make adjustments, and confirm the visit. All updates
            are logged under your staff account.
          </p>
        </section>

        <StaffVisitEditor
          initialVisit={visit}
          partnerId={visit.partner_id ?? payload.partnerId ?? ""}
          formOptions={options}
        />
      </div>
    </main>
  );
}

async function deriveStaffVisitOptions(payload: Record<string, unknown>) {
  const formId = typeof payload.formId === "string" ? payload.formId : null;
  if (!formId) return undefined;

  const formRecord = await getPartnerFormById(formId).catch(() => null);
  if (!formRecord) return undefined;

  const config: PartnerFormConfig = formRecord.config;

  const ticketTypeOptions = Array.isArray(config.pricing?.ticketPricing)
    ? config.pricing!.ticketPricing.map((option) => ({
        value: option.value,
        label: option.label ?? option.value,
      }))
    : [];

  const transportOptions = deriveTransportOptions(config);

  return {
    ticketTypeOptions: ticketTypeOptions.length > 0 ? ticketTypeOptions : undefined,
    transportOptions: transportOptions.length > 0 ? transportOptions : undefined,
  } as const;
}

function deriveTransportOptions(config: PartnerFormConfig) {
  const results: Array<{ value: string; label: string }> = [];
  const yesValue =
    config.transport?.yesValue ||
    config.pricing?.transportYesValue ||
    "Yes";
  const noValue =
    config.transport?.noValue ||
    (config.transport?.enabled ? config.transport?.noValue : undefined) ||
    "No";

  if (yesValue) {
    results.push({
      value: yesValue,
      label: config.transport?.yesLabel || yesValue,
    });
  }
  if (noValue) {
    const normalizedNo = noValue === yesValue ? "No" : noValue;
    results.push({
      value: normalizedNo,
      label: config.transport?.noLabel || normalizedNo,
    });
  }

  const unique = new Map<string, { value: string; label: string }>();
  for (const option of results) {
    if (!unique.has(option.value)) {
      unique.set(option.value, option);
    }
  }
  return Array.from(unique.values());
}
