import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native';
import { saveLog, getLogs, deleteLog } from '../utils/storage';
import { Plus, Share2, Trash2, AlertTriangle, Table2 } from 'lucide-react-native';
import SugarTrendChart from '../components/SugarTrendChart';
import { supabase } from '../utils/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangDiaryScreen, { getStatusLabel } from '../lang/LangDiaryScreen';
import LangCommon from '../lang/LangCommon';
import GlucoseHistoryTable from '../components/GlucoseHistoryTable';

const LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', ky: 'ky-KG' };
const getNoteText = (notes, fallback) => !notes || notes === '-' ? fallback : notes;

export default function DiaryScreen() {
  const [logs, setLogs] = useState([]);
  const [sugar, setSugar] = useState('');
  const [food, setFood] = useState('');
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [showHistoryTable, setShowHistoryTable] = useState(false);

  const { minLimit, maxLimit, getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangDiaryScreen[language];
  const common = LangCommon[language];
  const locale = LOCALE_MAP[language] || 'ru-RU';
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadData();
      fetchProfile();
    }
  }, [isFocused]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setUserProfile(data);
  };

  const loadData = async () => {
    setLoading(true);
    const data = await getLogs();
    setLogs(data);
    setLoading(false);
  };

  const fetchOwnLogsForExport = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return getLogs();
  };

  const handleAddLog = async () => {
    if (!sugar && !food) {
      Alert.alert(common.error, t.errorEmpty);
      return;
    }

    const value = parseFloat(sugar);
    let status = 'normal';
    if (!isNaN(value)) {
      if (value < minLimit) status = 'low';
      if (value > maxLimit) status = 'high';
    }

    const newLogData = {
      value: sugar || '0',
      notes: food || '',
      status,
    };

    setLoading(true);
    const result = await saveLog(newLogData);
    if (result) {
        await loadData();
        setSugar('');
        setFood('');
    } else {
        Alert.alert(common.error, t.errorSaveFailed);
    }
    setLoading(false);
  };

  const handleShare = async () => {
    if (logs.length === 0) {
      Alert.alert(common.info, t.infoNoData);
      return;
    }

    if (!userProfile?.assigned_doctor_id) {
        Alert.alert(common.attention, t.attentionSelectDoctor);
        return;
    }

    Alert.alert(
        t.shareReportTitle,
        t.shareReportMessage,
        [
            { text: common.cancel, style: 'cancel' },
            { 
              text: common.send, 
              onPress: async () => {
                const reportDate = new Date().toLocaleDateString(locale);
                const report = t.reportHeader.replace('{date}', reportDate) + '\n' + 
                    logs.map(l => t.reportLine
                      .replace('{time}', new Date(l.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))
                      .replace('{sugar}', l.sugar_level)
                      .replace('{notes}', getNoteText(l.notes, t.noNotes))
                    ).join('\n');
                
                const { error } = await supabase.from('messages').insert([{
                    sender_id: userProfile.id,
                    receiver_id: userProfile.assigned_doctor_id,
                    text: report,
                    is_system: true
                }]);

                if (error) Alert.alert(common.error, t.errorShareFailed);
                else Alert.alert(common.success, t.successShare);
              }
            }
        ]
    );
  };

  const handleDeleteLog = (id) => {
    Alert.alert(
      t.deleteTitle,
      t.deleteMessage,
      [
        { text: common.cancel, style: 'cancel' },
        { text: common.delete, style: 'destructive', onPress: async () => {
            const success = await deleteLog(id);
            if (success) {
                loadData();
            } else {
                Alert.alert(common.error, t.errorDeleteFailed);
            }
        }}
      ]
    );
  };

  const renderWarningBanner = () => {
    if (logs.length === 0) return null;
    const latestLog = logs[0];
    const sugarVal = parseFloat(latestLog.sugar_level);
    if (isNaN(sugarVal)) return null;

    if (sugarVal < minLimit) {
      return (
        <View style={styles.warningBanner}>
          <AlertTriangle color="#FF3B30" size={24} style={styles.warningIcon} />
          <View style={styles.warningTextContainer}>
            <Text style={[styles.warningTitle, { fontSize: getAdjustedFontSize(15) }]}>{t.warningLowTitle}</Text>
            <Text style={[styles.warningSubtitle, { fontSize: getAdjustedFontSize(13) }]}>
              {t.warningLowSubtitle.replace('{value}', sugarVal).replace('{min}', minLimit)}
            </Text>
          </View>
        </View>
      );
    }

    if (sugarVal > maxLimit) {
      return (
        <View style={styles.warningBanner}>
          <AlertTriangle color="#FF3B30" size={24} style={styles.warningIcon} />
          <View style={styles.warningTextContainer}>
            <Text style={[styles.warningTitle, { fontSize: getAdjustedFontSize(15) }]}>{t.warningHighTitle}</Text>
            <Text style={[styles.warningSubtitle, { fontSize: getAdjustedFontSize(13) }]}>
              {t.warningHighSubtitle.replace('{value}', sugarVal).replace('{max}', maxLimit)}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  };

  const renderItem = ({ item }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Text style={[styles.timestamp, { fontSize: getAdjustedFontSize(14) }]}>{new Date(item.timestamp).toLocaleString(locale)}</Text>
        <View style={[styles.statusBadge, 
          getStatusLabel(item.status, t) === t.statusLow ? styles.statusLow : 
          getStatusLabel(item.status, t) === t.statusHigh ? styles.statusHigh : styles.statusNormal]}>
          <Text style={[styles.statusText, { fontSize: getAdjustedFontSize(12) }]}>{getStatusLabel(item.status, t)}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteLog(item.id)}>
          <Trash2 size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.logLabel, { fontSize: getAdjustedFontSize(16) }]}>{t.sugarLabel} <Text style={[styles.logValue, { fontSize: getAdjustedFontSize(16) }]}>{item.sugar_level} {t.unit}</Text></Text>
      <Text style={[styles.logLabel, { fontSize: getAdjustedFontSize(16) }]}>{t.foodLabel} <Text style={[styles.logValue, { fontSize: getAdjustedFontSize(16) }]}>{getNoteText(item.notes, t.noNotes)}</Text></Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderWarningBanner()}
      
      <View style={styles.inputSection}>
        <TextInput
          style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
          placeholder={t.sugarPlaceholder}
          keyboardType="numeric"
          value={sugar}
          onChangeText={setSugar}
        />
        <TextInput
          style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
          placeholder={t.foodPlaceholder}
          value={food}
          onChangeText={setFood}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddLog}>
          <Plus color="white" size={24} />
          <Text style={[styles.addButtonText, { fontSize: getAdjustedFontSize(18) }]}>{t.addEntry}</Text>
        </TouchableOpacity>
      </View>

      {showHistoryTable ? (
        <GlucoseHistoryTable
          logs={logs}
          patientName={userProfile?.full_name}
          fetchLogsForExport={fetchOwnLogsForExport}
          onClose={() => setShowHistoryTable(false)}
        />
      ) : (
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <SugarTrendChart logs={logs} />
              <View style={styles.historyHeader}>
                <Text style={[styles.title, { fontSize: getAdjustedFontSize(22) }]}>{t.history}</Text>
                <View style={styles.historyActions}>
                  <TouchableOpacity
                    style={styles.viewToggle}
                    onPress={() => setShowHistoryTable(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t.showHistoryTable}
                  >
                    <Table2 color="#00BFA5" size={18} />
                    <Text style={[styles.viewToggleText, { fontSize: getAdjustedFontSize(12) }]}>{t.showHistoryTable}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShare} accessibilityRole="button" accessibilityLabel={t.shareReportTitle}>
                    <Share2 color="#00BFA5" size={24} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(16) }]}>{t.emptyList}</Text>}
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inputSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#00BFA5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 10,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00BFA5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  viewToggleText: {
    color: '#00BFA5',
    fontWeight: '600',
    marginLeft: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  logItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timestamp: {
    color: '#666',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusNormal: { backgroundColor: '#e2f9e1' },
  statusLow: { backgroundColor: '#fff0f0' },
  statusHigh: { backgroundColor: '#fff8e1' },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  logLabel: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  logValue: {
    color: '#000',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
    fontSize: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 15,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFB2B2',
  },
  warningIcon: {
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    color: '#D32F2F',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  warningSubtitle: {
    color: '#C62828',
  },
});
