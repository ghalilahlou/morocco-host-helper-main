import { describe, it, expect } from 'vitest';
import { sanitizeGuestNameForStorage } from './bookingDisplay';

describe('sanitizeGuestNameForStorage', () => {
  it('returns cleaned human name', () => {
    expect(sanitizeGuestNameForStorage('  Jean  Dupont  ')).toBe('Jean Dupont');
  });

  it('returns null for Airbnb-style codes', () => {
    expect(sanitizeGuestNameForStorage('HM123ABC')).toBeNull();
  });

  it('returns null for iCal-style UIDs', () => {
    expect(sanitizeGuestNameForStorage('UID:7f662ec6-test@airbnb.com')).toBeNull();
  });
});
