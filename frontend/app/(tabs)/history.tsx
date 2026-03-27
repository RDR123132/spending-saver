import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';

interface Purchase {
  purchase_id: string;
  item_name: string;
  cost: number;
  status: string;
  created_at: string;
}

export default function HistoryScreen() {
  const { colors, mode } = useTheme();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.get('/purchases/history');
      setPurchases(data);
    } catch (e) {
      console.error('History fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const totalSaved = purchases.filter(p => p.status === 'skipped').reduce((sum, p) => sum + p.cost, 0);
  const totalSpent = purchases.filter(p => p.status === 'bought').reduce((sum, p) => sum + p.cost, 0);
  const skipCount = purchases.filter(p => p.status === 'skipped').length;

  const shadow = mode === 'dark'
    ? { shadowColor: colors.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 4 }
    : { shadowColor: colors.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 };

  const renderItem = ({ item }: { item: Purchase }) => (
    <View
      testID={`history-card-${item.purchase_id}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.text }]}>{item.item_name}</Text>
          <Text style={[styles.itemCost, { color: colors.textMuted }]}>${item.cost.toFixed(2)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: item.status === 'skipped' ? colors.success : colors.error,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={item.status === 'skipped' ? 'checkmark' : 'cart'}
            size={16}
            color="#fff"
          />
          <Text style={styles.statusText}>
            {item.status === 'skipped' ? 'Skipped' : 'Bought'}
          </Text>
        </View>
      </View>
    </View>
  );

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.success, borderColor: colors.border, ...shadow }]}>
          <Text style={styles.statValue}>${totalSaved.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.error, borderColor: colors.border, ...shadow }]}>
          <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.accent, borderColor: colors.border, ...shadow }]}>
          <Text style={[styles.statValue, { color: '#0A0A0A' }]}>{skipCount}</Text>
          <Text style={[styles.statLabel, { color: '#0A0A0A' }]}>Resisted</Text>
        </View>
      </View>

      {purchases.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No history yet.{'\n'}Your journey begins now.
          </Text>
        </View>
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.purchase_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginTop: 16 },
  statCard: {
    flex: 1, borderWidth: 2, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#fff', marginTop: 4 },
  listContent: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  card: { borderWidth: 2, borderRadius: 8, padding: 16, marginTop: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '700' },
  itemCost: { fontSize: 14, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  statusText: { fontSize: 12, fontWeight: '900', color: '#fff', marginLeft: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48 },
  emptyText: { fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24 },
});
