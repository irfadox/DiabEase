import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/supabase';
import { showAlert } from '../utils/alert';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { createShadow } from '../utils/webStyles';
import { useLanguageContext } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import LangPatientListScreen from '../lang/LangPatientListScreen';
import LangCommon from '../lang/LangCommon';

export default function PatientListScreen({ navigation }) {
  const { language } = useLanguageContext();
  const { getAdjustedFontSize } = useSettings();
  const t = LangPatientListScreen[language] || LangPatientListScreen.ru;
  const common = LangCommon[language] || LangCommon.ru;

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, attention: 0, normal: 0 });

  const loadData = async () => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 1. Fetch assigned patients (or all patient profiles if developing in demo mode)
      let { data: pts, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, phone_number, affiliation, description, assigned_doctor_id')
        .eq('role', 'patient');

      if (error) throw error;

      // Filter by assigned doctor if assignments exist, or retain visible patients
      const assigned = (pts || []).filter((p) => p.assigned_doctor_id === user.id);
      const targetPatients = assigned.length > 0 ? assigned : (pts || []);

      const patientIds = targetPatients.map((p) => p.id);

      // 2. Batch-fetch latest logs for all patients (Eliminates N+1 query)
      const logsByPatient = {};
      if (patientIds.length > 0) {
        const { data: recentLogs, error: logErr } = await supabase
          .from('logs')
          .select('id, user_id, sugar_level, status, created_at, timestamp')
          .in('user_id', patientIds)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!logErr && Array.isArray(recentLogs)) {
          recentLogs.forEach((log) => {
            if (!logsByPatient[log.user_id]) {
              logsByPatient[log.user_id] = log;
            }
          });
        }
      }

      // 3. Map patients with their latest recorded reading
      const patientsWithLogs = targetPatients.map((p) => ({
        ...p,
        lastLog: logsByPatient[p.id] || null,
      }));

      setPatients(patientsWithLogs);

      // 4. Calculate clinical dashboard summary metrics
      let attentionCount = 0;
      let normalCount = 0;

      patientsWithLogs.forEach((p) => {
        if (p.lastLog) {
          if (p.lastLog.status === 'high' || p.lastLog.status === 'low') {
            attentionCount++;
          } else {
            normalCount++;
          }
        }
      });

      setStats({
        total: patientsWithLogs.length,
        attention: attentionCount,
        normal: normalCount,
      });
    } catch (e) {
      console.error('PatientListScreen loadData error:', e);
      showAlert(common.error, t.errorLoadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    showAlert(t.logoutTitle, t.logoutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logout,
        style: 'destructive',
        onPress: async () => {
          try {
            await Notifications.cancelAllScheduledNotificationsAsync();
          } catch (notifErr) {
            console.warn('Could not cancel notifications on logout:', notifErr.message);
          }
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <ResponsiveContainer maxWidth={1200} style={styles.outerContainer}>
      <View style={styles.container}>
        {/* Clinician Header */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <Text style={[styles.headerTitle, { fontSize: getAdjustedFontSize(22) }]}>
              {t.headerTitle}
            </Text>
            <Text style={[styles.headerSubtitle, { fontSize: getAdjustedFontSize(13) }]}>
              {t.headerSubtitle}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel={t.logout}
          >
            <Ionicons name="log-out-outline" size={22} color="#ff5555" />
          </TouchableOpacity>
        </View>

        {/* Dashboard Metric Summary Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: '#2b3836' }]}>
            <Text style={[styles.statNumber, { fontSize: getAdjustedFontSize(22) }]}>
              {stats.total}
            </Text>
            <Text style={[styles.statLabel, { fontSize: getAdjustedFontSize(12) }]}>
              {t.patientsCount}
            </Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#ff5555' }]}>
            <Text style={[styles.statNumber, { color: '#ff5555', fontSize: getAdjustedFontSize(22) }]}>
              {stats.attention}
            </Text>
            <Text style={[styles.statLabel, { fontSize: getAdjustedFontSize(12) }]}>
              {t.critical}
            </Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#00cc96' }]}>
            <Text style={[styles.statNumber, { color: '#00cc96', fontSize: getAdjustedFontSize(22) }]}>
              {stats.normal}
            </Text>
            <Text style={[styles.statLabel, { fontSize: getAdjustedFontSize(12) }]}>
              {t.normal}
            </Text>
          </View>
        </View>

        {/* Patient Roster Section */}
        <Text style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(17) }]}>
          {t.patientList}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#00cc96" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={patients}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor="#00cc96"
                colors={['#00cc96']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#555" />
                <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(15) }]}>
                  {t.emptyList}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.patientCard}
                onPress={() =>
                  navigation.navigate('PatientDetail', {
                    patientId: item.id,
                    patientName: item.full_name,
                  })
                }
              >
                <View style={styles.patientAvatar}>
                  <Ionicons name="person" size={22} color="#00cc96" />
                </View>
                <View style={styles.patientMeta}>
                  <Text style={[styles.patientName, { fontSize: getAdjustedFontSize(16) }]}>
                    {item.full_name || t.unnamed}
                  </Text>
                  <Text style={[styles.patientSub, { fontSize: getAdjustedFontSize(13) }]}>
                    {item.lastLog
                      ? `${t.sugarLabel}: ${item.lastLog.sugar_level} ${t.unit}`
                      : t.noRecentLogs}
                  </Text>
                </View>
                {item.lastLog && (
                  <View
                    style={[
                      styles.statusBadge,
                      item.lastLog.status === 'normal'
                        ? styles.badgeNormal
                        : styles.badgeAlert,
                    ]}
                  >
                    <Text style={[styles.badgeText, { fontSize: getAdjustedFontSize(12) }]}>
                      {item.lastLog.status === 'normal' ? t.normal : t.attention}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#777" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#121716',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    color: '#8e9694',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1c2423',
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1c2423',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    ...createShadow(0, 2, 4, 'rgba(0,0,0,0.2)', 0.15, 2),
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    color: '#8e9694',
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2423',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#24302e',
    ...createShadow(0, 2, 4, 'rgba(0,0,0,0.15)', 0.1, 2),
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121716',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientMeta: {
    flex: 1,
    marginLeft: 12,
  },
  patientName: {
    fontWeight: '600',
    color: '#fff',
  },
  patientSub: {
    color: '#8e9694',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeNormal: {
    backgroundColor: 'rgba(0, 204, 150, 0.15)',
  },
  badgeAlert: {
    backgroundColor: 'rgba(255, 85, 85, 0.15)',
  },
  badgeText: {
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
  },
});
