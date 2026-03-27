import { View, Text, TouchableOpacity, StyleSheet, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function SettingsScreen() {
  const { colors, mode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const shadow = mode === 'dark'
    ? { shadowColor: colors.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 4 }
    : { shadowColor: colors.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border, ...shadow }]}>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={[styles.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { borderColor: colors.border, backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.text }]}>
              {user?.name?.[0] || '?'}
            </Text>
          </View>
        )}
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.userEmail, { color: colors.textMuted }]}>{user?.email || ''}</Text>
        </View>
      </View>

      <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.settingLeft}>
          <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={24} color={colors.accent} />
          <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
        </View>
        <Switch
          testID="theme-toggle"
          value={mode === 'dark'}
          onValueChange={toggleTheme}
          trackColor={{ false: '#ccc', true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>

      <View style={[styles.aboutSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.aboutTitle, { color: colors.text }]}>About CoolDown Cart</Text>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>
          CoolDown Cart uses AI to help you resist impulse purchases by generating smart waiting periods and providing a financial advisor chatbot to talk you out of unnecessary spending.
        </Text>
      </View>

      <TouchableOpacity
        testID="logout-btn"
        style={[styles.logoutBtn, { borderColor: colors.error }]}
        onPress={logout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out" size={22} color={colors.error} />
        <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 24,
    borderWidth: 2, borderRadius: 12, padding: 20, marginBottom: 24,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '900' },
  userName: { fontSize: 20, fontWeight: '900' },
  userEmail: { fontSize: 14, marginTop: 2 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 24, borderWidth: 2, borderRadius: 12, padding: 20, marginBottom: 16,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: { fontSize: 18, fontWeight: '700', marginLeft: 12 },
  aboutSection: {
    marginHorizontal: 24, borderWidth: 2, borderRadius: 12, padding: 20, marginBottom: 24,
  },
  aboutTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  aboutText: { fontSize: 14, lineHeight: 22 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 24, borderWidth: 2, borderRadius: 12, paddingVertical: 16,
  },
  logoutText: { fontSize: 16, fontWeight: '900', marginLeft: 8 },
});
