import { describe, it, expect } from 'vitest';
import {
  isIcsCalendarTechnicalKey,
  mergeBookingsWithAirbnbForCalendar,
  dedupeBookingsForCalendarLayout,
} from './calendarReservationModel';
import { ICAL_AIRBNB_DISPLAY_LABEL, calendarBarLabelFromIcsRow } from '@/utils/bookingDisplay';
import type { EnrichedBooking } from '@/services/guestSubmissionService';
import type { AirbnbReservation } from '@/services/airbnbSyncService';

describe('calendarBarLabelFromIcsRow', () => {
  it('returns generic label for ICS UID', () => {
    expect(
      calendarBarLabelFromIcsRow({
        guest_name: null,
        summary: null,
        airbnb_booking_id: 'UID:7f662ec65913-6cb5308b66c2ab08b87140c1fc788be6@airbnb.com',
      }),
    ).toBe(ICAL_AIRBNB_DISPLAY_LABEL);
  });

  it('does not show guest_name from iCal as a person name (calendar bars)', () => {
    expect(
      calendarBarLabelFromIcsRow({
        guest_name: '  Yassine  ',
        summary: 'UID:xxx@airbnb.com',
        airbnb_booking_id: 'UID:7f66@airbnb.com',
      }),
    ).toBe(ICAL_AIRBNB_DISPLAY_LABEL);
  });

  it('shows short booking code when airbnb_booking_id looks like HM…', () => {
    expect(
      calendarBarLabelFromIcsRow({
        guest_name: 'guest',
        summary: 'Airbnb – Marie',
        airbnb_booking_id: 'HM9ABC123',
      }),
    ).toBe('HM9ABC123');
  });
});

describe('isIcsCalendarTechnicalKey', () => {
  it('is true for manual booking whose reference is an ICS UID', () => {
    expect(
      isIcsCalendarTechnicalKey({
        id: 'b1',
        checkInDate: '2026-04-12',
        checkOutDate: '2026-04-15',
        numberOfGuests: 1,
        bookingReference: 'UID:x@airbnb.com',
        status: 'pending',
        guests: [],
      }),
    ).toBe(true);
  });

  it('is false for HM-style code', () => {
    expect(
      isIcsCalendarTechnicalKey({
        id: 'b2',
        checkInDate: '2026-04-12',
        checkOutDate: '2026-04-15',
        numberOfGuests: 1,
        bookingReference: 'HM9ABCDEF',
        status: 'pending',
        guests: [],
      }),
    ).toBe(false);
  });

  it('is true for Airbnb row with UID as airbnbBookingId', () => {
    const row: AirbnbReservation = {
      id: 'a1',
      summary: '',
      startDate: new Date(2026, 3, 12),
      endDate: new Date(2026, 3, 15),
      airbnbBookingId: 'UID:ab@airbnb.com',
    };
    expect(isIcsCalendarTechnicalKey(row)).toBe(true);
  });
});

describe('mergeBookingsWithAirbnbForCalendar', () => {
  it('hides Airbnb row when it matches a manual booking by UID reference', () => {
    const uid = 'UID:shared@airbnb.com';
    const manual = {
      id: 'book-1',
      checkInDate: '2026-04-12',
      checkOutDate: '2026-04-15',
      numberOfGuests: 2,
      bookingReference: uid,
      guest_name: '',
      status: 'pending',
      guests: [],
      realGuestNames: [],
      realGuestCount: 0,
      hasRealSubmissions: false,
      submissionStatus: {
        hasDocuments: false,
        hasSignature: false,
        documentsCount: 0,
      },
    } as EnrichedBooking;

    const airbnb: AirbnbReservation = {
      id: 'air-1',
      summary: '',
      startDate: new Date(2026, 3, 12),
      endDate: new Date(2026, 3, 15),
      airbnbBookingId: uid,
    };

    const { allRows, suppressedAirbnbIds } = mergeBookingsWithAirbnbForCalendar(
      [manual],
      [airbnb],
    );

    expect(suppressedAirbnbIds).toContain('air-1');
    expect(allRows.map((r) => r.id)).toEqual(['book-1']);
  });

  it('hides Airbnb row when manual booking matches via guest_name HM code (bookingReference INDEPENDENT)', () => {
    const manual = {
      id: 'f03cd07e',
      checkInDate: '2026-04-16',
      checkOutDate: '2026-04-18',
      numberOfGuests: 1,
      bookingReference: 'INDEPENDENT_BOOKING',
      guest_name: 'HMRFMPQN5Z',
      status: 'completed',
      guests: [],
      realGuestNames: ['Yassine Madihi'],
      realGuestCount: 1,
      hasRealSubmissions: true,
      submissionStatus: {
        hasDocuments: true,
        hasSignature: true,
        documentsCount: 1,
      },
    } as EnrichedBooking;

    const airbnb: AirbnbReservation = {
      id: 'air-ics-1',
      summary: 'Airbnb',
      startDate: new Date(2026, 3, 16),
      endDate: new Date(2026, 3, 18),
      airbnbBookingId: 'HMRFMPQN5Z',
    };

    const { allRows, suppressedAirbnbIds } = mergeBookingsWithAirbnbForCalendar(
      [manual],
      [airbnb],
    );

    expect(suppressedAirbnbIds).toContain('air-ics-1');
    expect(allRows.map((r) => r.id)).toEqual(['f03cd07e']);
  });

  it('keeps both when dates differ', () => {
    const manual = {
      id: 'book-1',
      checkInDate: '2026-04-12',
      checkOutDate: '2026-04-15',
      numberOfGuests: 1,
      bookingReference: 'HM111',
      status: 'pending',
      guests: [],
      realGuestNames: [],
      realGuestCount: 0,
      hasRealSubmissions: false,
      submissionStatus: {
        hasDocuments: false,
        hasSignature: false,
        documentsCount: 0,
      },
    } as EnrichedBooking;

    const airbnb: AirbnbReservation = {
      id: 'air-1',
      summary: 'x',
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 4, 5),
      airbnbBookingId: 'HM999',
    };

    const { allRows } = mergeBookingsWithAirbnbForCalendar([manual], [airbnb]);
    expect(allRows).toHaveLength(2);
  });
});

describe('dedupeBookingsForCalendarLayout', () => {
  it('keeps one manual row per bookingReference + check-in + check-out', () => {
    const base = {
      numberOfGuests: 1,
      status: 'confirmed' as const,
      guests: [],
      documentsGenerated: { policeForm: false, contract: false },
      updated_at: '2026-01-01T00:00:00Z',
    };
    const a: EnrichedBooking = {
      id: 'a',
      propertyId: 'p',
      ...base,
      checkInDate: '2026-02-25',
      checkOutDate: '2026-02-27',
      bookingReference: 'HMCZD34WJW',
      guest_name: 'Guest',
    } as EnrichedBooking;
    const b: EnrichedBooking = {
      id: 'b',
      propertyId: 'p',
      ...base,
      checkInDate: '2026-02-25',
      checkOutDate: '2026-02-27',
      bookingReference: 'HMCZD34WJW',
      guest_name: 'Guest',
      updated_at: '2026-02-27T02:00:00Z',
    } as EnrichedBooking;
    const out = dedupeBookingsForCalendarLayout([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  it('keeps distinct manual stays with different references', () => {
    const x: EnrichedBooking = {
      id: '1',
      propertyId: 'p',
      numberOfGuests: 1,
      status: 'confirmed',
      guests: [],
      documentsGenerated: { policeForm: true, contract: true },
      checkInDate: '2026-04-19',
      checkOutDate: '2026-04-20',
      bookingReference: 'REF1',
    } as EnrichedBooking;
    const y: EnrichedBooking = {
      id: '2',
      propertyId: 'p',
      numberOfGuests: 1,
      status: 'confirmed',
      guests: [],
      documentsGenerated: { policeForm: true, contract: true },
      checkInDate: '2026-04-19',
      checkOutDate: '2026-04-20',
      bookingReference: 'REF2',
    } as EnrichedBooking;
    expect(dedupeBookingsForCalendarLayout([x, y])).toHaveLength(2);
  });
});
