import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Calendar,
  DollarSign,
  Building2,
  RefreshCw,
  ArrowUpDown,
  MapPin,
} from 'lucide-react';
import { AdminDashboardData } from '@/types/admin';
import { supabase } from '@/integrations/supabase/client';

interface AdminAnalyticsProps {
  data: AdminDashboardData | null;
}

interface PropertyStat {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  isActive: boolean;
  pricePerNight: number;
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  avgStayDays: number;
  lastBookingDate: string | null;
}

type SortKey = 'name' | 'totalBookings' | 'totalRevenue' | 'avgStayDays';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n);

const TrendBadge = ({ value }: { value: number }) => {
  if (value === 0) return (
    <div className="flex items-center gap-1 text-gray-400">
      <Minus className="h-4 w-4" />
      <span className="text-2xl font-bold">0.0%</span>
    </div>
  );
  const positive = value > 0;
  return (
    <div className={`flex items-center gap-1 ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      <span className="text-2xl font-bold">{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
};

const BarChart = ({
  values,
  color,
  label,
  dates,
}: {
  values: number[];
  color: string;
  label: (v: number, date: string) => string;
  dates: string[];
}) => {
  const max = Math.max(...values, 1);
  return (
    <div className="h-48 flex items-end gap-px w-full">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 group relative"
          style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            className={`w-full rounded-t transition-opacity group-hover:opacity-80 ${color}`}
            style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 1)}%`, minHeight: '2px' }}
          />
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
            {label(v, dates[i])}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ data }) => {
  const [propertyStats, setPropertyStats] = useState<PropertyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('totalBookings');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadPropertyStats = useCallback(async () => {
    setLoading(true);
    try {
      const [propsRes, bookingsRes] = await Promise.all([
        supabase
          .from('properties')
          .select('id, name, city, country, is_active, price_per_night')
          .order('name'),
        supabase
          .from('bookings')
          .select('id, property_id, status, total_amount, check_in_date, check_out_date, created_at'),
      ]);

      const statsMap = new Map<string, PropertyStat>();
      (propsRes.data || []).forEach(p => {
        statsMap.set(p.id, {
          id: p.id,
          name: p.name,
          city: p.city,
          country: p.country,
          isActive: p.is_active,
          pricePerNight: Number(p.price_per_night) || 0,
          totalBookings: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          pendingBookings: 0,
          totalRevenue: 0,
          avgStayDays: 0,
          lastBookingDate: null,
        });
      });

      const stayDaysMap = new Map<string, number[]>();

      (bookingsRes.data || []).forEach(b => {
        const stat = statsMap.get(b.property_id);
        if (!stat) return;

        stat.totalBookings++;
        if (b.status === 'confirmed') stat.confirmedBookings++;
        else if (b.status === 'completed') stat.completedBookings++;
        else if (b.status === 'cancelled') stat.cancelledBookings++;
        else if (b.status === 'pending') stat.pendingBookings++;

        if (b.status !== 'cancelled') {
          stat.totalRevenue += Number(b.total_amount) || 0;
        }

        if (b.check_in_date && b.check_out_date) {
          const days =
            (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) /
            86400000;
          if (days > 0) {
            if (!stayDaysMap.has(b.property_id)) stayDaysMap.set(b.property_id, []);
            stayDaysMap.get(b.property_id)!.push(days);
          }
        }

        if (!stat.lastBookingDate || b.created_at > stat.lastBookingDate) {
          stat.lastBookingDate = b.created_at;
        }
      });

      stayDaysMap.forEach((days, propId) => {
        const stat = statsMap.get(propId);
        if (stat && days.length > 0) {
          stat.avgStayDays = days.reduce((a, b) => a + b, 0) / days.length;
        }
      });

      setPropertyStats(Array.from(statsMap.values()));
    } catch (err) {
      console.error('[AdminAnalytics] loadPropertyStats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPropertyStats();
  }, [loadPropertyStats]);

  // ── Trend helpers (compare last 15 days vs previous 15 days) ──────
  const trendOf = (arr: { bookings?: number; newUsers?: number; revenue?: number }[], key: string) => {
    if (!arr || arr.length < 2) return 0;
    const half = Math.floor(arr.length / 2);
    const recent = arr.slice(half).reduce((s, d) => s + ((d as any)[key] || 0), 0);
    const prev = arr.slice(0, half).reduce((s, d) => s + ((d as any)[key] || 0), 0);
    if (prev === 0) return recent > 0 ? 100 : 0;
    return ((recent - prev) / prev) * 100;
  };

  const bookingAnalytics = data?.bookingAnalytics || [];
  const userAnalytics = data?.userAnalytics || [];

  const bookingTrend = trendOf(bookingAnalytics, 'bookings');
  const userTrend = trendOf(userAnalytics, 'newUsers');
  const revenueTrend = trendOf(bookingAnalytics, 'revenue');

  const bookingValues = bookingAnalytics.map(d => d.bookings);
  const userValues = userAnalytics.map(d => d.newUsers);
  const revenueValues = bookingAnalytics.map(d => d.revenue);
  const bookingDates = bookingAnalytics.map(d => d.date);
  const userDates = userAnalytics.map(d => d.date);

  // ── Property table sorting ─────────────────────────────────────────
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedProps = [...propertyStats].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'totalBookings') cmp = a.totalBookings - b.totalBookings;
    else if (sortKey === 'totalRevenue') cmp = a.totalRevenue - b.totalRevenue;
    else if (sortKey === 'avgStayDays') cmp = a.avgStayDays - b.avgStayDays;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 hover:text-gray-900 font-medium"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? 'text-primary' : 'text-gray-400'}`} />
    </button>
  );

  const totalRevenue = propertyStats.reduce((s, p) => s + p.totalRevenue, 0);
  const totalBookings = propertyStats.reduce((s, p) => s + p.totalBookings, 0);

  return (
    <div className="space-y-6">
      {/* ── Tendances 30 jours ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tendance Réservations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TrendBadge value={bookingTrend} />
            <p className="text-xs text-muted-foreground mt-1">vs 15 jours précédents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tendance Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TrendBadge value={userTrend} />
            <p className="text-xs text-muted-foreground mt-1">vs 15 jours précédents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tendance Revenus</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TrendBadge value={revenueTrend} />
            <p className="text-xs text-muted-foreground mt-1">vs 15 jours précédents</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Graphiques 30 jours ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Réservations (30 jours)</CardTitle>
            <CardDescription>Nombre de réservations créées par jour</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingValues.length > 0 ? (
              <BarChart
                values={bookingValues}
                color="bg-blue-500"
                dates={bookingDates}
                label={(v, d) => `${d} : ${v} réservation(s)`}
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Dernières 30 jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveaux utilisateurs (30 jours)</CardTitle>
            <CardDescription>Inscriptions par jour</CardDescription>
          </CardHeader>
          <CardContent>
            {userValues.length > 0 ? (
              <BarChart
                values={userValues}
                color="bg-green-500"
                dates={userDates}
                label={(v, d) => `${d} : ${v} inscription(s)`}
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Dernières 30 jours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenus (30 jours)</CardTitle>
          <CardDescription>Revenus enregistrés par jour (MAD)</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueValues.length > 0 ? (
            <BarChart
              values={revenueValues}
              color="bg-amber-500"
              dates={bookingDates}
              label={(v, d) => `${d} : ${fmt(v)}`}
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée disponible
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Dernières 30 jours</p>
        </CardContent>
      </Card>

      {/* ── Performance par propriété ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Performance de toutes les propriétés
              </CardTitle>
              <CardDescription>
                {propertyStats.length} propriété(s) — {totalBookings} réservation(s) au total — {fmt(totalRevenue)} de revenus
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadPropertyStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Chargement…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortButton k="name" label="Propriété" /></TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead><SortButton k="totalBookings" label="Réservations" /></TableHead>
                    <TableHead>Détail statuts</TableHead>
                    <TableHead><SortButton k="totalRevenue" label="Revenus" /></TableHead>
                    <TableHead><SortButton k="avgStayDays" label="Durée moy." /></TableHead>
                    <TableHead>Dernière rés.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProps.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium max-w-[180px] truncate" title={p.name}>
                        {p.name}
                      </TableCell>
                      <TableCell>
                        {p.city || p.country ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                            <span>{[p.city, p.country].filter(Boolean).join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.isActive ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900">{p.totalBookings}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.completedBookings > 0 && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs px-1.5">
                              {p.completedBookings} terminées
                            </Badge>
                          )}
                          {p.confirmedBookings > 0 && (
                            <Badge className="bg-green-100 text-green-800 text-xs px-1.5">
                              {p.confirmedBookings} confirmées
                            </Badge>
                          )}
                          {p.pendingBookings > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs px-1.5">
                              {p.pendingBookings} en attente
                            </Badge>
                          )}
                          {p.cancelledBookings > 0 && (
                            <Badge className="bg-red-100 text-red-800 text-xs px-1.5">
                              {p.cancelledBookings} annulées
                            </Badge>
                          )}
                          {p.totalBookings === 0 && (
                            <span className="text-gray-400 text-xs">Aucune</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.totalRevenue > 0 ? fmt(p.totalRevenue) : <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>
                        {p.avgStayDays > 0 ? (
                          <span>{p.avgStayDays.toFixed(1)} j</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {p.lastBookingDate
                          ? new Date(p.lastBookingDate).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })
                          : <span className="text-gray-400">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedProps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-gray-400">
                        <Building2 className="h-8 w-8 mx-auto mb-2" />
                        Aucune propriété trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
