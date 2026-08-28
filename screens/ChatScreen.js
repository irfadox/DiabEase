import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking } from 'react-native';
import { Send, Phone, AlertTriangle, User } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import DoctorSelection from '../components/DoctorSelection';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangChatScreen from '../lang/LangChatScreen';
import LangCommon from '../lang/LangCommon';

export default function ChatScreen({ route }) {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangChatScreen[language];
  const common = LangCommon[language];

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [conversationError, setConversationError] = useState(null);
  const flatListRef = useRef();

  const targetId = route.params?.patientId || userProfile?.assigned_doctor_id;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (targetId && userProfile) {
        let active = true;

        const setupConversation = async () => {
          const partner = await fetchPartnerProfile();
          if (!active || !partner) return;

          await loadHistory();
        };

        setupConversation();
        const channel = supabase
            .channel('chat_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                if ((payload.new.sender_id === targetId && payload.new.receiver_id === userProfile?.id) ||
                    (payload.new.sender_id === userProfile?.id && payload.new.receiver_id === targetId)) {
                    setMessages(prev => (
                      prev.some(message => message.id === payload.new.id)
                        ? prev
                        : [...prev, payload.new]
                    ));
                }
            })
            .subscribe();

        return () => {
          active = false;
          supabase.removeChannel(channel);
        };
    }
  }, [targetId, userProfile]);

  const fetchInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setUserProfile(data);
    setLoading(false);
  };

  const fetchPartnerProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    const validRelationship = data && (
      (userProfile?.role === 'patient' &&
        userProfile.assigned_doctor_id === data.id &&
        data.role === 'doctor') ||
      (userProfile?.role === 'doctor' &&
        data.role === 'patient' &&
        data.assigned_doctor_id === userProfile.id)
    );

    if (error || !validRelationship) {
      setPartnerProfile(null);
      setConversationError(t.invalidConversation);
      return null;
    }

    setPartnerProfile(data);
    setConversationError(null);
    return data;
  };

  const loadHistory = async () => {
    if (!targetId || !userProfile) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userProfile.id})`)
      .order('timestamp', { ascending: true });
    
    setMessages(data || []);
  };

  const handleSend = async (isSOS = false) => {
    if (!inputText.trim() && !isSOS) return;
    if (!userProfile || !targetId || !partnerProfile || conversationError) return;

    const text = isSOS ? t.sosMessage : inputText.trim();
    if (!isSOS) setInputText('');

    const { error } = await supabase.from('messages').insert([{
        sender_id: userProfile.id,
        receiver_id: targetId,
        text,
        is_sos: isSOS
    }]);

    if (error) Alert.alert(common.error, t.errorSendFailed);
    loadHistory();
  };

  const handleCall = () => {
    if (!partnerProfile?.phone_number) {
        Alert.alert(common.info, t.infoNoPhone);
        return;
    }
    Alert.alert(
        t.callTitle,
        t.callNumber.replace('{phone}', partnerProfile.phone_number),
        [
            { text: common.cancel, style: 'cancel' },
            { text: t.callDial, onPress: async () => {
                try {
                    await Linking.openURL(`tel:${partnerProfile.phone_number}`);
                } catch (err) {
                    Alert.alert(common.error, t.errorCallFailed);
                }
            }}
        ]
    );
  };

  const renderMessage = ({ item }) => (
    <View style={[
        styles.messageBubble, 
        item.sender_id === userProfile?.id ? styles.userBubble : styles.partnerBubble,
        item.is_sos && styles.sosBubble
    ]}>
      <Text style={[styles.messageText, (item.sender_id === userProfile?.id || item.is_sos) ? styles.colorWhite : styles.colorBlack, { fontSize: getAdjustedFontSize(16) }]}>
        {item.text}
      </Text>
      <Text style={[styles.timestamp, { fontSize: getAdjustedFontSize(10) }]}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  if (loading) return <ActivityIndicator size="large" color="#00BFA5" style={{ flex: 1 }} />;

  if (userProfile?.role === 'patient' && !userProfile?.assigned_doctor_id) {
    return <DoctorSelection onSelect={(id) => setUserProfile({...userProfile, assigned_doctor_id: id})} />;
  }

  if (conversationError) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyStateText, { fontSize: getAdjustedFontSize(16) }]}>
          {conversationError}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chatHeader}>
        <User color="#00BFA5" size={24} />
        <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { fontSize: getAdjustedFontSize(16) }]}>{partnerProfile?.full_name || t.loading}</Text>
            <Text style={[styles.headerStatus, { fontSize: getAdjustedFontSize(12) }]}>{userProfile?.role === 'doctor' ? t.rolePatient : t.roleDoctor}</Text>
        </View>
        <TouchableOpacity style={styles.callIcon} onPress={handleCall}>
            <Phone color="#00BFA5" size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {userProfile?.role === 'patient' && (
        <TouchableOpacity style={styles.sosButton} onPress={() => handleSend(true)}>
            <AlertTriangle color="white" size={30} />
            <Text style={[styles.sosText, { fontSize: getAdjustedFontSize(12) }]}>SOS</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
            placeholder={t.messagePlaceholder}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => handleSend(false)}>
            <Send color="white" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  chatHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: 'white', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  headerStatus: { fontSize: 12, color: '#00BFA5' },
  callIcon: { padding: 8 },
  chatList: { padding: 15, paddingBottom: 100 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#00BFA5',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  partnerBubble: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  sosBubble: {
    backgroundColor: '#FF3B30',
    alignSelf: 'center',
    maxWidth: '90%',
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  messageText: { fontSize: 16 },
  colorWhite: { color: 'white' },
  colorBlack: { color: '#333' },
  timestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4, color: '#ccc' },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#00BFA5',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#FF3B30',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 100,
  },
  sosText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginTop: 2 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  emptyStateText: {
    color: '#666',
    textAlign: 'center',
  },
});
