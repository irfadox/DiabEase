import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../utils/supabase';
import { User, MessageSquare, Info } from 'lucide-react-native';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangPatientListScreen from '../lang/LangPatientListScreen';
import LangCommon from '../lang/LangCommon';

export default function PatientListScreen({ navigation }) {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangPatientListScreen[language];
  const common = LangCommon[language];

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AboutProject')}
          style={{ marginRight: 16 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Info size={22} color="#00BFA5" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, language]);

  const fetchPatients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('assigned_doctor_id', user.id);
      
      if (error) throw error;
      setPatients(data || []);
    } catch (e) {
      console.error('Error fetching patients:', e);
      Alert.alert(common.error, t.errorLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  const renderPatient = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <User color="white" size={24} />
      </View>
      <View style={styles.info}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PatientDetail', {
            patientId: item.id,
            patientName: item.full_name,
          })}
          activeOpacity={0.7}
        >
          <Text style={[styles.name, { fontSize: getAdjustedFontSize(16) }]}>{item.full_name}</Text>
          <Text style={[styles.details, { fontSize: getAdjustedFontSize(13) }]}>{item.description || t.noDescription}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => navigation.navigate('PatientChat', {
          patientId: item.id,
          patientName: item.full_name,
        })}
        style={styles.chatButton}
        accessibilityRole="button"
        accessibilityLabel={t.openChat}
      >
        <MessageSquare color="#00BFA5" size={20} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#00BFA5" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={patients}
          renderItem={renderPatient}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(16) }]}>{t.emptyList}</Text>
          }
          refreshing={loading}
          onRefresh={fetchPatients}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00BFA5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  chatButton: { padding: 8, marginLeft: 8 },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  details: { fontSize: 13, color: '#666', marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16 }
});
