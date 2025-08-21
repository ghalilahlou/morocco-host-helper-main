// Legacy service for compatibility
import { AirbnbEdgeFunctionService } from './airbnbEdgeFunctionService';

export class AirbnbPersistenceService {
  static async syncAndPersistReservations(propertyId: string, icsUrl: string) {
    console.warn('⚠️ AirbnbPersistenceService.syncAndPersistReservations is deprecated. Use AirbnbEdgeFunctionService.syncReservations instead.');
    return await AirbnbEdgeFunctionService.syncReservations(propertyId, icsUrl);
  }

  static async getReservationByBookingId(propertyId: string, bookingId: string) {
    console.warn('⚠️ AirbnbPersistenceService.getReservationByBookingId is deprecated. Use AirbnbEdgeFunctionService.getReservations instead.');
    const reservations = await AirbnbEdgeFunctionService.getReservations(propertyId);
    return reservations.find(r => r.airbnb_booking_id === bookingId) ?? null;
  }

  static async getAllReservations(propertyId: string) {
    console.warn('⚠️ AirbnbPersistenceService.getAllReservations is deprecated. Use AirbnbEdgeFunctionService.getReservations instead.');
    return await AirbnbEdgeFunctionService.getReservations(propertyId);
  }

  static async getSyncStatus(propertyId: string) {
    console.warn('⚠️ AirbnbPersistenceService.getSyncStatus is deprecated. Use AirbnbEdgeFunctionService.getSyncStatus instead.');
    return await AirbnbEdgeFunctionService.getSyncStatus(propertyId);
  }
}
