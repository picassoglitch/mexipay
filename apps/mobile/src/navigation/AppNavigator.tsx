import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { C } from '../utils/colors';

import LoginScreen    from '../screens/Login';
import DashboardScreen from '../screens/Dashboard';
import KeypadScreen   from '../screens/Keypad';
import QRCodeScreen   from '../screens/QRCode';
import SuccessScreen  from '../screens/Success';

// ---------------------------------------------------------------------------
// Navigation types — shared across all screens
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Keypad: undefined;
  QRCode: {
    transactionId: string;
    clabe: string;
    reference: string;
    amountCentavos: number;
    feeCentavos: number;
    netCentavos: number;
    feePercent: string;
    expiresAt: string;
  };
  Success: {
    amountCentavos: number;
    feeCentavos: number;
    netCentavos: number;
    feePercent: string;
    reference: string;
    paidAt?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const merchant    = useAuthStore((s) => s.merchant);
  const isHydrated  = useAuthStore((s) => s.isHydrated);

  // Don't render navigation until SecureStore has been read
  if (!isHydrated) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'slide_from_right',
        }}
      >
        {merchant ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Keypad"    component={KeypadScreen}    />
            <Stack.Screen name="QRCode"    component={QRCodeScreen}    />
            <Stack.Screen
              name="Success"
              component={SuccessScreen}
              options={{ animation: 'fade' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
