import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { formatTime } from '../utils/chat';
import type { ChatMessage, RootStackParamList } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'> & {
  token: string;
  currentUserId: string;
};

export default function ChatScreen({ route, token, currentUserId }: Props) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get(`/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      Alert.alert(
        'Could not load messages',
        err?.response?.data?.message || err?.message || 'Please try again.',
      );
    }
  }, [chatId, token]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendMessage = async () => {
    const payload = text.trim();
    if (!payload) return;

    try {
      setSending(true);
      await api.post(
        '/messages',
        { chatId, text: payload },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setText('');
      await loadMessages();
    } catch (err: any) {
      Alert.alert(
        'Could not send message',
        err?.response?.data?.message || err?.message || 'Please try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isMine = item.senderId === currentUserId;
            return (
              <View style={[styles.bubbleWrap, isMine ? styles.mineWrap : styles.otherWrap]}>
                <View style={[styles.bubble, isMine ? styles.mineBubble : styles.otherBubble]}>
                  {!isMine && (
                    <Text style={styles.author}>{item.sender?.username || 'User'}</Text>
                  )}
                  <Text style={styles.messageText}>{item.text}</Text>
                  <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet</Text>}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a message"
            placeholderTextColor="#8194b8"
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable style={styles.send} onPress={sendMessage} disabled={sending}>
            <Text style={styles.sendText}>{sending ? '...' : '➤'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07152b',
  },
  container: {
    flex: 1,
    backgroundColor: '#07152b',
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  bubbleWrap: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  mineWrap: {
    justifyContent: 'flex-end',
  },
  otherWrap: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mineBubble: {
    backgroundColor: '#2d6cdf',
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: '#102443',
    borderBottomLeftRadius: 6,
  },
  author: {
    color: '#9cc1ff',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
  },
  time: {
    color: '#d4e1ff',
    opacity: 0.8,
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  emptyText: {
    color: '#8ea4c7',
    textAlign: 'center',
    marginTop: 40,
  },
  composer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1b2d52',
    backgroundColor: '#07152b',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    backgroundColor: '#102443',
    color: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2d6cdf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 2,
  },
});
