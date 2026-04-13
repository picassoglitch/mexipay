import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { listTransactions, type TransactionListItem } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { C, FONTS } from '../utils/colors';
import { formatMXN, formatTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type Status = 'pending' | 'paid' | 'expired' | 'failed';

const STATUS_CFG: Record<Status, { label: string; color: string; bg: string }> = {
  paid:    { label: 'Pagado',    color: C.paid,    bg: C.paidBg    },
  pending: { label: 'Pendiente', color: C.pending, bg: C.pendingBg },
  expired: { label: 'Vencido',   color: C.expired, bg: C.expiredBg },
  failed:  { label: 'Fallido',   color: C.failed,  bg: C.failedBg  },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardScreen({ navigation }: Props) {
  const merchant  = useAuthStore((s) => s.merchant);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [txs,        setTxs]        = useState<TransactionListItem[]>([]);
  const [netToday,   setNetToday]   = useState(0);
  const [paidCount,  setPaidCount]  = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listTransactions({ date: todayISO(), limit: 50 });
      setTxs(res.data);
      const paid = res.data.filter((t) => t.status === 'paid');
      setPaidCount(paid.length);
      setNetToday(paid.reduce((sum, t) => sum + t.amountCentavos - t.feeCentavos, 0));
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        await clearAuth();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  function onRefresh() { setRefreshing(true); load(); }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <FlatList
        data={txs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }

        ListHeaderComponent={
          <>
            {/* ── Top bar ── */}
            <View style={s.topBar}>
              <View>
                <Text style={s.greeting}>{greeting()}</Text>
                <Text style={s.bizName} numberOfLines={1}>
                  {merchant?.businessName ?? '—'}
                </Text>
              </View>
              <TouchableOpacity style={s.logoutBtn} onPress={async () => {
                await clearAuth();
              }}>
                <Text style={s.logoutText}>Salir</Text>
              </TouchableOpacity>
            </View>

            {/* ── Summary card ── */}
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Neto cobrado hoy</Text>
              <Text style={s.summaryAmount}>{formatMXN(netToday)}</Text>
              <View style={s.summaryRow}>
                <Pill count={paidCount} label="pagos" color={C.accent} />
                <Pill count={txs.filter((t) => t.status === 'pending').length} label="pendientes" color={C.pending} />
              </View>
            </View>

            {/* ── New charge CTA ── */}
            <TouchableOpacity
              style={s.newChargeBtn}
              onPress={() => navigation.navigate('Keypad')}
              activeOpacity={0.8}
            >
              <Text style={s.newChargePlus}>+</Text>
              <Text style={s.newChargeText}>Nuevo cobro</Text>
            </TouchableOpacity>

            {/* ── List header ── */}
            {txs.length > 0 && (
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>TRANSACCIONES DE HOY</Text>
                <Text style={s.sectionCount}>{txs.length}</Text>
              </View>
            )}
          </>
        }

        ListEmptyComponent={
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>Sin transacciones</Text>
            <Text style={s.emptySub}>Toca "Nuevo cobro" para empezar</Text>
          </View>
        }

        renderItem={({ item }) => <TxCard tx={item} />}
      />
    </SafeAreaView>
  );
}

// ── Transaction card ──────────────────────────────────────────────────────

function TxCard({ tx }: { tx: TransactionListItem }) {
  const cfg = STATUS_CFG[tx.status as Status] ?? STATUS_CFG.pending;
  return (
    <View style={tc.card}>
      <View style={tc.left}>
        <Text style={tc.amount}>{formatMXN(tx.amountCentavos)}</Text>
        <Text style={tc.ref} numberOfLines={1}>{tx.reference}</Text>
      </View>
      <View style={tc.right}>
        <View style={[tc.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[tc.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={tc.time}>{formatTime(tx.createdAt)}</Text>
      </View>
    </View>
  );
}

function Pill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[pl.pill, { borderColor: color + '40' }]}>
      <Text style={[pl.count, { color }]}>{count}</Text>
      <Text style={pl.label}> {label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  list:   { paddingBottom: 40 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  greeting: { fontFamily: FONTS.body,    fontSize: 13, color: C.textSub },
  bizName:  { fontFamily: FONTS.heading, fontSize: 22, color: C.text, letterSpacing: -0.5, maxWidth: 220 },
  logoutBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border2, marginTop: 4 },
  logoutText: { fontFamily: FONTS.medium, fontSize: 12, color: C.textSub },

  summaryCard: {
    margin: 16, backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 20,
  },
  summaryLabel:  { fontFamily: FONTS.medium, fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  summaryAmount: { fontFamily: FONTS.heading, fontSize: 48, color: C.text, letterSpacing: -2, marginBottom: 12 },
  summaryRow:    { flexDirection: 'row', gap: 10 },

  newChargeBtn: {
    marginHorizontal: 16, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  newChargePlus: { fontFamily: FONTS.heading,  fontSize: 24, color: C.bg, lineHeight: 26 },
  newChargeText: { fontFamily: FONTS.bold, fontSize: 17, color: C.bg },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  sectionTitle: { fontFamily: FONTS.medium, fontSize: 10, color: C.textSub, letterSpacing: 1.2 },
  sectionCount: { fontFamily: FONTS.medium, fontSize: 12, color: C.textSub },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 16, color: C.textSub },
  emptySub:   { fontFamily: FONTS.body, fontSize: 13, color: C.textDim, marginTop: 6 },
});

const tc = StyleSheet.create({
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  left:    { flex: 1 },
  amount:  { fontFamily: FONTS.bold, fontSize: 18, color: C.text },
  ref:     { fontFamily: FONTS.body, fontSize: 11, color: C.textSub, marginTop: 3, maxWidth: 180 },
  right:   { alignItems: 'flex-end', gap: 6 },
  badge:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: FONTS.bold, fontSize: 11 },
  time:    { fontFamily: FONTS.body, fontSize: 11, color: C.textSub },
});

const pl = StyleSheet.create({
  pill:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    backgroundColor: C.surface2,
  },
  count: { fontFamily: FONTS.bold, fontSize: 13 },
  label: { fontFamily: FONTS.body, fontSize: 12, color: C.textSub },
});
