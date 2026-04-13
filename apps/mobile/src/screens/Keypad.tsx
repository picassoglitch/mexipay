import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { createTransaction } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { C, FONTS } from '../utils/colors';
import { formatMXN } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Keypad'>;

const { width } = Dimensions.get('window');
const KEY_SIZE  = Math.floor((width - 48 - 16) / 3); // 3 cols, 24px side padding, 8px gaps

const KEYS: string[] = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

const MIN_CENTAVOS = 100;   // $1.00 MXN
const MAX_CENTAVOS = 9_999_900; // $99,999.00 MXN

const MIN_FEE = 600;       // $6.00 MXN flat minimum
const FEE_BP  = 180;       // 1.80% in basis points

function calcFee(centavos: number) {
  const pct = Math.round((centavos * FEE_BP) / 10_000);
  const fee = Math.max(MIN_FEE, pct);
  return { fee, net: centavos - fee };
}

export default function KeypadScreen({ navigation }: Props) {
  const merchant = useAuthStore((s) => s.merchant);
  const [digits, setDigits]   = useState('0');
  const [loading, setLoading] = useState(false);

  function press(key: string) {
    setDigits((prev) => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }
      // Limit to 2 decimal places
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      const next = prev === '0' ? key : prev + key;
      // Guard max
      if (parseFloat(next) * 100 > MAX_CENTAVOS) return prev;
      return next;
    });
  }

  const amount    = parseFloat(digits) || 0;
  const centavos  = Math.round(amount * 100);
  const canCharge = centavos >= MIN_CENTAVOS && !loading;
  const { fee, net } = centavos >= MIN_CENTAVOS ? calcFee(centavos) : { fee: 0, net: 0 };

  async function charge() {
    if (!canCharge) return;
    setLoading(true);
    try {
      const tx = await createTransaction({
        amountCentavos:  centavos,
        description:     'Pago MexiPay',
        idempotencyKey:  `${Date.now()}-${centavos}`,
      });
      navigation.navigate('QRCode', {
        transactionId: tx.id,
        clabe:         tx.clabe,
        reference:     tx.reference,
        amountCentavos: tx.amountCentavos,
        feeCentavos:    tx.feeCentavos,
        netCentavos:    tx.netCentavos,
        feePercent:     tx.feePercent,
        expiresAt:      tx.expiresAt,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'No se pudo crear el cobro. Intenta de nuevo.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  // Format display: add thousands separators to integer part
  const [intPart, decPart] = digits.split('.');
  const intFormatted = parseInt(intPart, 10).toLocaleString('es-MX');
  const displayAmt   = decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Nuevo cobro</Text>
          {merchant && (
            <Text style={s.headerSub} numberOfLines={1}>{merchant.businessName}</Text>
          )}
        </View>
        <View style={s.backBtn} />
      </View>

      {/* ── Amount display ── */}
      <View style={s.amountArea}>
        <Text style={s.currency}>MXN</Text>
        <Text style={s.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          ${displayAmt}
        </Text>

        {centavos >= MIN_CENTAVOS ? (
          <View style={s.feeRow}>
            <FeeChip label="Comisión" value={formatMXN(fee)} color={C.textSub} />
            <View style={s.feeDot} />
            <FeeChip label="Recibes" value={formatMXN(net)} color={C.accent} />
          </View>
        ) : (
          <Text style={s.minHint}>Mínimo $1.00 MXN</Text>
        )}
      </View>

      {/* ── Number pad ── */}
      <View style={s.pad}>
        {KEYS.map((k) => (
          <TouchableOpacity
            key={k}
            style={[s.key, k === '⌫' && s.keyBackspace]}
            onPress={() => press(k)}
            activeOpacity={0.55}
            disabled={loading}
          >
            <Text style={[s.keyText, k === '⌫' && s.keyTextBack]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── CTA ── */}
      <View style={s.ctaArea}>
        <TouchableOpacity
          style={[s.chargeBtn, !canCharge && s.chargeBtnDim]}
          onPress={charge}
          disabled={!canCharge}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={s.chargeBtnText}>
              {centavos >= MIN_CENTAVOS ? `Cobrar ${formatMXN(centavos)}` : 'Cobrar'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function FeeChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Text style={[{ fontFamily: FONTS.body, fontSize: 13, color }]}>
      <Text style={{ color: C.textSub }}>{label} </Text>{value}
    </Text>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  backBtn:      { width: 40, height: 40, justifyContent: 'center' },
  backArrow:    { fontFamily: FONTS.body, fontSize: 22, color: C.text },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontFamily: FONTS.subheading, fontSize: 16, color: C.text },
  headerSub:    { fontFamily: FONTS.body, fontSize: 12, color: C.accent, marginTop: 2 },

  amountArea: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28 },
  currency:   { fontFamily: FONTS.medium, fontSize: 13, color: C.textSub, marginBottom: 4 },
  amount:     {
    fontFamily: FONTS.heading, fontSize: 72, color: C.text,
    letterSpacing: -2, lineHeight: 80,
  },
  feeRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  feeDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: C.border2 },
  minHint: { fontFamily: FONTS.body, fontSize: 13, color: C.textDim, marginTop: 10 },

  pad: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 24, gap: 8, justifyContent: 'space-between',
    flex: 1,
  },
  key: {
    width: KEY_SIZE, height: KEY_SIZE * 0.65,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  keyBackspace: { backgroundColor: C.surface2 },
  keyText:     { fontFamily: FONTS.subheading, fontSize: 26, color: C.text },
  keyTextBack: { color: C.textSub },

  ctaArea:      { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  chargeBtn:    {
    backgroundColor: C.accent, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  chargeBtnDim:  { backgroundColor: C.surface3, shadowOpacity: 0 },
  chargeBtnText: { fontFamily: FONTS.bold, fontSize: 18, color: C.bg },
});
