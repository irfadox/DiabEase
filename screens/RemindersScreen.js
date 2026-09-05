import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Platform, Switch, Modal } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Clock, Plus, Trash2, Calendar, Repeat } from 'lucide-react-native';
import { addReminder, getReminders, deleteReminder } from '../utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangRemindersScreen from '../lang/LangRemindersScreen';
import LangCommon from '../lang/LangCommon';

const REMINDER_CHANNEL_ID = 'reminders';
const LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', ky: 'ky-KG' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [6, 0];
const TEAL = '#00BFA5';

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

function parseReminderMeta(type) {
  if (type && typeof type === 'string' && type.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(type);
      if (parsed?.mode === 'weekly') {
        return {
          mode: 'weekly',
          days: Array.isArray(parsed.days) ? parsed.days : [],
        };
      }
    } catch (e) {
      // Fall through to one-time for older reminder rows.
    }
  }
  return { mode: 'once', days: [] };
}

function sameDays(a, b) {
  return [...a].sort().join(',') === [...b].sort().join(',');
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale);
}

function formatDayNames(days, names) {
  return DAY_ORDER.filter((day) => days.includes(day)).map((day) => names[day]).join(', ');
}

function formatOnceHighlight(value, dayNames, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const weekday = dayNames[date.getDay()];
  const rest = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${weekday}, ${rest}`;
}

function notificationIdsFor(reminder) {
  const ids = [`reminder-${reminder.id}`];
  (reminder.days || []).forEach((day) => ids.push(`reminder-${reminder.id}-${day}`));
  return ids;
}

export default function RemindersScreen() {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangRemindersScreen[language];
  const common = LangCommon[language];
  const locale = LOCALE_MAP[language] || 'ru-RU';

  const [reminders, setReminders] = useState([]);
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState('date');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRepeating, setIsRepeating] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [detailReminder, setDetailReminder] = useState(null);

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
    const mapped = data.map((item) => {
      const meta = parseReminderMeta(item.type);
      return {
        id: item.id.toString(),
        text: item.title,
        time: item.time,
        enabled: !item.completed,
        mode: meta.mode,
        days: meta.days,
      };
    });
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

  const handleRepeatToggle = (value) => {
    setIsRepeating(value);
    if (value && mode === 'date') {
      setShow(false);
    }
    if (!value) {
      setSelectedDays([]);
    }
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) => (
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    ));
  };

  const scheduleReminderNotifications = async (reminderId, body, fireDate, days) => {
    const content = {
      title: t.notificationTitle,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };

    if (days.length) {
      const hour = fireDate.getHours();
      const minute = fireDate.getMinutes();
      for (const jsDay of days) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminderId}-${jsDay}`,
          content,
          trigger: {
            weekday: jsDay + 1,
            hour,
            minute,
            repeats: true,
            channelId: REMINDER_CHANNEL_ID,
          },
        });
      }
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${reminderId}`,
      content,
      trigger: {
        date: fireDate.getTime(),
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  };

  const handleAddReminder = async () => {
    if (!text) {
      Alert.alert(common.error, t.errorEmptyText);
      return;
    }

    if (isRepeating && selectedDays.length === 0) {
      Alert.alert(common.error, t.errorNoDays);
      return;
    }

    if (!isRepeating && date <= new Date()) {
      Alert.alert(common.error, t.errorPastTime);
      return;
    }

    const granted = await ensureNotificationSetup();
    if (!granted) {
      Alert.alert(common.error, t.errorPermission);
      return;
    }

    const saved = await addReminder({
      title: text,
      time: date.toISOString(),
      type: JSON.stringify({
        mode: isRepeating ? 'weekly' : 'once',
        days: isRepeating ? selectedDays : [],
      }),
    });

    const reminderId = saved?.[0]?.id;
    if (!reminderId) {
      Alert.alert(common.error, t.errorSaveFailed);
      return;
    }

    try {
      await scheduleReminderNotifications(
        reminderId,
        text,
        date,
        isRepeating ? selectedDays : []
      );
    } catch (e) {
      console.error('Failed to schedule reminder notification', e);
    }

    await loadReminders();
    setText('');
    setDate(new Date());
    setIsRepeating(false);
    setSelectedDays([]);
    setShow(false);
  };

  const handleDelete = async (item) => {
    Alert.alert(
      t.deleteTitle, t.deleteMessage,
      [
        { text: common.cancel, style: 'cancel' },
        { text: common.delete, style: 'destructive', onPress: async () => {
            const success = await deleteReminder(item.id);
            if (success) {
              await Promise.all(
                notificationIdsFor(item).map((id) =>
                  Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
                )
              );
              loadReminders();
            } else {
              Alert.alert(common.error, t.errorDeleteFailed);
            }
        }}
      ]
    );
  };

  const renderReminder = ({ item }) => {
    const isWeekly = item.mode === 'weekly';
    const subtitle = isWeekly
      ? formatDayNames(item.days, t.daysShort)
      : [formatOnceHighlight(item.time, t.days, locale), formatTime(item.time)].filter(Boolean).join(', ');

    return (
      <View style={styles.reminderItem}>
        <TouchableOpacity
          style={styles.reminderInfo}
          onPress={() => setDetailReminder(item)}
          activeOpacity={0.7}
        >
          <View style={styles.timeTag}>
            <Text style={[styles.timeTagText, { fontSize: getAdjustedFontSize(10) }]}>
              {isWeekly ? t.regularTag : formatDate(item.time, locale)}
            </Text>
            <Text style={[styles.timeTagHour, { fontSize: getAdjustedFontSize(16) }]}>
              {formatTime(item.time)}
            </Text>
          </View>
          <View style={styles.reminderTextBlock}>
            <Text style={[styles.reminderText, { fontSize: getAdjustedFontSize(16) }]}>{item.text}</Text>
            {!!subtitle && (
              <Text style={[styles.reminderSubtext, { fontSize: getAdjustedFontSize(12) }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Trash2 size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    );
  };

  const highlightDays = detailReminder
    ? (detailReminder.mode === 'weekly'
        ? formatDayNames(detailReminder.days, t.days)
        : formatOnceHighlight(detailReminder.time, t.days, locale))
    : '';
  const highlightTime = detailReminder ? formatTime(detailReminder.time) : '';
  const detailPrefix = detailReminder?.mode === 'weekly' ? t.detailRegularPrefix : t.detailOncePrefix;

  return (
    <View style={styles.container}>
      <FlatList
        data={reminders}
        keyExtractor={item => item.id}
        renderItem={renderReminder}
        ListHeaderComponent={
          <View>
            <View style={styles.inputCard}>
              <TextInput
                style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
                placeholder={t.placeholder}
                value={text}
                onChangeText={setText}
              />

              <View style={styles.repeatRow}>
                <View style={styles.repeatLabelRow}>
                  <Repeat size={18} color={TEAL} />
                  <Text style={[styles.repeatLabel, { fontSize: getAdjustedFontSize(15) }]}>{t.repeatToggle}</Text>
                </View>
                <Switch
                  value={isRepeating}
                  onValueChange={handleRepeatToggle}
                  trackColor={{ false: '#ddd', true: '#80DFD2' }}
                  thumbColor={isRepeating ? TEAL : '#f4f3f4'}
                />
              </View>

              {isRepeating && (
                <View style={styles.repeatOptions}>
                  <View style={styles.presetRow}>
                    <TouchableOpacity
                      style={[styles.presetButton, sameDays(selectedDays, WEEKDAYS) && styles.presetButtonSelected]}
                      onPress={() => setSelectedDays([...WEEKDAYS])}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.presetButtonText,
                        { fontSize: getAdjustedFontSize(13) },
                        sameDays(selectedDays, WEEKDAYS) && styles.presetButtonTextSelected,
                      ]}>
                        {t.weekdays}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.presetButton, sameDays(selectedDays, WEEKENDS) && styles.presetButtonSelected]}
                      onPress={() => setSelectedDays([...WEEKENDS])}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.presetButtonText,
                        { fontSize: getAdjustedFontSize(13) },
                        sameDays(selectedDays, WEEKENDS) && styles.presetButtonTextSelected,
                      ]}>
                        {t.weekends}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.daysRow}>
                    {DAY_ORDER.map((day) => {
                      const selected = selectedDays.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.dayChip, selected && styles.dayChipSelected]}
                          onPress={() => toggleDay(day)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.dayChipText,
                            { fontSize: getAdjustedFontSize(11) },
                            selected && styles.dayChipTextSelected,
                          ]}>
                            {t.daysShort[day]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.pickerContainer}>
                  {!isRepeating && (
                    <TouchableOpacity style={styles.pickerButton} onPress={() => showMode('date')}>
                        <Calendar size={20} color={TEAL} />
                        <Text style={[styles.pickerButtonText, { fontSize: getAdjustedFontSize(16) }]}>{date.toLocaleDateString(locale)}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.pickerButton} onPress={() => showMode('time')}>
                      <Clock size={20} color={TEAL} />
                      <Text style={[styles.pickerButtonText, { fontSize: getAdjustedFontSize(16) }]}>
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </Text>
                  </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.addButton} onPress={handleAddReminder}>
                <Plus color="white" size={24} />
                <Text style={[styles.addButtonText, { fontSize: getAdjustedFontSize(18) }]}>{t.addReminder}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.listTitle, { fontSize: getAdjustedFontSize(18) }]}>{t.listTitle}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(16) }]}>{t.emptyList}</Text>}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshing={loading}
        onRefresh={loadReminders}
      />

      {show && (
        <DateTimePicker
          value={date}
          mode={isRepeating ? 'time' : mode}
          is24Hour={true}
          display={Platform.OS === 'android' ? 'spinner' : 'default'}
          onChange={onChange}
        />
      )}

      <Modal
        visible={!!detailReminder}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailReminder(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalText, { fontSize: getAdjustedFontSize(16) }]}>
              {detailPrefix}
              <Text style={styles.modalHighlight}>{highlightDays}</Text>
              {t.detailTimePrefix}
              <Text style={styles.modalHighlight}>{highlightTime}</Text>
              {t.detailSuffix}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setDetailReminder(null)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalButtonText, { fontSize: getAdjustedFontSize(16) }]}>{t.okay}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inputCard: { padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#eee' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  repeatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  repeatLabelRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  repeatLabel: { marginLeft: 8, fontSize: 15, fontWeight: '500', color: '#333' },
  repeatOptions: { marginBottom: 12 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: 'white', alignItems: 'center' },
  presetButtonSelected: { backgroundColor: TEAL, borderColor: TEAL },
  presetButtonText: { color: '#333', fontWeight: '500' },
  presetButtonTextSelected: { color: 'white', fontWeight: '600' },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: 'white', alignItems: 'center' },
  dayChipSelected: { backgroundColor: TEAL, borderColor: TEAL },
  dayChipText: { color: '#333', fontWeight: '600' },
  dayChipTextSelected: { color: 'white' },
  pickerContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  pickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  pickerButtonText: { marginLeft: 8, fontSize: 16, fontWeight: '500', color: '#333' },
  addButton: { backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 10 },
  addButtonText: { color: 'white', fontSize: 18, fontWeight: '600', marginLeft: 10 },
  list: { paddingBottom: 20 },
  listTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 20, paddingTop: 20 },
  reminderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', borderRadius: 12, marginBottom: 10, marginHorizontal: 20, borderWidth: 1, borderColor: '#eee', elevation: 1 },
  reminderInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  timeTag: { backgroundColor: '#e2f9e1', padding: 6, borderRadius: 8, marginRight: 12, alignItems: 'center', minWidth: 80 },
  timeTagText: { fontSize: 10, color: TEAL, fontWeight: 'bold' },
  timeTagHour: { fontSize: 16, fontWeight: '700', color: TEAL },
  reminderTextBlock: { flex: 1, flexShrink: 1 },
  reminderText: { fontSize: 16, color: '#444' },
  reminderSubtext: { marginTop: 4, color: TEAL, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', paddingHorizontal: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: 'white', borderRadius: 16, padding: 24 },
  modalText: { color: '#333', lineHeight: 26, marginBottom: 20 },
  modalHighlight: { fontWeight: '700', color: TEAL },
  modalButton: { backgroundColor: TEAL, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  modalButtonText: { color: 'white', fontWeight: '600' },
});
