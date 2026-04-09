import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TransactionCreated } from '../services/api';

import LoginScreen from '../screens/Login';
import KeypadScreen from '../screens/Keypad';
import QRCodeScreen from '../screens/QRCode';
import SuccessScreen from '../screens/Success';
import DashboardScreen from '../screens/Dashboard';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Keypad: undefined;
  QRCode: { transaction: TransactionCreated };
  Success: { transaction: TransactionCreated };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#1A56DB' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'MexiPay' }} />
        <Stack.Screen name="Keypad" component={KeypadScreen} options={{ title: 'Nuevo Cobro' }} />
        <Stack.Screen name="QRCode" component={QRCodeScreen} options={{ title: 'Esperando Pago' }} />
        <Stack.Screen name="Success" component={SuccessScreen} options={{ title: 'Pago Recibido' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
