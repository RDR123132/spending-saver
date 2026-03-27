import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';
import * as Notifications from 'expo-notifications';

export default function AddPurchaseScreen() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const [itemName, setItemName] = useState('');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const shadow = mode === 'dark'
    ? { shadowColor: colors.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 4 }
    : { shadowColor: colors.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 };

  const scheduleNotification = async (purchase: any) => {
    try {
      const expiresAt = new Date(purchase.expires_at);
      const secondsUntilExpiry = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time's Up!",
          body: `Your waiting period for "${purchase.item_name}" ($${purchase.cost.toFixed(2)}) has ended. Ready to decide?`,
          data: { purchaseId: purchase.purchase_id },
        },
        trigger: { seconds: secondsUntilExpiry, repeats: false } as any,
      });
    } catch (err) {
      console.log('Could not schedule notification:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!itemName.trim() || !cost.trim()) {
      setError('Please fill in both fields');
      return;
    }
    const costNum = parseFloat(cost);
    if (isNaN(costNum) || costNum <= 0) {
      setError('Please enter a valid cost');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/purchases', { item_name: itemName.trim(), cost: costNum });
      setResult(data);
      await scheduleNotification(data);
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setItemName('');
    setCost('');
    setResult(null);
    router.navigate('/(tabs)');
  };

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) {
      const h = Math.round(hours);
      return `${h} hour${h !== 1 ? 's' : ''}`;
    }
    const days = Math.round(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>Add Impulse</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>What are you tempted to buy?</Text>

          {!result ? (
            <View style={styles.formSection}>
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface, ...shadow }]}>
                <Ionicons name="bag-handle" size={22} color={colors.primary} />
                <TextInput
                  testID="item-name-input"
                  style={[styles.input, { color: colors.text }]}
                  placeholder="What is it?"
                  placeholderTextColor={colors.textMuted}
                  value={itemName}
                  onChangeText={setItemName}
                  autoCapitalize="sentences"
                />
              </View>

              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface, ...shadow }]}>
                <Text style={[styles.dollarSign, { color: colors.primary }]}>$</Text>
                <TextInput
                  testID="cost-input"
                  style={[styles.input, { color: colors.text }]}
                  placeholder="How much?"
                  placeholderTextColor={colors.textMuted}
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="decimal-pad"
                />
              </View>

              {error ? <Text testID="form-error" style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

              <TouchableOpacity
                testID="analyze-btn"
                style={[styles.analyzeBtn, {
                  backgroundColor: colors.primary,
                  borderColor: colors.border,
                  ...shadow,
                  opacity: loading ? 0.7 : 1,
                }]}
                onPress={handleAnalyze}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="flash" size={22} color={colors.text} />
                    <Text style={[styles.analyzeBtnText, { color: colors.text }]}>Analyze with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View testID="analysis-result" style={styles.resultSection}>
              <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow }]}>
                <View style={[styles.waitBadge, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Ionicons name="time" size={24} color="#0A0A0A" />
                  <Text style={[styles.waitTime, { color: '#0A0A0A' }]}>{formatHours(result.waiting_hours)}</Text>
                </View>

                <Text style={[styles.resultItem, { color: colors.text }]}>{result.item_name}</Text>
                <Text style={[styles.resultCost, { color: colors.primary }]}>${result.cost.toFixed(2)}</Text>
                <Text style={[styles.resultReason, { color: colors.textMuted }]}>{result.waiting_reason}</Text>
              </View>

              <TouchableOpacity
                testID="done-btn"
                style={[styles.doneBtn, { backgroundColor: colors.success, borderColor: colors.border, ...shadow }]}
                onPress={handleDone}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.doneBtnText}>Start Waiting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="add-another-btn"
                style={[styles.addAnotherBtn, { borderColor: colors.border }]}
                onPress={() => { setResult(null); setItemName(''); setCost(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.addAnotherText, { color: colors.text }]}>Add Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 16, marginTop: 4, marginBottom: 32 },
  formSection: {},
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 18, fontWeight: '500', paddingVertical: 16, marginLeft: 12 },
  dollarSign: { fontSize: 22, fontWeight: '900' },
  errorText: { fontSize: 14, marginBottom: 16, fontWeight: '600' },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 12, borderWidth: 2, marginTop: 8,
  },
  analyzeBtnText: { fontSize: 18, fontWeight: '900', marginLeft: 8 },
  resultSection: { marginTop: 8 },
  resultCard: { borderWidth: 2, borderRadius: 16, padding: 24, alignItems: 'center' },
  waitBadge: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: 20,
  },
  waitTime: { fontSize: 24, fontWeight: '900', marginLeft: 8 },
  resultItem: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  resultCost: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  resultReason: { fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 22 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 12, borderWidth: 2, marginTop: 24, gap: 8,
  },
  doneBtnText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  addAnotherBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginTop: 12,
  },
  addAnotherText: { fontSize: 16, fontWeight: '700' },
});
