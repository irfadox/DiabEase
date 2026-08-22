import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Bot, Send, Sparkles } from 'lucide-react-native';
import { getLogs } from '../utils/storage';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangAIScreen from '../lang/LangAIScreen';

export default function AIScreen() {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangAIScreen[language];

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef();

  useEffect(() => {
    setMessages([
      { id: '1', text: t.welcomeMessage, sender: 'ai' }
    ]);
  }, [language]);

  const polishAIResponse = (text) => {
    return text
      .replace(/\*\*/g, '')
      .replace(/###/g, '')
      .replace(/#/g, '')
      .replace(/```/g, '')
      .trim();
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const userMsg = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    const logs = await getLogs();
    const recentLogsContext = logs.slice(0, 5).map(l => 
        t.logContextLine
          .replace('{date}', new Date(l.timestamp).toLocaleDateString())
          .replace('{sugar}', l.sugar_level)
          .replace('{notes}', l.notes)
    ).join('\n');

    const systemPrompt = t.systemPrompt.replace('{context}', recentLogsContext);

    try {
        const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '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';
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://cyberbloom.app",
                "X-Title": "DiabEase App",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "deepseek/deepseek-chat",
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": userText }
                ]
            })
        });

        const data = await response.json();
        const rawContent = data.choices[0].message.content;
        const polishedContent = polishAIResponse(rawContent);

        const aiMsg = {
            id: (Date.now() + 1).toString(),
            text: polishedContent,
            sender: 'ai',
        };
        setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
        console.error("AI Error:", error);
        const errorMsg = {
            id: (Date.now() + 1).toString(),
            text: t.errorMessage,
            sender: 'ai',
        };
        setMessages(prev => [...prev, errorMsg]);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.messageWrapper, item.sender === 'user' ? styles.userWrapper : styles.aiWrapper]}>
      {item.sender === 'ai' && <View style={styles.aiIcon}><Bot size={16} color="white" /></View>}
      <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.text, item.sender === 'user' ? styles.userText : styles.aiText, { fontSize: getAdjustedFontSize(16) }]}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Sparkles color="#6366f1" size={20} />
        <Text style={[styles.headerSubtitle, { fontSize: getAdjustedFontSize(14) }]}>{t.headerSubtitle}</Text>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current.scrollToEnd()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
            placeholder={t.inputPlaceholder}
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Send color="white" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#f5fffb', borderBottomWidth: 1, borderBottomColor: '#e0fff4' },
  headerSubtitle: { marginLeft: 10, fontSize: 14, color: '#00BFA5', fontWeight: '600' },
  list: { padding: 15 },
  messageWrapper: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  userWrapper: { justifyContent: 'flex-end' },
  aiWrapper: { justifyContent: 'flex-start' },
  aiIcon: { backgroundColor: '#00BFA5', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 18 },
  userBubble: { backgroundColor: '#00BFA5', borderBottomRightRadius: 2 },
  aiBubble: { backgroundColor: '#f0f2f5', borderBottomLeftRadius: 2 },
  text: { fontSize: 16 },
  userText: { color: 'white' },
  aiText: { color: '#333' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f0f2f5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginRight: 10 },
  sendButton: { backgroundColor: '#00BFA5', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
});
