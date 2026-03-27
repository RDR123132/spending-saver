import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/utils/api';

interface Purchase {
  purchase_id: string;
  item_name: string;
  cost: number;
  waiting_hours: number;
  waiting_reason: string;
  created_at: string;
  expires_at: string;
  status: string;
}

export default function DashboardScreen() {
  const { colors, mode } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchPurchases = useCallback(async () => {
    try {
      const data = await api.get('/purchases');
      setPurchases(data);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPurchases();
  };

  const handleDecide = async (purchaseId: string, decision: string) => {
    try {
      await api.patch(`/purchases/${purchaseId}/decide`, { decision });
      fetchPurchases();
    } catch (e) {
      console.error('Decide error:', e);
    }
  };

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now.getTime();
    if (diff <= 0) return { text: "Time's up!", expired: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    const days = Math.floor(hours / 24);
    if (days >= 7) {
      const weeks = Math.floor(days / 7);
      const remainDays = days % 7;
      return { text: `${weeks}w ${remainDays}d`, expired: false };
    }
    if (days > 0) return { text: `${days}d ${hours % 24}h`, expired: false };
    if (hours > 0) return { text: `${hours}h ${mins}m`, expired: false };
    return { text: `${mins}m ${secs}s`, expired: false };
  };

  const getProgress = (purchase: Purchase) => {
    const created = new Date(purchase.created_at).getTime();
    const expires = new Date(purchase.expires_at).getTime();
    const total = expires - created;
    const elapsed = now.getTime() - created;
    return Math.min(1, Math.max(0, elapsed / total));
  };

  const shadow = mode === 'dark'
    ? { shadowColor: colors.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 4 }
    : { shadowColor: colors.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 };

  const renderPurchase = ({ item }: { item: Purchase }) => {
    const timeInfo = getTimeLeft(item.expires_at);
    const progress = getProgress(item);

    return (
      <View
        testID={`purchase-card-${item.purchase_id}`}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow }]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, { color: colors.text }]}>{item.item_name}</Text>
            <Text style={[styles.cost, { color: colors.primary }]}>${item.cost.toFixed(2)}</Text>
          </View>
          <View
            style={[
              styles.timerBadge,
              {
                backgroundColor: timeInfo.expired ? colors.accent : colors.secondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.timerText, { color: timeInfo.expired ? '#0A0A0A' : '#fff' }]}>
              {timeInfo.text}
            </Text>
          </View>
        </View>

        <Text style={[styles.reason, { color: colors.textMuted }]}>{item.waiting_reason}</Text>

        <View style={[styles.progressBg, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: timeInfo.expired ? colors.accent : colors.primary,
              },
            ]}
          />
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            testID={`chat-btn-${item.purchase_id}`}
            style={[styles.chatBtn, { borderColor: colors.border }]}
            onPress={() => router.push(`/chat/${item.purchase_id}`)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.secondary} />
            <Text style={[styles.chatBtnText, { color: colors.text }]}>Talk me out of it</Text>
          </TouchableOpacity>

          {timeInfo.expired && (
            <View style={styles.decisionRow}>
              <TouchableOpacity
                testID={`skip-btn-${item.purchase_id}`}
                style={[styles.decideBtn, { backgroundColor: colors.success, borderColor: colors.border }]}
                onPress={() => handleDecide(item.purchase_id, 'skipped')}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={styles.decideBtnText}>Skip It</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`buy-btn-${item.purchase_id}`}
                style={[styles.decideBtn, { backgroundColor: colors.error, borderColor: colors.border }]}
                onPress={() => handleDecide(item.purchase_id, 'bought')}
              >
                <Ionicons name="cart" size={18} color="#fff" />
                <Text style={styles.decideBtnText}>Bought It</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.textMuted }]}>
          Hey, {user?.name?.split(' ')[0] || 'there'}
        </Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Queue</Text>
      </View>

      {purchases.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf" size={64} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>All clear!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            No impulse purchases waiting.{'\n'}Your wallet thanks you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.purchase_id}
          renderItem={renderPurchase}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 16, fontWeight: '400' },
  headerTitle: { fontSize: 32, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
  listContent: { paddingHorizontal: 24, paddingBottom: 24 },
  card: { borderWidth: 2, borderRadius: 12, padding: 20, marginTop: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  cost: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  timerBadge: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  timerText: { fontSize: 16, fontWeight: '900' },
  reason: { fontSize: 14, marginTop: 12, lineHeight: 20 },
  progressBg: { height: 6, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  cardActions: { marginTop: 16 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderRadius: 8, paddingVertical: 12,
  },
  chatBtnText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  decisionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  decideBtn: {
    flex: 1, flexDirection: 'row', borderWidth: 2, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  decideBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48 },
  emptyTitle: { fontSize: 28, fontWeight: '900', marginTop: 16 },
  emptySubtitle: { fontSize: 16, textAlign: 'center', marginTop: 8, lineHeight: 24 },
});
