import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking, invalidateSubmissionsCache } from '@/services/guestSubmissionService';
import { validateBookingData, logDataError } from '@/utils/errorMonitoring';
import { debug, info, warn, error as logError } from '@/lib/logger';
import { multiLevelCache } from '@/services/multiLevelCache';

const BOOKINGS_QUERY_TIMEOUT = 8000;
const CACHE_TTL = 60000; // 1 minute
const DEBOUNCE_MS = 2000; // 2 s — laisser les événements realtime se regrouper avant de recharger

const BOOKINGS_SELECT = `
  id, property_id, user_id,
  check_in_date, check_out_date,
  number_of_guests, booking_reference, guest_name,
  status, created_at, updated_at, documents_generated,
  guests (id, full_name, date_of_birth, nationality, document_number),
  property:properties (id, name, address, property_type)
`;

interface UseBookingsOptions {
  propertyId?: string;
  dateRange?: { start: Date; end: Date };
  limit?: number;
}

function buildCacheKey(propertyId?: string, userId?: string, dateRange?: { start: Date; end: Date }): string {
  const dateKey = dateRange
    ? `-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}`
    : '';
  return propertyId
    ? `bookings-v3-${propertyId}${dateKey}`
    : `bookings-v3-all-${userId || 'anon'}${dateKey}`;
}

/** Après suppression : invalider toutes les clés susceptibles de réinjecter la ligne (hook courant vs dashboard par bien). */
async function invalidateBookingCachesAfterMutation(
  propertyIdOfBooking: string | undefined,
  userId: string,
  hookPropertyId: string | undefined,
  dateRange: { start: Date; end: Date } | undefined
): Promise<void> {
  await multiLevelCache.invalidate(buildCacheKey(hookPropertyId, userId, dateRange)).catch(() => {});
  await multiLevelCache.invalidate(buildCacheKey(undefined, userId, dateRange)).catch(() => {});
  if (propertyIdOfBooking) {
    await multiLevelCache.invalidatePattern(propertyIdOfBooking).catch(() => {});
  }
}

function transformBooking(raw: any): Booking | null {
  if (!raw.property_id) {
    warn('Booking sans property_id exclu', { bookingId: raw.id });
    return null;
  }

  const property = Array.isArray(raw.property) ? raw.property[0] : raw.property;
  const guests = Array.isArray(raw.guests) ? raw.guests : [];

  return {
    id: raw.id,
    propertyId: raw.property_id,
    userId: raw.user_id,
    checkInDate: raw.check_in_date,
    checkOutDate: raw.check_out_date,
    numberOfGuests: raw.number_of_guests || 0,
    bookingReference: raw.booking_reference || '',
    guest_name: raw.guest_name || '',
    status: (raw.status || 'pending') as Booking['status'],
    createdAt: raw.created_at,
    updated_at: raw.updated_at || raw.created_at,
    documentsGenerated: raw.documents_generated || { policeForm: false, contract: false, identity: false },
    guests: guests.map((g: any) => ({
      id: g.id,
      fullName: g.full_name || '',
      dateOfBirth: g.date_of_birth || '',
      documentNumber: g.document_number || '',
      nationality: g.nationality || '',
      placeOfBirth: g.place_of_birth || '',
      documentType: g.document_type || 'PASSPORT',
      profession: g.profession || '',
      motifSejour: g.motif_sejour || 'TOURISME',
      adressePersonnelle: g.adresse_personnelle || '',
      email: g.email || null
    })),
    property: property ? {
      id: property.id,
      name: property.name || '',
      address: property.address || '',
      property_type: property.property_type || '',
      max_occupancy: property.max_occupancy || 0
    } : undefined
  };
}

/** Évite le flash code Airbnb : le réseau renvoie des lignes "base" sans soumissions avant l'enrichissement async. */
function preserveSubmissionEnrichment(
  prev: EnrichedBooking[],
  incoming: EnrichedBooking[],
): EnrichedBooking[] {
  const prevById = new Map(prev.map((b) => [b.id, b]));
  return incoming.map((b) => {
    const p = prevById.get(b.id);
    if (!p) return b;

    const prevHasNames = (p.realGuestNames?.length ?? 0) > 0;
    const incomingHasNames = (b.realGuestNames?.length ?? 0) > 0;

    // Après F5 : cache / ancien enrich avait des noms ; la nouvelle passe peut avoir
    // hasRealSubmissions mais realGuestNames [] (guest_data = "Guest", filtré, etc.).
    // Sans ce garde-fou, setBookings(enriched) écrase les noms persistés.
    if (prevHasNames && !incomingHasNames) {
      return {
        ...b,
        realGuestNames: [...(p.realGuestNames || [])],
        realGuestCount: p.realGuestCount || p.realGuestNames?.length || b.realGuestCount,
        hasRealSubmissions: b.hasRealSubmissions || p.hasRealSubmissions,
        submissionStatus: { ...p.submissionStatus, ...b.submissionStatus },
      };
    }

    const hadSubs =
      (p.realGuestNames && p.realGuestNames.length > 0) || p.hasRealSubmissions;
    const incomingEmpty =
      (!b.realGuestNames || b.realGuestNames.length === 0) && !b.hasRealSubmissions;
    if (hadSubs && incomingEmpty) {
      return {
        ...b,
        realGuestNames: p.realGuestNames,
        realGuestCount: p.realGuestCount,
        hasRealSubmissions: p.hasRealSubmissions,
        submissionStatus: p.submissionStatus,
      };
    }
    return b;
  });
}

/** Réinjecte noms / soumissions depuis le cache (IndexedDB) pour éviter un flash « vide » au rechargement. */
function mergeEnrichmentFromCache(
  base: EnrichedBooking[],
  cached: EnrichedBooking[] | null | undefined
): EnrichedBooking[] {
  if (!cached?.length) return base;
  const byId = new Map(cached.map((b) => [b.id, b]));
  return base.map((b) => {
    const c = byId.get(b.id);
    if (!c) return b;
    const hadEnrichment =
      (c.realGuestNames && c.realGuestNames.length > 0) || c.hasRealSubmissions;
    if (!hadEnrichment) return b;
    return {
      ...b,
      realGuestNames: c.realGuestNames?.length ? [...c.realGuestNames] : b.realGuestNames,
      realGuestCount: c.realGuestNames?.length ? c.realGuestCount : b.realGuestCount,
      hasRealSubmissions: c.hasRealSubmissions,
      submissionStatus: {
        ...b.submissionStatus,
        ...c.submissionStatus,
      },
      documentsLoading: false,
      documentsTimeout: c.documentsTimeout,
      enrichmentError: c.enrichmentError,
    };
  });
}

export const useBookings = (options?: UseBookingsOptions) => {
  const { propertyId, dateRange, limit = 50 } = options || {};
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const loadIdRef = useRef(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const previousPropertyIdRef = useRef<string | undefined>(propertyId);
  const bookingIdsRef = useRef(new Set<string>());
  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRealtimeReloadRef = useRef(0);

  const filteredBookings = useMemo(() => {
    if (!propertyId) return bookings;
    return bookings.filter(b => b.propertyId === propertyId);
  }, [bookings, propertyId]);

  // Clean state when propertyId changes
  useEffect(() => {
    const prev = previousPropertyIdRef.current;
    if (prev !== undefined && prev !== propertyId) {
      setBookings([]);
      setIsLoading(true);

      if (prev) {
        const oldKey = buildCacheKey(prev, user?.id, dateRange);
        multiLevelCache.invalidate(oldKey).catch(() => {});
      }
    }
    previousPropertyIdRef.current = propertyId;
  }, [propertyId, user?.id, dateRange]);

  const loadBookings = useCallback(async () => {
    if (propertyId === undefined || !user) {
      setIsLoading(false);
      return;
    }

    const currentLoadId = ++loadIdRef.current;
    const cacheKey = buildCacheKey(propertyId, user.id, dateRange);
    const isStale = () => loadIdRef.current !== currentLoadId;

    // STEP 1: Try cache first (instant display) — only if we have NO bookings yet
    // Avoids overwriting enriched data with stale cache during realtime reloads.
    try {
      const cached = await multiLevelCache.get<EnrichedBooking[]>(cacheKey);
      if (cached && cached.length > 0 && !isStale()) {
        const relevant = propertyId ? cached.filter(b => b.propertyId === propertyId) : cached;
        if (relevant.length > 0) {
          setBookings((prev) => prev.length > 0 ? preserveSubmissionEnrichment(prev, relevant) : relevant);
          setIsLoading(false);
        }
      }
    } catch {
      // Cache miss
    }

    // STEP 2: Load from network
    try {
      let query = supabase
        .from('bookings')
        .select(BOOKINGS_SELECT)
        .eq('user_id', user.id);

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (dateRange) {
        query = query
          .gte('check_in_date', dateRange.start.toISOString().split('T')[0])
          .lte('check_out_date', dateRange.end.toISOString().split('T')[0]);
      }

      query = query
        .order('check_in_date', { ascending: false })
        .limit(Math.min(limit, 100));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BOOKINGS_QUERY_TIMEOUT);

      let result: any;
      try {
        result = await query.abortSignal(controller.signal);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (isStale()) return;
        warn('Bookings query timeout or error', { error: err?.message });
        setIsLoading(false);
        return;
      }

      clearTimeout(timeoutId);

      if (isStale()) return;

      const { data, error } = result || {};

      if (error) {
        warn('Bookings query error', { error: error.message });
        setIsLoading(false);
        return;
      }

      // Transform raw data
      const transformed = (data || [])
        .map(transformBooking)
        .filter(Boolean) as Booking[];

      // Deduplicate by id
      const byId = new Map<string, Booking>();
      transformed.forEach(b => { if (!byId.has(b.id)) byId.set(b.id, b); });
      const uniqueBookings = Array.from(byId.values());

      if (isStale()) return;

      let cachedForMerge: EnrichedBooking[] | null = null;
      try {
        cachedForMerge = await multiLevelCache.getExpired<EnrichedBooking[]>(cacheKey);
      } catch {
        cachedForMerge = null;
      }

      // Set base bookings immediately (fast display) — merge noms enrichis du cache pour persistance au refresh
      const baseEnriched: EnrichedBooking[] = uniqueBookings.map(b => ({
        ...b,
        realGuestNames: [],
        realGuestCount: 0,
        hasRealSubmissions: false,
        documentsLoading: true,
        submissionStatus: { hasDocuments: false, hasSignature: false, documentsCount: 0 }
      }));

      const mergedBase = mergeEnrichmentFromCache(baseEnriched, cachedForMerge);

      setBookings((prev) => preserveSubmissionEnrichment(prev, mergedBase));
      setIsLoading(false);

      // Ne pas écraser le cache avec des lignes « vides » si le merge a conservé des noms
      try {
        await multiLevelCache.set(cacheKey, mergedBase, CACHE_TTL);
      } catch {
        // Non-blocking
      }

      // STEP 3: Enrich in background (non-blocking)
      if (uniqueBookings.length > 0) {
        try {
          const enriched = await enrichBookingsWithGuestSubmissions(uniqueBookings);
          if (isStale()) return;

          // STEP 3.5: Batch-fetch signer names from contract_signatures when we still
          // have no displayable name. Submissions often lack parseable guest_data while
          // guest_name is an ICS code (not a "placeholder") — the old filter skipped those.
          const signerPlaceholder = new Set([
            'guest', 'client', 'invité', 'invite', 'voyageur', 'traveler', 'traveller',
            'reservation', 'réservation', 'unknown', 'inconnu', 'n/a', 'na', 'test', '',
          ]);
          const looksLikeIcsCode = (s: string) =>
            /^[A-Z]{2}[A-Z0-9]{4,}$/i.test(s.trim()) || /^UID:/i.test(s.trim());

          const needsSignerName = enriched.filter(
            b => !b.realGuestNames || b.realGuestNames.length === 0
          );

          if (needsSignerName.length > 0) {
            const { data: sigs } = await supabase
              .from('contract_signatures')
              .select('booking_id, signer_name, created_at')
              .in('booking_id', needsSignerName.map(b => b.id))
              .not('signer_name', 'is', null)
              .order('created_at', { ascending: false });

            const sigMap = new Map<string, string>();
            for (const row of sigs || []) {
              if (!row.booking_id || !row.signer_name) continue;
              if (sigMap.has(row.booking_id)) continue;
              const raw = row.signer_name.trim();
              const lower = raw.toLowerCase();
              if (!raw || signerPlaceholder.has(lower)) continue;
              if (looksLikeIcsCode(raw)) continue;
              sigMap.set(row.booking_id, raw);
            }

            enriched.forEach(b => {
              const name = sigMap.get(b.id);
              if (name && (!b.realGuestNames || b.realGuestNames.length === 0)) {
                b.realGuestNames = [name];
                b.realGuestCount = Math.max(1, b.realGuestCount || 1);
                b.hasRealSubmissions = true;
              }
            });
          }

          setBookings((prev) => {
            const next = preserveSubmissionEnrichment(prev, enriched);
            void multiLevelCache.set(cacheKey, next, CACHE_TTL).catch(() => {});
            return next;
          });
        } catch (enrichErr: any) {
          debug('Enrichment failed (non-blocking)', { error: enrichErr?.message });
          if (!isStale()) {
            setBookings(prev => prev.map(b => ({
              ...b,
              documentsLoading: false,
              documentsTimeout: enrichErr?.message?.includes('timeout')
            })) as EnrichedBooking[]);
          }
        }
      }

      // STEP 4: Self-heal – downgrade bookings that are 'completed' but lack documents
      // Only run once per session (not on every reload) to avoid realtime feedback loop:
      // UPDATE bookings → realtime fires → loadBookings → UPDATE again → ...
      const selfHealKey = `selfheal-${propertyId}`;
      const alreadyHealed = (window as any)[selfHealKey];
      const toDowngrade = alreadyHealed ? [] : uniqueBookings.filter(b =>
        b.status === 'completed' &&
        !(b.documentsGenerated?.contract && b.documentsGenerated?.policeForm)
      );
      if (toDowngrade.length > 0) {
        (window as any)[selfHealKey] = true;
        debug('Self-heal: downgrading completed bookings without documents', { count: toDowngrade.length });
        for (const b of toDowngrade) {
          supabase.from('bookings')
            .update({ status: 'confirmed', updated_at: new Date().toISOString() })
            .eq('id', b.id)
            .then(({ error: e }) => { if (e) warn('Self-heal update failed', { id: b.id, error: e.message }); });
        }
        if (!isStale()) {
          setBookings(prev => prev.map(b =>
            toDowngrade.some(d => d.id === b.id) ? { ...b, status: 'confirmed' as any } : b
          ));
        }
      }
    } catch (err) {
      logError('Error loading bookings', err as Error);
      if (!isStale()) setIsLoading(false);
    }
  }, [propertyId, dateRange, limit, user?.id]);

  // Load on propertyId or user change
  useEffect(() => {
    if (propertyId === undefined) {
      setIsLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      loadBookings();
    }, 50);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [propertyId, user?.id, loadBookings]);

  // Force-reload that invalidates all caches before fetching fresh data
  const invalidateAndReload = useCallback(async () => {
    const cacheKey = buildCacheKey(propertyId, user?.id, dateRange);
    await multiLevelCache.invalidate(cacheKey).catch(() => {});
    invalidateSubmissionsCache();
    await loadBookings();
  }, [propertyId, user?.id, dateRange, loadBookings]);

  // Keep bookingIdsRef up to date for scoped realtime filtering
  useEffect(() => {
    bookingIdsRef.current = new Set(bookings.map(b => b.id));
  }, [bookings]);

  // Real-time subscription — scoped to property to avoid cross-property noise.
  useEffect(() => {
    if (!user || propertyId === undefined) return;

    const scheduleReload = () => {
      if (realtimeTimerRef.current) return; // already scheduled
      const elapsed = Date.now() - lastRealtimeReloadRef.current;
      const delay = Math.max(DEBOUNCE_MS - elapsed, 200);
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        lastRealtimeReloadRef.current = Date.now();
        invalidateAndReload();
      }, delay);
    };

    const isOurBooking = (payload: any): boolean => {
      const id =
        payload?.new?.id ?? payload?.old?.id ??
        payload?.new?.booking_id ?? payload?.old?.booking_id;
      if (!id) return true; // conservative: reload if we can't tell
      return bookingIdsRef.current.has(id);
    };

    const channelName = `bookings-rt-${user.id}-${propertyId || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: propertyId ? `property_id=eq.${propertyId}` : undefined
      }, (payload) => {
        // Optimistic INSERT
        if (payload.eventType === 'INSERT' && payload.new) {
          const raw = payload.new;
          setBookings(prev => {
            if (prev.some(b => b.id === raw.id)) return prev;
            const temp: EnrichedBooking = {
              id: raw.id,
              propertyId: raw.property_id,
              checkInDate: raw.check_in_date,
              checkOutDate: raw.check_out_date,
              numberOfGuests: raw.number_of_guests,
              bookingReference: raw.booking_reference,
              guest_name: raw.guest_name,
              status: raw.status as any,
              guests: [],
              createdAt: raw.created_at,
              documentsGenerated: { policeForm: false, contract: false },
              realGuestNames: [],
              realGuestCount: 0,
              hasRealSubmissions: false,
              submissionStatus: { hasDocuments: false, hasSignature: false, documentsCount: 0 }
            };
            return [temp, ...prev];
          });
        }

        // Optimistic DELETE
        if (payload.eventType === 'DELETE' && payload.old) {
          setBookings(prev => prev.filter(b => b.id !== payload.old.id));
        }

        // Optimistic UPDATE
        if (payload.eventType === 'UPDATE' && payload.new) {
          const upd = payload.new;
          setBookings(prev => prev.map(b =>
            b.id === upd.id
              ? {
                  ...b,
                  checkInDate: upd.check_in_date,
                  checkOutDate: upd.check_out_date,
                  numberOfGuests: upd.number_of_guests,
                  status: upd.status as any,
                  guest_name: upd.guest_name ?? b.guest_name,
                  documentsGenerated: upd.documents_generated ?? b.documentsGenerated,
                }
              : b
          ));
        }

        scheduleReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, (p) => {
        if (isOurBooking(p)) scheduleReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_submissions' }, (p) => {
        if (isOurBooking(p)) scheduleReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_signatures' }, (p) => {
        if (isOurBooking(p)) scheduleReload();
      })
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, propertyId, invalidateAndReload]);

  // Clean up on property-deleted event
  useEffect(() => {
    const handler = (event: CustomEvent<{ propertyId: string }>) => {
      const deletedId = event.detail?.propertyId;
      if (!deletedId) return;

      const key = buildCacheKey(deletedId, user?.id, dateRange);
      multiLevelCache.invalidate(key).catch(() => {});

      if (propertyId === deletedId) {
        setBookings([]);
        setIsLoading(false);
      }
    };

    window.addEventListener('property-deleted', handler as EventListener);
    return () => window.removeEventListener('property-deleted', handler as EventListener);
  }, [propertyId, user?.id, dateRange]);

  // CRUD Operations

  const addBooking = async (booking: Booking) => {
    if (!user) {
      logError('No authenticated user', new Error('User not authenticated'));
      return;
    }

    try {
      const statusForDb = (['pending', 'confirmed', 'completed', 'archived'].includes(booking.status) ? booking.status : 'pending') as 'pending' | 'confirmed' | 'completed' | 'archived';
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          property_id: booking.property_id,
          check_in_date: booking.checkInDate,
          check_out_date: booking.checkOutDate,
          number_of_guests: booking.numberOfGuests,
          booking_reference: booking.bookingReference,
          guest_name: booking.guest_name,
          status: statusForDb,
          documents_generated: booking.documentsGenerated as any
        })
        .select()
        .single();

      if (bookingError) {
        logError('Error adding booking', bookingError as Error);
        return;
      }

      if (booking.guests.length > 0) {
        const guestsData = booking.guests.map(guest => {
          let cleanDate: string | null = typeof guest.dateOfBirth === 'string' ? guest.dateOfBirth : null;
          if (cleanDate && !cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const d = new Date(cleanDate);
            cleanDate = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
          }
          return {
            booking_id: bookingData.id,
            full_name: guest.fullName ?? '',
            date_of_birth: cleanDate as string | undefined,
            document_number: guest.documentNumber ?? '',
            nationality: guest.nationality ?? 'Non spécifiée',
            place_of_birth: guest.placeOfBirth ?? null,
            document_type: (guest.documentType || 'passport') as 'passport' | 'national_id'
          };
        });

        const { error: guestsError } = await supabase.from('guests').insert(guestsData);
        if (guestsError) logError('Error adding guests', guestsError as Error);
      }

      // Optimistic add
      const newBooking: Booking = {
        ...booking,
        id: bookingData.id,
        createdAt: bookingData.created_at,
        updated_at: bookingData.updated_at || bookingData.created_at
      };

      setBookings(prev => {
        if (prev.some(b => b.id === newBooking.id)) {
          return prev.map(b => b.id === newBooking.id ? { ...b, ...newBooking } as EnrichedBooking : b);
        }
        return [{ ...newBooking, realGuestNames: [], realGuestCount: 0, hasRealSubmissions: false, submissionStatus: { hasDocuments: false, hasSignature: false, documentsCount: 0 } } as EnrichedBooking, ...prev];
      });

      await invalidateBookingCachesAfterMutation(
        bookingData.property_id,
        user.id,
        propertyId,
        dateRange
      );
      loadBookings().catch(() => {});
    } catch (error) {
      logError('Error adding booking', error as Error);
    }
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    try {
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !currentBooking) {
        logError('Error fetching booking for update', fetchError as Error);
        return;
      }

      const updateData: any = {};
      if (updates.checkInDate) updateData.check_in_date = updates.checkInDate;
      if (updates.checkOutDate) updateData.check_out_date = updates.checkOutDate;
      if (updates.numberOfGuests) updateData.number_of_guests = updates.numberOfGuests;
      if (updates.bookingReference !== undefined) updateData.booking_reference = updates.bookingReference;
      if (updates.guest_name !== undefined) updateData.guest_name = updates.guest_name;

      if (updates.documentsGenerated) {
        const currentDocGen = (currentBooking.documents_generated as Record<string, any>) || { policeForm: false, contract: false };
        updateData.documents_generated = { ...currentDocGen, ...(updates.documentsGenerated as Record<string, any>) };
      }

      const validStatuses = ['pending', 'confirmed', 'completed', 'archived'];
      if (updates.status && validStatuses.includes(updates.status)) {
        updateData.status = updates.status;
      } else if (updateData.documents_generated?.contract && updateData.documents_generated?.policeForm && currentBooking.status !== 'completed') {
        updateData.status = 'completed';
      }

      const { error } = await supabase
        .from('bookings')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('updated_at', currentBooking.updated_at);

      if (error) {
        logError('Error updating booking', error as Error);
        if (error.message?.includes('conflict') || error.code === 'PGRST116') {
          return updateBooking(id, updates);
        }
        return;
      }

      // Optimistic update
      setBookings(prev => prev.map(b =>
        b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
      ));

      await invalidateBookingCachesAfterMutation(
        currentBooking.property_id as string | undefined,
        user.id,
        propertyId,
        dateRange
      );
      await loadBookings();
    } catch (error) {
      logError('Error updating booking', error as Error);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('id, property_id, booking_reference')
        .eq('id', id)
        .maybeSingle();

      // Delete related records
      await supabase.from('guest_submissions').delete().eq('booking_id', id);
      await supabase.from('guests').delete().eq('booking_id', id);
      await supabase.from('uploaded_documents').delete().eq('booking_id', id);

      if (bookingData?.booking_reference && bookingData.booking_reference !== 'INDEPENDENT_BOOKING' && bookingData.property_id) {
        await supabase
          .from('airbnb_reservations')
          .update({ guest_name: null, summary: bookingData.booking_reference, updated_at: new Date().toISOString() })
          .eq('property_id', bookingData.property_id)
          .eq('airbnb_booking_id', bookingData.booking_reference);
      }

      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) {
        logError('Error deleting booking', error as Error);
        throw error;
      }

      // Optimistic delete
      setBookings(prev => prev.filter(b => b.id !== id));

      // Emit event for other components
      window.dispatchEvent(new CustomEvent('booking-deleted', { detail: { bookingId: id } }));

      invalidateSubmissionsCache();
      await invalidateBookingCachesAfterMutation(
        bookingData?.property_id,
        user!.id,
        propertyId,
        dateRange
      );
      await loadBookings();
    } catch (error) {
      logError('Error in deleteBooking', error as Error);
      throw error;
    }
  };

  const getBookingById = (id: string) => filteredBookings.find(b => b.id === id);

  return {
    bookings: filteredBookings,
    isLoading,
    addBooking,
    updateBooking,
    deleteBooking,
    getBookingById,
    refreshBookings: invalidateAndReload
  };
};
