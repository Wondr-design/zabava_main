import type { Metadata } from "next";

import {
  listTransportServices,
  listTransportRideSummaries,
} from "@/lib/data/transport";
import {
  TransportDashboard,
  type TransportServiceRow,
  type TransportRideRowItem,
} from "@/components/admin/transport/transport-dashboard";

export const metadata: Metadata = {
  title: "Transport services · Zabava admin",
};

function mapServiceToRow(service: Awaited<ReturnType<typeof listTransportServices>>[number]): TransportServiceRow {
  return {
    id: service.id,
    partnerId: service.partner_id,
    name: service.name,
    serviceType: service.service_type,
    commissionPerRide: service.commission_per_ride,
    qrValidityDays: service.qr_validity_days,
    enabled: service.enabled,
    notes: service.notes,
  };
}

function mapRideToRow(
  ride: Awaited<ReturnType<typeof listTransportRideSummaries>>[number],
): TransportRideRowItem {
  return {
    id: ride.id,
    serviceName: ride.serviceName,
    serviceType: ride.serviceType,
    createdAt: ride.createdAt,
    status: ride.status,
    fareAmount: ride.fareAmount,
    commissionPerRide: ride.commissionPerRide,
  };
}

export default async function AdminTransportPage() {
  const [services, rides] = await Promise.all([
    listTransportServices({ includeDisabled: true }),
    listTransportRideSummaries({ limit: 25 }),
  ]);

  return (
    <div className="space-y-6 px-6 py-8">
      <TransportDashboard
        services={services.map(mapServiceToRow)}
        rides={rides.map(mapRideToRow)}
      />
    </div>
  );
}
