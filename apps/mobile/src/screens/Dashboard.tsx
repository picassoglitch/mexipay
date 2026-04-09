import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { clearTokens, getMe, listTransactions, type TransactionListItem, type Merchant } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7' },
  paid:    { label: 'Pagado',    color: '#16A34A', bg: '#DCFCE7' },
  expired: { label: 'Vencido',  color: '#6B7280', bg: '#F3F4F6' },
  failed:  { label: 'Fallido',  color: '#DC2626', bg: '#FEE2E2' },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatMXN(centavos: number) {
  return `$${(centavos / 100).toFixed(2)}`;
}

export default function DashboardScreen({ navigation }: Props) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, txResult] = await Promise.all([
        getMe(),
        listTransactions({ date: todayISO(), limit: 50 }),
      ]);
      setMerchant(me);
      setTransactions(txResult.data);

      const paid = txResult.data.filter((t) => t.status === 'paid');
      setTotalToday(paid.reduce((sum, t) => sum + t.amountCentavos - t.feeCentavos, 0));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await clearTokens();
        navigation.replace('Login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    load();
    // Refresh every 30 seconds
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await clearTokens();
          navigation.replace('Login');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {merchant?.businessName ?? 'Negocio'}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Today's summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Neto cobrado hoy</Text>
        <Text style={styles.summaryAmount}>{formatMXN(totalToday)}</Text>
        <Text style={styles.summaryCount}>
          {transactions.filter((t) => t.status === 'paid').length} pagos recibidos
        </Text>
      </View>

      {/* Charge FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Keypad')}>
        <Text style={styles.fabText}>+ Nuevo cobro</Text>
      </TouchableOpacity>

      {/* Transaction list */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListHeaderComponent={
          <Text style={styles.listTitle}>Transacciones de hoy</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sin transacciones hoy</Text>
            <Text style={styles.emptySubText}>Toca "+ Nuevo cobro" para comenzar</Text>
          </View>
        }
        renderItem={({ item }) => {
          const s = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
          return (
            <View style={styles.txCard}>
              <View style={styles.txLeft}>
                <Text style={styles.txAmount}>{formatMXN(item.amountCentavos)}</Text>
                <Text style={styles.txRef}>{item.reference}</Text>
                <Text style={styles.txTime}>{formatTime(item.createdAt)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: s.bg }]}>
                <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1A56DB',
  },
  greeting: { fontSize: 18, fontWeight: '700', color: '#fff' },
  date: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  summaryCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontSize: 40, fontWeight: '800', color: '#111827', marginVertical: 4, letterSpacing: -1 },
  summaryCount: { fontSize: 13, color: '#6B7280' },
  fab: {
    marginHorizontal: 16,
    backgroundColor: '#1A56DB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 10 },
  txCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  txLeft: { flex: 1 },
  txAmount: { fontSize: 17, fontWeight: '700', color: '#111827' },
  txRef: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  txTime: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  emptySubText: { fontSize: 13, color: '#D1D5DB', marginTop: 6 },
});
