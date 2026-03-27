import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

function FeatureRow({ icon, text, colors }: { icon: string; text: string; colors: any }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon as any} size={20} color={colors.primary} />
      <Text style={[styles.featureText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

export default function LoginScreen() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { colors, mode } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated === true) {
    return <Redirect href="/(tabs)" />;
  }

  const shadow = mode === 'dark'
    ? { shadowColor: colors.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 4 }
    : { shadowColor: colors.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accent, borderColor: colors.border, ...shadow }]}>
          <Ionicons name="cart" size={48} color={colors.text} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>CoolDown{'\n'}Cart</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Think twice.{'\n'}Spend once.
        </Text>

        <View style={styles.features}>
          <FeatureRow icon="time" text="AI-powered waiting periods" colors={colors} />
          <FeatureRow icon="chatbubble-ellipses" text="Talk to an AI financial advisor" colors={colors} />
          <FeatureRow icon="notifications" text="Get notified when it's time" colors={colors} />
        </View>

        <TouchableOpacity
          testID="google-sign-in-btn"
          style={[styles.loginButton, { backgroundColor: colors.primary, borderColor: colors.border, ...shadow }]}
          onPress={login}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={22} color={colors.text} />
          <Text style={[styles.loginButtonText, { color: colors.text }]}>Sign in with Google</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 24,
  },
  title: { fontSize: 48, fontWeight: '900', lineHeight: 52, letterSpacing: -1 },
  subtitle: { fontSize: 20, fontWeight: '400', marginTop: 12, lineHeight: 28 },
  features: { marginTop: 40, marginBottom: 48 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureText: { fontSize: 16, marginLeft: 12, fontWeight: '400' },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 2,
  },
  loginButtonText: { fontSize: 18, fontWeight: '700', marginLeft: 12 },
});
