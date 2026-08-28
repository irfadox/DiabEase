import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MessageSquare, User } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import SugarTrendChart from '../components/SugarTrendChart';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangPatientDetailScreen from '../lang/LangPatientDetailScreen';
import LangDiaryScreen, { getStatusLabel } from '../lang/LangDiaryScreen';
import LangCommon from '../lang/LangCommon';

const LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', ky: 'ky-KG' };

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId, patientName } = route.params || {};
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangPatientDetailScreen[language];
  const diaryText = LangDiaryScreen[language];
  const common = LangCommon[language];
  const locale = LOCALE_MAP[language] || 'ru-RU';

  const [patient, setPatient] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: patientName || t.screenTitle });
    loadPatientData();
  }, [navigation, patientId, language]);

  const loadPatientData = async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .eq('role', 'patient')
        .eq('assigned_doctor_id', user.id)
        .single();

      if (patientError || !patientData) throw patientError || new Error('Patient not found');

      const { data: logData, error: logError } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', patientId)
        .order('timestamp', { ascending: false });

      if (logError) throw logError;

      setPatient(patientData);
      setLogs(logData || []);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      Alert.alert(common.error, t.errorLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#00BFA5" style={styles.loader} />;
  }

  if (!patient) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(16) }]}>
          {t.errorLoadFailed}
        </Text>
      </View>
    );
  }

  const latestLog = logs[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <User color="white" size={28} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.name, { fontSize: getAdjustedFontSize(20) }]}>
            {patient.full_name}
          </Text>
          <Text style={[styles.description, { fontSize: getAdjustedFontSize(14) }]}>
            {patient.description || t.noDescription}
          </Text>
          {patient.phone_number ? (
            <Text style={[styles.secondaryText, { fontSize: getAdjustedFontSize(13) }]}>
              {t.phone}: {patient.phone_number}
            </Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => navigation.navigate('PatientChat', {
          patientId: patient.id,
          patientName: patient.full_name,
        })}
      >
        <MessageSquare color="white" size={20} />
        <Text style={[styles.chatButtonText, { fontSize: getAdjustedFontSize(16) }]}>
          {t.openChat}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(20) }]}>
        {t.healthProgress}
      </Text>
      <SugarTrendChart logs={logs} />

      <View style={styles.summaryCard}>
        <Text style={[styles.summaryTitle, { fontSize: getAdjustedFontSize(16) }]}>
          {t.summary}
        </Text>
        <Text style={[styles.summaryText, { fontSize: getAdjustedFontSize(14) }]}>
          {t.entries}: {logs.length}
        </Text>
        {latestLog ? (
          <>
            <Text style={[styles.summaryText, { fontSize: getAdjustedFontSize(14) }]}>
              {t.latestReading}: {latestLog.sugar_level} {diaryText.unit}
            </Text>
            <Text style={[styles.summaryText, { fontSize: getAdjustedFontSize(14) }]}>
              {getStatusLabel(latestLog.status, diaryText)} · {new Date(latestLog.timestamp).toLocaleString(locale)}
            </Text>
          </>
        ) : (
          <Text style={[styles.secondaryText, { fontSize: getAdjustedFontSize(14) }]}>
            {t.noEntries}
          </Text>
        )}
      </View>

      <Text style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(20) }]}>
        {t.recentEntries}
      </Text>
      {logs.length === 0 ? (
        <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(15) }]}>
          {t.noEntries}
        </Text>
      ) : (
        logs.slice(0, 10).map((log) => (
          <View key={String(log.id)} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={[styles.timestamp, { fontSize: getAdjustedFontSize(13) }]}>
                {new Date(log.timestamp).toLocaleString(locale)}
              </Text>
              <Text style={[styles.status, { fontSize: getAdjustedFontSize(13) }]}>
                {getStatusLabel(log.status, diaryText)}
              </Text>
            </View>
            <Text style={[styles.logText, { fontSize: getAdjustedFontSize(15) }]}>
              {diaryText.sugarLabel} {log.sugar_level} {diaryText.unit}
            </Text>
            <Text style={[styles.logText, { fontSize: getAdjustedFontSize(15) }]}>
              {diaryText.foodLabel} {log.notes || '-'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  loader: { flex: 1 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00BFA5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInfo: { flex: 1 },
  name: { fontWeight: '700', color: '#333' },
  description: { color: '#666', marginTop: 4 },
  secondaryText: { color: '#888', marginTop: 4 },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BFA5',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  chatButtonText: { color: 'white', fontWeight: '600', marginLeft: 8 },
  sectionTitle: { fontWeight: '700', color: '#333', marginTop: 24, marginBottom: 8 },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 16,
  },
  summaryTitle: { color: '#333', fontWeight: '700', marginBottom: 8 },
  summaryText: { color: '#555', marginBottom: 4 },
  logCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timestamp: { color: '#888' },
  status: { color: '#00BFA5', fontWeight: '600' },
  logText: { color: '#444', marginBottom: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#999', textAlign: 'center' },
});
