import { addPointsHistoryEntry, PointsHistoryType } from '../data/points';
import { VisitRegistrationRecord } from '../data/visits';

export async function recordPointsForVisit(
  visit: VisitRegistrationRecord,
  type: PointsHistoryType,
  points: number,
  partnerName?: string | null
) {
  return addPointsHistoryEntry({
    email: visit.email,
    type,
    points,
    partnerId: visit.partner_id,
    partnerName: partnerName ?? null,
    visitId: visit.id,
    meta: {
      ticketType: visit.ticket_type,
      numPeople: visit.num_people,
      totalPrice: visit.total_price,
    },
  });
}
