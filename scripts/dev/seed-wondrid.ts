#!/usr/bin/env tsx

import 'dotenv/config';
import { createVisitRegistration } from '@/lib/data/visits';

type SeedVisit = {
  email: string;
  totalPrice?: number;
  ticketType?: string;
  numPeople?: number;
  transport?: string;
  categories?: string;
  payload?: Record<string, unknown>;
};

const partnerId = 'wondrid';

const seedData: SeedVisit[] = [
  {
    email: 'guest1@example.com',
    totalPrice: 4800,
    ticketType: 'VIP',
    numPeople: 2,
    transport: 'Yes',
    categories: 'art,evening',
    payload: {
      bookingReference: 'WON-1001',
      visitDate: new Date().toISOString(),
      notes: 'Complimentary welcome drinks',
    },
  },
  {
    email: 'guest2@example.com',
    totalPrice: 2250,
    ticketType: 'Standard',
    numPeople: 3,
    transport: 'No',
    categories: 'family',
    payload: {
      bookingReference: 'WON-1002',
      visitDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      notes: 'Redeemed welcome package',
    },
  },
  {
    email: 'guest3@example.com',
    totalPrice: 3750,
    ticketType: 'Group',
    numPeople: 5,
    transport: 'Yes',
    categories: 'school',
    payload: {
      bookingReference: 'WON-1003',
      visitDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      notes: 'STEM workshop',
    },
  },
];

async function main() {
  console.log(`Seeding ${seedData.length} visits for partner '${partnerId}'...`);
  for (const visit of seedData) {
    const created = await createVisitRegistration({
      email: visit.email,
      partnerId,
      status: 'pending',
      payload: {
        ...visit.payload,
        ticketType: visit.ticketType,
        transport: visit.transport,
        numPeople: visit.numPeople,
        totalPrice: visit.totalPrice,
      },
      totalPrice: visit.totalPrice,
      ticketType: visit.ticketType,
      numPeople: visit.numPeople ?? 1,
      transport: visit.transport,
      categories: visit.categories,
      estimatedPoints: 0,
      pointsAwarded: 0,
    });
    console.log(`• Created visit ${created.id} for ${visit.email}`);
  }
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Failed to seed data:', err);
  process.exitCode = 1;
});
