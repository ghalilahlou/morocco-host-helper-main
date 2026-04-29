/**
 * Synchronisation calendrier Airbnb / ICS (edge `sync-airbnb-unified`, table `airbnb_reservations`).
 * Mettre à `true` pour réactiver chargement ICS, bouton Synchroniser et abonnements temps réel.
 * `false` = calendrier et fusion calendrier basés uniquement sur les réservations manuelles (`bookings`) ;
 * les barres / dates issues de l’ICS ne sont pas chargées côté client.
 *
 * Pour retirer définitivement les liens en base (toutes les propriétés) et vider les import ICS :
 * migration `20260422190000_disable_all_property_ics_urls.sql`.
 */
export const FRONT_CALENDAR_ICS_SYNC_ENABLED = false;
