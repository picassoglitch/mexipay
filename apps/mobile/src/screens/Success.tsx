import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

function formatMXN(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}

export default function SuccessScreen({ navigation, route }: Props) {
  const { transaction } = route.params;

  const amountMXN = formatMXN(transaction.amountCentavos);
  const feeMXN = formatMXN(transaction.feeCentavos);
  const netMXN = formatMXN(transaction.netCentavos);

  const paidAt = transaction.paidAt
    ? new Date(transaction.paidAt).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Success icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>✓</Text>
        </View>

        <Text style={styles.title}>¡Pago recibido!</Text>
        <Text style={styles.subtitle}>Transferencia SPEI confirmada</Text>

        {/* Main amount */}
        <Text style={styles.amount}>{amountMXN} MXN</Text>

        {/* Fee breakdown card */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Desglose del cobro</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total cobrado</Text>
            <Text style={styles.rowValue}>{amountMXN}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>Comisión MexiPay</Text>
              <Text style={styles.rowSubLabel}>{transaction.feePercent ?? '1.80%'} (mín. $6.00)</Text>
            </View>
            <Text style={[styles.rowValue, styles.feeValue]}>- {feeMXN}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, styles.netLabel]}>Neto para ti</Text>
            <Text style={[styles.rowValue, styles.netValue]}>{netMXN}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <Row label="Referencia" value={transaction.reference} />
          <Row label="ID transacción" value={transaction.id.slice(0, 8).toUpperCase()} />
          <Row label="Hora de pago" value={paidAt} />
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.replace('Keypad')}
        >
          <Text style={styles.primaryButtonText}>Nuevo cobro</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.replace('Dashboard')}
        >
          <Text style={styles.secondaryButtonText}>Ver transacciones</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0FDF4' },
  scroll: { padding: 24, alignItems: 'center' },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  iconText: { fontSize: 44, color: '#fff', fontWeight: '800', lineHeight: 52 },
  title: { fontSize: 26, fontWeight: '800', color: '#14532D', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#16A34A', marginBottom: 20 },
  amount: {
    fontSize: 52,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -2,
    marginBottom: 28,
  },
  breakdownCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  rowSubLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rowValue: { fontSize: 15, color: '#111827', fontWeight: '600' },
  feeValue: { color: '#DC2626' },
  netLabel: { fontWeight: '700', fontSize: 16 },
  netValue: { fontWeight: '800', fontSize: 18, color: '#16A34A' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  detailsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  primaryButton: {
    width: '100%',
    backgroundColor: '#1A56DB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#1A56DB', fontSize: 15, fontWeight: '600' },
});
