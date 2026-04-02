import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://sic-their-personnel-upcoming.trycloudflare.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

type User = {
  id: string;
  username?: string;
  email?: string;
};

type Message = {
  id: string;
  text: string;
  senderId: string;
  sender?: User;
  createdAt?: string;
  createdAtLabel?: string;
};

type Member = {
  id: string;
  userId: string;
  role?: string;
  user?: User;
};

type Chat = {
  id: string;
  type?: string;
  title?: string | null;
  members?: Member[];
  messages?: Message[];
  createdAt?: string;
};

const STORAGE_TOKEN_KEY = 'pm_token';
const STORAGE_USER_ID_KEY = 'pm_user_id';
const STORAGE_EMAIL_KEY = 'pm_email';

export default function App() {
  const [bootLoading, setBootLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const authHeaders = useMemo(
    () =>
      token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    [token],
  );

  const formatMessageTime = (value?: string) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const normalizeMessages = (items: any[]): Message[] => {
    return items.map((item) => ({
      ...item,
      createdAtLabel: formatMessageTime(item?.createdAt),
    }));
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
        const savedUserId = await AsyncStorage.getItem(STORAGE_USER_ID_KEY);
        const savedEmail = await AsyncStorage.getItem(STORAGE_EMAIL_KEY);

        if (savedEmail) setEmail(savedEmail);
        if (savedToken) setToken(savedToken);
        if (savedUserId) setMyUserId(savedUserId);
      } catch (e) {
        console.log('restoreSession error', e);
      } finally {
        setBootLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleLogin = async () => {
    if (loading) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Ошибка', 'Введи email и пароль');
      return;
    }

    try {
      setLoading(true);

      const res = await api.post('/auth/login', {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      const accessToken = res.data?.accessToken;
      const userId = res.data?.user?.id;

      if (!accessToken) {
        Alert.alert('Ошибка', 'Сервер не вернул accessToken');
        return;
      }

      setToken(accessToken);
      setMyUserId(userId || null);

      await AsyncStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(STORAGE_EMAIL_KEY, trimmedEmail);
      if (userId) {
        await AsyncStorage.setItem(STORAGE_USER_ID_KEY, userId);
      }

      setPassword('');
    } catch (err: any) {
      console.log('login error', err?.response?.data || err?.message || err);
      Alert.alert(
        'Ошибка входа',
        err?.response?.data?.message || err?.message || 'Не удалось войти',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setToken(null);
    setMyUserId(null);
    setSelectedChatId(null);
    setMessages([]);
    setChats([]);
    setPassword('');

    await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
    await AsyncStorage.removeItem(STORAGE_USER_ID_KEY);
    setEmail('');
  };

  const loadChats = async () => {
    if (!token) return;

    try {
      setLoadingChats(true);
      const res = await api.get('/chats', { headers: authHeaders });
      setChats(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.log('loadChats error', err?.response?.data || err?.message || err);
      Alert.alert(
        'Ошибка загрузки',
        err?.response?.data?.message || err?.message || 'Не удалось получить чаты',
      );
    } finally {
      setLoadingChats(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!token) return;

    try {
      const res = await api.get(`/chats/${chatId}/messages`, {
        headers: authHeaders,
      });
      setMessages(Array.isArray(res.data) ? normalizeMessages(res.data) : []);
    } catch (err: any) {
      console.log('loadMessages error', err?.response?.data || err?.message || err);
      Alert.alert(
        'Ошибка загрузки сообщений',
        err?.response?.data?.message || err?.message || 'Не удалось получить сообщения',
      );
    }
  };

  const sendMessage = async () => {
    if (!token || !selectedChatId || !messageText.trim() || sending) return;

    try {
      setSending(true);

      await api.post(
        '/messages',
        {
          chatId: selectedChatId,
          text: messageText.trim(),
        },
        { headers: authHeaders },
      );

      setMessageText('');
      await loadMessages(selectedChatId);
      await loadChats();
    } catch (err: any) {
      console.log('sendMessage error', err?.response?.data || err?.message || err);
      Alert.alert(
        'Ошибка отправки',
        err?.response?.data?.message || err?.message || 'Не удалось отправить сообщение',
      );
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    loadChats();

    const interval = setInterval(() => {
      loadChats();
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!selectedChatId) return;

    loadMessages(selectedChatId);

    const interval = setInterval(() => {
      loadMessages(selectedChatId);
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedChatId, token]);

  const getChatDisplay = (chat: Chat) => {
    const otherUser = chat.members?.find((m) => m.user?.id !== myUserId)?.user;

    return {
      title: chat.title || otherUser?.username || 'Чат',
      subtitle: chat.messages?.[chat.messages.length - 1]?.text || 'Нет сообщений',
      avatarLetter: (chat.title || otherUser?.username || '?').charAt(0).toUpperCase(),
    };
  };

  if (bootLoading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authWrap}>
          <Text style={styles.title}>Private Messenger</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            spellCheck={false}
            textContentType="username"
            autoComplete="username"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Пароль"
            placeholderTextColor="#888"
            secureTextEntry
            autoCorrect={false}
            spellCheck={false}
            textContentType="password"
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Входим...' : 'Войти'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedChatId) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <View style={styles.header}>
            <Pressable onPress={() => setSelectedChatId(null)}>
              <Text style={styles.link}>← Назад</Text>
            </Pressable>

            <Text style={styles.headerTitle}>Чат</Text>

            <View style={styles.headerSpacer} />
          </View>

          <FlatList
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            initialScrollIndex={messages.length > 0 ? messages.length - 1 : 0}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            getItemLayout={(_, index) => ({
              length: 86,
              offset: 86 * index,
              index,
            })}
            onScrollToIndexFailed={() => {
              setTimeout(() => {
                if (selectedChatId) {
                  loadMessages(selectedChatId);
                }
              }, 150);
            }}
            onContentSizeChange={() => {
              // keeps the list naturally anchored near the latest messages
            }}
            renderItem={({ item }) => {
              const isMine = item.senderId === myUserId;

              return (
                <View style={styles.messageRow}>
                  <View
                    style={[
                      styles.messageBubble,
                      isMine ? styles.myMessage : styles.otherMessage,
                    ]}
                  >
                    <Text style={styles.messageAuthor}>{item.sender?.username || 'User'}</Text>
                    <Text style={styles.messageText}>{item.text}</Text>
                    {!!item.createdAtLabel && (
                      <Text style={styles.messageTime}>{item.createdAtLabel}</Text>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>Сообщений пока нет</Text>}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.messageInput}
              placeholder="Сообщение..."
              placeholderTextColor="#888"
              value={messageText}
              onChangeText={setMessageText}
              autoCorrect
              spellCheck
              autoCapitalize="sentences"
              keyboardAppearance="dark"
              returnKeyType="send"
              enablesReturnKeyAutomatically
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />

            <Pressable style={styles.sendButton} onPress={sendMessage} disabled={sending}>
              <Text style={styles.sendText}>{sending ? '...' : '➤'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Чаты</Text>

        <Pressable onPress={handleLogout}>
          <Text style={styles.logout}>Выйти</Text>
        </Pressable>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const display = getChatDisplay(item);

          return (
            <Pressable
              style={styles.chatCard}
              onPress={async () => {
                setSelectedChatId(item.id);
                await loadMessages(item.id);
              }}
            >
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{display.avatarLetter}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.username}>{display.title}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {display.subtitle}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>Чатов пока нет</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  authWrap: {
    padding: 20,
    marginTop: 100,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 20,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  logout: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 72,
  },
  chatCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  username: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  lastMessage: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 12,
    justifyContent: 'flex-end',
    flexGrow: 1,
  },
  messageRow: {
    width: '100%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    maxWidth: '80%',
    minWidth: 96,
    paddingBottom: 8,
  },
  myMessage: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
  },
  messageAuthor: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageTime: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
    opacity: 0.85,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    marginRight: 10,
    minHeight: 48,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
