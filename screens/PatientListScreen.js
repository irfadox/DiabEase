import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { showAlert } from '../utils/alert';

export default function PatientListScreen({ navigation }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, attention: 0, normal: 0 });

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Получаем пациентов, прикрепленных к этому врачу (или всех для тестов/демо)
      let { data: pts, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'patient');

      if (error) throw error;

      // Собираем последние замеры для каждого пациента
      const patientsWithLogs = await Promise.all(
        (pts || []).map(async (p) => {
          const { data: logs } = await supabase
            .from('logs')
            .select('*')
            .eq('user_id', p.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...p,
            lastLog: logs && logs.length > 0 ? logs[0] : null,
          };
        })
      );

      setPatients(patientsWithLogs);

      // Считаем метрики для дашборда
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
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    showAlert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Панель врача</Text>
          <Text style={styles.headerSubtitle}>Сводка показателей пациентов</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ff5555" />
        </TouchableOpacity>
      </View>

      {/* Карточки аналитики дашборда */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: '#2b3836' }]}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Пациентов</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#ff5555' }]}>
          <Text style={[styles.statNumber, { color: '#ff5555' }]}>{stats.attention}</Text>
          <Text style={styles.statLabel}>Критичные</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#00cc96' }]}>
          <Text style={[styles.statNumber, { color: '#00cc96' }]}>{stats.normal}</Text>
          <Text style={styles.statLabel}>В норме</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Список пациентов</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#00cc96" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#555" />
              <Text style={styles.emptyText}>Пока нет зарегистрированных пациентов</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.patientCard}
              onPress={() => navigation.navigate('PatientDetail', { patientId: item.id, patientName: item.full_name })}
            >
              <View style={styles.patientAvatar}>
                <Ionicons name="person" size={22} color="#00cc96" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.patientName}>{item.full_name || 'Без имени'}</Text>
                <Text style={styles.patientSub}>
                  {item.lastLog
                    ? `Сахар: ${item.lastLog.sugar_level} ммоль/л`
                    : 'Нет недавних замеров'}
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
                  <Text style={styles.badgeText}>
                    {item.lastLog.status === 'normal' ? 'Норма' : 'Внимание'}
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#777" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121716',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8e9694',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1c2423',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1c2423',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#8e9694',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
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
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121716',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  patientSub: {
    fontSize: 13,
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
    fontSize: 12,
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
    fontSize: 15,
  },
});
