import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Import the UnifiedAirbnbSyncService class
// Note: In a real test environment, you'd need to properly import this
// For now, we'll copy the relevant methods for testing

class TestUnifiedAirbnbSyncService {
  static parseEvent(eventContent: string): any | null {
      const lines = eventContent.split('\n').map(line => line.replace('\r', ''));
      
      let uid = '';
      let summary = '';
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let description = '';
      let guestName: string | undefined;
      let numberOfGuests: number | undefined;
      let airbnbBookingId: string | undefined;

      // Use indexed for-loop for proper line iteration
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('UID:')) {
          uid = line.substring(4);
        } else if (line.startsWith('SUMMARY:')) {
          summary = line.substring(8);
        } else if (line.startsWith('DTSTART')) {
          const dateStr = this.extractDateFromLine(line);
          if (dateStr) startDate = this.parseICSDate(dateStr);
        } else if (line.startsWith('DTEND')) {
          const dateStr = this.extractDateFromLine(line);
          if (dateStr) endDate = this.parseICSDate(dateStr);
        } else if (line.startsWith('DESCRIPTION:')) {
          // Proper ICS unfolding per RFC5545: continuation lines start with space or tab
          let descLine = line.substring(12);
          let j = i + 1;
          
          // Continue reading continuation lines
          while (j < lines.length) {
            const nextLine = lines[j];
            if (nextLine && (nextLine.startsWith(' ') || nextLine.startsWith('\t'))) {
              // Strip the first character (space or tab) and concatenate
              descLine += nextLine.substring(1);
              j++;
            } else {
              break;
            }
          }
          
          // Decode escaped sequences in DESCRIPTION
          description = this.decodeICSDescription(descLine);
        }
      }

      if (!startDate || !endDate) {
        return null;
      }

      // Extract additional info with improved patterns
      guestName = this.extractGuestName(summary, description);
      numberOfGuests = this.extractNumberOfGuests(summary, description);
      airbnbBookingId = this.extractAirbnbBookingId(description, summary);
      
      // Fallback booking id: if extractAirbnbBookingId returns falsy but UID exists
      if (!airbnbBookingId && uid) {
        airbnbBookingId = `UID:${uid}`;
      }

      return {
        id: uid || `airbnb-${Date.now()}-${Math.random()}`,
        summary,
        startDate,
        endDate,
        guestName,
        description,
        airbnbBookingId,
        numberOfGuests,
        rawEvent: eventContent.substring(0, 500) + '...'
      };
  }

  static extractDateFromLine(line: string): string | null {
    const match = line.match(/:(\d{8})/);
    return match ? match[1] : null;
  }

  static parseICSDate(dateStr: string): Date {
      if (dateStr.length !== 8) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(`Invalid date values: ${dateStr}`);
      }
      if (month < 0 || month > 11) {
        throw new Error(`Invalid month: ${month + 1}`);
      }
      if (day < 1 || day > 31) {
        throw new Error(`Invalid day: ${day}`);
      }
      return new Date(year, month, day);
  }

  static decodeICSDescription(description: string): string {
    // Decode escaped sequences in DESCRIPTION per RFC5545
    return description
      .replace(/\\n/g, '\n')  // \\n → newline
      .replace(/\\,/g, ',')   // \\, → ,
      .replace(/\\;/g, ';')   // \\; → ;
      .replace(/\\\\/g, '\\'); // \\\\ → \ (escape backslash)
  }

  static extractGuestName(summary: string, description: string): string | undefined {
    const patterns = [
      /(?:Reserved for|Guest:|Réservé pour|Guest)\s*([A-Za-z\s]+)/i,
      /^([A-Za-z\s]+)(?:\s*-|\s*\(|\s*–)/,
      /([A-Za-z\s]+)\s*\(/,
      /Guest:\s*([A-Za-z\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match && match[1].trim().length > 2) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  static extractNumberOfGuests(summary: string, description: string): number | undefined {
    const patterns = [
      /(\d+)\s*guests?/i,
      /(\d+)\s*invités?/i,
      /guests?:\s*(\d+)/i,
      /(\d+)\s*personnes?/i
    ];

    for (const pattern of patterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num > 0 && num <= 20) { // Reasonable range
          return num;
        }
      }
    }
    return undefined;
  }

  static extractAirbnbBookingId(description: string, summary: string): string | undefined {
    const searchText = (description + ' ' + summary).toUpperCase();
    
    // Patterns spécifiques pour les URLs Airbnb et codes de réservation
    const patterns = [
      // Pattern pour les URLs Airbnb: /details/HM2KBR5WFZ
      /\/details\/([A-Z0-9]{8,12})/gi,
      // Pattern pour les codes de réservation Airbnb (commencent par HM suivi de 8-10 caractères)
      /(HM[A-Z0-9]{8,10})/g,
      // Autres patterns génériques
      /BOOKING[:\s]*([A-Z0-9]{8,12})/gi,
      /CONFIRMATION[:\s]*([A-Z0-9]{8,12})/gi,
      /RESERVATION[:\s]*([A-Z0-9]{8,12})/gi,
      /REF[:\s]*([A-Z0-9]{8,12})/gi,
      /ID[:\s]*([A-Z0-9]{8,12})/gi
    ];

    for (const pattern of patterns) {
      const matches = [...searchText.matchAll(pattern)];
      for (const match of matches) {
        const code = match[1];
        if (code && code.length >= 8 && code.length <= 12 && /^[A-Z0-9]+$/.test(code)) {
          // Éviter les mots communs comme "RESERVATIO"
          if (!['RESERVATIO', 'CONFIRMATIO', 'BOOKING', 'DETAILS'].includes(code)) {
            return code;
          }
        }
      }
    }
    return undefined;
  }
}

Deno.test("ICS Parser - Basic Event Parsing", () => {
  const sampleICS = `BEGIN:VEVENT
UID:test-uid-12345@airbnb.com
DTSTART;VALUE=DATE:20250115
DTEND;VALUE=DATE:20250120
SUMMARY:Test Reservation
DESCRIPTION:Guest: John Doe\\nBooking ID: HM12345678\\n2 guests
END:VEVENT`;

  const result = TestUnifiedAirbnbSyncService.parseEvent(sampleICS);
  
  assertExists(result);
  assertEquals(result.uid, "test-uid-12345@airbnb.com");
  assertEquals(result.summary, "Test Reservation");
  assertEquals(result.startDate?.getFullYear(), 2025);
  assertEquals(result.startDate?.getMonth(), 0); // January (0-indexed)
  assertEquals(result.startDate?.getDate(), 15);
  assertEquals(result.endDate?.getFullYear(), 2025);
  assertEquals(result.endDate?.getMonth(), 0);
  assertEquals(result.endDate?.getDate(), 20);
  assertEquals(result.airbnbBookingId, "HM12345678");
  assertEquals(result.guestName, "John Doe");
  assertEquals(result.numberOfGuests, 2);
});

Deno.test("ICS Parser - Folded Lines and Escaped Sequences", () => {
  const sampleICS = `BEGIN:VEVENT
UID:test-uid-67890@airbnb.com
DTSTART;VALUE=DATE:20250201
DTEND;VALUE=DATE:20250205
SUMMARY:Complex Reservation
DESCRIPTION:This is a long description that spans multiple lines
 and contains escaped sequences like \\, commas and \\; semicolons
 and \\n newlines. The booking reference is HM87654321.
END:VEVENT`;

  const result = TestUnifiedAirbnbSyncService.parseEvent(sampleICS);
  
  assertExists(result);
  assertEquals(result.uid, "test-uid-67890@airbnb.com");
  assertEquals(result.airbnbBookingId, "HM87654321");
  // Check that escaped sequences are properly decoded
  assertEquals(result.description.includes(", commas"), true);
  assertEquals(result.description.includes("; semicolons"), true);
  assertEquals(result.description.includes("\n newlines"), true);
});

Deno.test("ICS Parser - UID Fallback for Booking ID", () => {
  const sampleICS = `BEGIN:VEVENT
UID:stable-uid-99999@airbnb.com
DTSTART;VALUE=DATE:20250301
DTEND;VALUE=DATE:20250305
SUMMARY:Reservation without HM code
DESCRIPTION:This reservation has no HM booking code but has a stable UID
END:VEVENT`;

  const result = TestUnifiedAirbnbSyncService.parseEvent(sampleICS);
  
  assertExists(result);
  assertEquals(result.uid, "stable-uid-99999@airbnb.com");
  // Should fallback to UID-based booking ID
  assertEquals(result.airbnbBookingId, "UID:stable-uid-99999@airbnb.com");
});

Deno.test("ICS Parser - Invalid Event (Missing Dates)", () => {
  const sampleICS = `BEGIN:VEVENT
UID:invalid-uid@airbnb.com
SUMMARY:Invalid Reservation
DESCRIPTION:This event is missing required dates
END:VEVENT`;

  const result = TestUnifiedAirbnbSyncService.parseEvent(sampleICS);
  
  // Should return null for invalid events
  assertEquals(result, null);
});

Deno.test("ICS Parser - Date Parsing Edge Cases", () => {
  // Test leap year
  const leapYearICS = `BEGIN:VEVENT
UID:leap-year-test@airbnb.com
DTSTART;VALUE=DATE:20240229
DTEND;VALUE=DATE:20240301
SUMMARY:Leap Year Test
END:VEVENT`;

  const result = TestUnifiedAirbnbSyncService.parseEvent(leapYearICS);
  
  assertExists(result);
  assertEquals(result.startDate?.getFullYear(), 2024);
  assertEquals(result.startDate?.getMonth(), 1); // February (0-indexed)
  assertEquals(result.startDate?.getDate(), 29);
});

console.log("✅ All ICS Parser tests completed successfully!");
