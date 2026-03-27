import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';

interface Message {
  message_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Purchase {
  purchase_id: string;
  item_name: string;
  cost: number;
  waiting_hours: number;
  expires_at: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadChat();
  }, [id]);

  const loadChat = async () => {
    try {
      const data = await api.get(`/chat/${id}`);
      setMessages(data.messages);
      setPurchase(data.purchase);
    } catch (e) {
      console.error('Load chat error:', e);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: Message = {
      message_id: `temp_${Date.now()}`,
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const data = await api.post(`/chat/${id}`, { message: msg });
      setMessages(prev => {
        const filtered = prev.filter(m => m.message_id !== tempUserMsg.message_id);
        return [...filtered, data.user_message, data.ai_message];
      });
    } catch (e) {
      console.error('Send error:', e);
      setMessages(prev => prev.filter(m => m.message_id !== tempUserMsg.message_id));
    } finally {
      setSending(false);
    }
  };

  const shadow = mode === 'dark'
    ? { shadowColor: colors.shadow, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.5, shadowRadius: 0, elevation: 3 }
    : { shadowColor: colors.shadow, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View
        testID={`chat-message-${item.message_id}`}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          {
            backgroundColor: isUser ? colors.secondary : colors.surface,
            borderColor: colors.border,
            ...shadow,
          },
        ]}
      >
        {!isUser && (
          <View style={styles.aiLabel}>
            <Ionicons name="bulb" size={14} color={colors.accent} />
            <Text style={[styles.aiLabelText, { color: colors.accent }]}>Advisor</Text>
          </View>
        )}
        <Text style={[styles.messageText, { color: isUser ? '#fff' : colors.text }]}>
          {item.content}
        </Text>
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
      <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity testID="chat-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chatTitle, { color: colors.text }]} numberOfLines={1}>
            {purchase?.item_name || 'Chat'}
          </Text>
          <Text style={[styles.chatSubtitle, { color: colors.primary }]}>
            ${purchase?.cost?.toFixed(2) || '0'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
              Start a conversation.{'\n'}I'll try to talk you out of it.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.message_id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            testID="chat-input"
            style={[styles.chatInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Tell me why you want this..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            testID="chat-send-btn"
            style={[styles.sendBtn, {
              backgroundColor: sending || !input.trim() ? colors.textMuted : colors.primary,
              borderColor: colors.border,
            }]}
            onPress={sendMessage}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="send" size={20} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 2,
  },
  backBtn: { padding: 8, marginRight: 8 },
  chatTitle: { fontSize: 18, fontWeight: '900' },
  chatSubtitle: { fontSize: 14, fontWeight: '700' },
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: { borderWidth: 2, borderRadius: 12, padding: 14, marginBottom: 12, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start' },
  aiLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiLabelText: { fontSize: 12, fontWeight: '900', marginLeft: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48 },
  emptyChatText: { fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16,
    paddingVertical: 12, borderTopWidth: 2,
  },
  chatInput: {
    flex: 1, borderWidth: 2, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 16, maxHeight: 100, marginRight: 12,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
});
