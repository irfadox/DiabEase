import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../utils/supabase';
import { User, ChevronRight, Briefcase } from 'lucide-react-native';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangDoctorSelection from '../lang/LangDoctorSelection';
import LangCommon from '../lang/LangCommon';

export default function DoctorSelection({ onSelect }) {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangDoctorSelection[language];
  const common = LangCommon[language];

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'doctor');
      
      if (error) throw error;
      setDoctors(data || []);
    } catch (e) {
      console.error('Error fetching doctors:', e);
      Alert.alert(common.error, t.errorLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (doctor) => {
    Alert.alert(
      t.selectTitle,
      t.selectMessage.replace('{name}', doctor.full_name),
      [
        { text: common.cancel, style: 'cancel' },
        { 
          text: t.confirmSelect, 
          onPress: async () => {
            try {
              const { data: { user } = {} } = await supabase.auth.getUser();
              if (!user) throw new Error('User not authenticated');
              const { error } = await supabase
                .from('profiles')
                .update({ assigned_doctor_id: doctor.id })
                .eq('id', user.id);
              
              if (error) throw error;
              onSelect(doctor.id);
            } catch (e) {
              Alert.alert(common.error, t.errorAssignFailed);
            }
          }
        }
      ]
    );
  };

  const renderDoctor = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
      <View style={styles.avatar}>
        <User color="white" size={24} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { fontSize: getAdjustedFontSize(16) }]}>{item.full_name}</Text>
        <View style={styles.tag}>
          <Briefcase size={12} color="#00BFA5" />
          <Text style={[styles.tagText, { fontSize: getAdjustedFontSize(12) }]}>{item.affiliation || t.defaultDoctorTag}</Text>
        </View>
        <Text style={[styles.desc, { fontSize: getAdjustedFontSize(13) }]} numberOfLines={2}>{item.description}</Text>
      </View>
      <ChevronRight color="#ccc" size={20} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: getAdjustedFontSize(20) }]}>{t.title}</Text>
        <Text style={[styles.subtitle, { fontSize: getAdjustedFontSize(14) }]}>{t.subtitle}</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#00BFA5" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={doctors}
          renderItem={renderDoctor}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(14) }]}>{t.emptyList}</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { padding: 24, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00BFA5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  tag: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  tagText: { fontSize: 12, color: '#00BFA5', marginLeft: 4, fontWeight: '500' },
  desc: { fontSize: 13, color: '#888', marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999' }
});
