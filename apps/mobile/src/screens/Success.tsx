import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { C, FONTS } from '../utils/colors';
import { formatMXN, formatDateTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export default function SuccessScreen({ navigation, route }: Props) {
  const { amountCentavos, feeCentavos, netCentavos, feePercent, reference, paidAt } =
    route.params;

  // ── Entrance animation ────────────────────────────────────────────────────
  const scale   = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const displayDate = paidAt ? formatDateTime(paidAt) : formatDateTime(new Date().toISOString());

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Check animation ── */}
        <Animated.View style={[s.checkWrap, { transform: [{ scale }], opacity }]}>
          <View style={s.checkRing}>
            <View style={s.checkCircle}>
              <Text style={s.checkMark}>✓</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Title ── */}
        <Animated.View style={{ opacity, transform: [{ translateY: slideUp }] }}>
          <Text style={s.title}>¡Pago recibido!</Text>
          <Text style={s.subtitle}>Transferencia SPEI confirmada</Text>
        </Animated.View>

        {/* ── Amount ── */}
        <Animated.View style={[s.amountArea, { opacity, transform: [{ translateY: slideUp }] }]}>
          <Text style={s.amount}>{formatMXN(amountCentavos)}</Text>
          <Text style={s.amountLabel}>MXN</Text>
        </Animated.View>

        {/* ── Fee breakdown card ── */}
        <Animated.View style={[s.card, { opacity, transform: [{ translateY: slideUp }] }]}>
          <Text style={s.cardTitle}>Desglose del cobro</Text>

          <Row
            label="Total cobrado"
            value={formatMXN(amountCentavos)}
            valueColor={C.text}
          />
          <View style={s.divider} />
          <Row
            label={`Comisión MexiPay (${feePercent})`}
            sublabel="Mín. $6.00 · 1.80%"
            value={`- ${formatMXN(feeCentavos)}`}
            valueColor={C.failed}
          />
          <View style={s.divider} />
          <Row
            label="Neto para ti"
            value={formatMXN(netCentavos)}
            valueColor={C.accent}
            large
          />
        </Animated.View>

        {/* ── Details card ── */}
        <Animated.View style={[s.card, { opacity, transform: [{ translateY: slideUp }] }]}>
          <DetailRow label="Referencia SPEI" value={reference} />
          <DetailRow label="Hora de pago"    value={displayDate} />
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View style={[s.actions, { opacity }]}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => navigation.replace('Keypad')}
          >
            <Text style={s.primaryBtnText}>Nuevo cobro</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => navigation.replace('Dashboard')}
          >
            <Text style={s.secondaryBtnText}>Ver transacciones</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Row({
  label, sublabel, value, valueColor, large,
}: {
  label: string; sublabel?: string; value: string;
  valueColor: string; large?: boolean;
}) {
  return (
    <View style={r.row}>
      <View style={r.rowLeft}>
        <Text style={[r.label, large && r.labelLarge]}>{label}</Text>
        {sublabel && <Text style={r.sublabel}>{sublabel}</Text>}
      </View>
      <Text style={[r.value, { color: valueColor }, large && r.valueLarge]}>{value}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={r.detailRow}>
      <Text style={r.detailLabel}>{label}</Text>
      <Text style={r.detailValue}>{value}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12 },
  rowLeft:    { flex: 1 },
  label:      { fontFamily: FONTS.medium, fontSize: 14, color: C.text },
  labelLarge: { fontFamily: FONTS.bold,   fontSize: 16 },
  sublabel:   { fontFamily: FONTS.body,   fontSize: 11, color: C.textSub, marginTop: 2 },
  value:      { fontFamily: FONTS.bold,   fontSize: 14 },
  valueLarge: { fontSize: 20 },
  detailRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  detailLabel:{ fontFamily: FONTS.body,   fontSize: 13, color: C.textSub },
  detailValue:{ fontFamily: FONTS.medium, fontSize: 13, color: C.text },
});

// ── Main styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center' },

  checkWrap: { marginTop: 32, marginBottom: 28 },
  checkRing: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: C.accentBg, justifyContent: 'center', alignItems: 'center',
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 20, elevation: 12,
  },
  checkMark: { fontFamily: FONTS.heading, fontSize: 40, color: C.bg, lineHeight: 48 },

  title:    { fontFamily: FONTS.heading, fontSize: 30, color: C.text, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: FONTS.body,   fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 6, marginBottom: 8 },

  amountArea: { alignItems: 'center', marginVertical: 20 },
  amount:     { fontFamily: FONTS.heading, fontSize: 60, color: C.accent, letterSpacing: -2 },
  amountLabel:{ fontFamily: FONTS.medium,  fontSize: 14, color: C.textSub, marginTop: -4 },

  card:      {
    width: '100%', backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 12,
  },
  cardTitle: { fontFamily: FONTS.medium, fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  divider:   { height: 1, backgroundColor: C.border },

  actions:       { width: '100%', marginTop: 8, gap: 10 },
  primaryBtn:    {
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  primaryBtnText:  { fontFamily: FONTS.bold, fontSize: 17, color: C.bg },
  secondaryBtn:    {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.border2,
  },
  secondaryBtnText: { fontFamily: FONTS.medium, fontSize: 16, color: C.text },
});
