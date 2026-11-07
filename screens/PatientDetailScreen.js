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
import GlucoseHistoryTable from '../components/GlucoseHistoryTable';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { createShadow } from '../utils/webStyles';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangPatientDetailScreen from '../lang/LangPatientDetailScreen';
import LangDiaryScreen, { getStatusLabel } from '../lang/LangDiaryScreen';
import LangCommon from '../lang/LangCommon';

const LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', ky: 'ky-KG' };
const getNoteText = (notes, fallback) => (!notes || notes === '-' ? fallback : notes);

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

  useEffect(() => {
    if (!patientId) return undefined;

    const channel = supabase
      .channel(`patient_logs_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs',
          filter: `user_id=eq.${patientId}`,
        },
        (payload) => {
          if (payload.new?.user_id !== patientId) return;

          setLogs((previousLogs) => {
            if (previousLogs.some((log) => String(log.id) === String(payload.new.id))) {
              return previousLogs;
            }

            return [payload.new, ...previousLogs].sort(
              (first, second) =>
                new Date(second.created_at || second.timestamp) -
                new Date(first.created_at || first.timestamp)
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  const fetchPatientLogs = async () => {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('logs')
      .select('id, user_id, sugar_level, notes, status, created_at, timestamp')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  };

  const loadPatientData = async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .eq('role', 'patient')
        .single();

      if (patientError || !patientData) throw patientError || new Error('Patient not found');

      const logData = await fetchPatientLogs();

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
    <ResponsiveContainer maxWidth={1200} style={styles.outerContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Patient Profile Card */}
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

        {/* Telehealth Direct Action */}
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            navigation.navigate('PatientChat', {
              patientId: patient.id,
              patientName: patient.full_name,
            })
          }
        >
          <MessageSquare color="white" size={20} />
          <Text style={[styles.chatButtonText, { fontSize: getAdjustedFontSize(16) }]}>
            {t.openChat}
          </Text>
        </TouchableOpacity>

        {/* Trend Visualization Section */}
        <Text style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(20) }]}>
          {t.healthProgress}
        </Text>
        <SugarTrendChart logs={logs} />

        {/* Clinical Summary Card */}
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
                {getStatusLabel(latestLog.status, diaryText)} ·{' '}
                {new Date(latestLog.created_at || latestLog.timestamp).toLocaleString(locale)}
              </Text>
            </>
          ) : (
            <Text style={[styles.secondaryText, { fontSize: getAdjustedFontSize(14) }]}>
              {t.noEntries}
            </Text>
          )}
        </View>

        {/* History Table & Medical PDF Export */}
        <GlucoseHistoryTable
          logs={logs}
          patientName={patient.full_name}
          fetchLogsForExport={fetchPatientLogs}
        />

        {/* Recent Timeline Feed */}
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
                  {new Date(log.created_at || log.timestamp).toLocaleString(locale)}
                </Text>
                <Text style={[styles.status, { fontSize: getAdjustedFontSize(13) }]}>
                  {getStatusLabel(log.status, diaryText)}
                </Text>
              </View>
              <Text style={[styles.logText, { fontSize: getAdjustedFontSize(15) }]}>
                {diaryText.sugarLabel} {log.sugar_level} {diaryText.unit}
              </Text>
              <Text style={[styles.logText, { fontSize: getAdjustedFontSize(15) }]}>
                {diaryText.foodLabel} {getNoteText(log.notes, diaryText.noNotes)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    width: '100%',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
  },
  loader: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    ...createShadow(0, 2, 4, 'rgba(0,0,0,0.06)', 0.1, 2),
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
  profileInfo: {
    flex: 1,
  },
  name: {
    fontWeight: '700',
    color: '#333',
  },
  description: {
    color: '#666',
    marginTop: 4,
  },
  secondaryText: {
    color: '#888',
    marginTop: 4,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BFA5',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    ...createShadow(0, 2, 4, 'rgba(0,191,165,0.25)', 0.2, 2),
  },
  chatButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 16,
    ...createShadow(0, 2, 4, 'rgba(0,0,0,0.06)', 0.1, 2),
  },
  summaryTitle: {
    color: '#333',
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryText: {
    color: '#555',
    marginBottom: 4,
  },
  logCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
    ...createShadow(0, 1, 3, 'rgba(0,0,0,0.05)', 0.08, 1),
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timestamp: {
    color: '#888',
  },
  status: {
    color: '#00BFA5',
    fontWeight: '600',
  },
  logText: {
    color: '#444',
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
  },
});
