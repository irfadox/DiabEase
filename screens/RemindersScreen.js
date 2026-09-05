import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Clock, Plus, Trash2, Calendar } from 'lucide-react-native';
import { addReminder, getReminders, deleteReminder } from '../utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangRemindersScreen from '../lang/LangRemindersScreen';
import LangCommon from '../lang/LangCommon';

const REMINDER_CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureNotificationSetup() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export default function RemindersScreen() {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangRemindersScreen[language];
  const common = LangCommon[language];

  const [reminders, setReminders] = useState([]);
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState('date');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReminders();
    ensureNotificationSetup().then((granted) => {
      if (!granted) {
        Alert.alert(common.error, t.errorPermission);
      }
    });
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    const data = await getReminders();
    const mapped = data.map(item => ({
        id: item.id.toString(),
        text: item.title,
        time: item.time,
        enabled: !item.completed
    }));
    setReminders(mapped);
    setLoading(false);
  };

  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShow(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const showMode = (currentMode) => {
    setShow(true);
    setMode(currentMode);
  };

  const handleAddReminder = async () => {
    if (!text) {
      Alert.alert(common.error, t.errorEmptyText);
      return;
    }

    if (date <= new Date()) {
        Alert.alert(common.error, t.errorPastTime);
        return;
    }

    const granted = await ensureNotificationSetup();
    if (!granted) {
      Alert.alert(common.error, t.errorPermission);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: t.notificationTitle,
        body: text,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        date: date.getTime(),
        channelId: REMINDER_CHANNEL_ID,
      },
    });

    await addReminder({
        title: text,
        time: date.toISOString(),
        type: 'General',
    });

    await loadReminders();
    setText('');
    setDate(new Date());
  };

  const handleDelete = async (id) => {
    Alert.alert(
      t.deleteTitle, t.deleteMessage,
      [
        { text: common.cancel, style: 'cancel' },
        { text: common.delete, style: 'destructive', onPress: async () => {
            const success = await deleteReminder(id);
            if (success) loadReminders();
            else Alert.alert(common.error, t.errorDeleteFailed);
        }}
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputCard}>
        <TextInput
          style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
          placeholder={t.placeholder}
          value={text}
          onChangeText={setText}
        />
        
        <View style={styles.pickerContainer}>
            <TouchableOpacity style={styles.pickerButton} onPress={() => showMode('date')}>
                <Calendar size={20} color="#00BFA5" />
                <Text style={[styles.pickerButtonText, { fontSize: getAdjustedFontSize(16) }]}>{date.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerButton} onPress={() => showMode('time')}>
                <Clock size={20} color="#00BFA5" />
                <Text style={[styles.pickerButtonText, { fontSize: getAdjustedFontSize(16) }]}>
                    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </TouchableOpacity>
        </View>

        {show && (
          <DateTimePicker
            value={date}
            mode={mode}
            is24Hour={true}
            display="default"
            onChange={onChange}
          />
        )}

        <TouchableOpacity style={styles.addButton} onPress={handleAddReminder}>
          <Plus color="white" size={24} />
          <Text style={[styles.addButtonText, { fontSize: getAdjustedFontSize(18) }]}>{t.addReminder}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reminders}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.reminderItem}>
            <View style={styles.reminderInfo}>
              <View style={styles.timeTag}>
                <Text style={[styles.timeTagText, { fontSize: getAdjustedFontSize(10) }]}>
                    {new Date(item.time).toLocaleDateString()}
                </Text>
                <Text style={[styles.timeTagHour, { fontSize: getAdjustedFontSize(16) }]}>
                    {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[styles.reminderText, { fontSize: getAdjustedFontSize(16) }]}>{item.text}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Trash2 size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={<Text style={[styles.listTitle, { fontSize: getAdjustedFontSize(18) }]}>{t.listTitle}</Text>}
        ListEmptyComponent={<Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(16) }]}>{t.emptyList}</Text>}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadReminders}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inputCard: { padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#eee' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  pickerContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  pickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  pickerButtonText: { marginLeft: 8, fontSize: 16, fontWeight: '500', color: '#333' },
  addButton: { backgroundColor: '#00BFA5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 10 },
  addButtonText: { color: 'white', fontSize: 18, fontWeight: '600', marginLeft: 10 },
  list: { padding: 20 },
  listTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  reminderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee', elevation: 1 },
  reminderInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timeTag: { backgroundColor: '#e2f9e1', padding: 6, borderRadius: 8, marginRight: 12, alignItems: 'center', minWidth: 80 },
  timeTagText: { fontSize: 10, color: '#00BFA5', fontWeight: 'bold' },
  timeTagHour: { fontSize: 16, fontWeight: '700', color: '#00BFA5' },
  reminderText: { fontSize: 16, color: '#444', flex: 1 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});
