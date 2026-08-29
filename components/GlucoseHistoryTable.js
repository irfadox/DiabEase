import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FileDown, List } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangDiaryScreen, { getStatusLabel } from '../lang/LangDiaryScreen';
import LangCommon from '../lang/LangCommon';
import { filterLogsByPeriod, PERIODS } from '../utils/logFilters';

const LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', ky: 'ky-KG' };
const getNoteText = (notes, fallback) => !notes || notes === '-' ? fallback : notes;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export default function GlucoseHistoryTable({
  logs,
  patientName,
  fetchLogsForExport,
  onClose,
}) {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangDiaryScreen[language];
  const common = LangCommon[language];
  const locale = LOCALE_MAP[language] || 'ru-RU';

  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(() => new Date());
  const [customEndDate, setCustomEndDate] = useState(() => new Date());
  const [customPicker, setCustomPicker] = useState(null);
  const [exporting, setExporting] = useState(false);

  const filteredLogs = useMemo(
    () => filterLogsByPeriod(logs, selectedPeriod, customStartDate, customEndDate),
    [logs, selectedPeriod, customStartDate, customEndDate]
  );

  const selectedPeriodLabel = selectedPeriod === 'custom'
    ? `${t.periodCustom}: ${customStartDate.toLocaleDateString(locale)} – ${customEndDate.toLocaleDateString(locale)}`
    : t[PERIODS.find((period) => period.id === selectedPeriod)?.key || 'periodToday'];

  const handleCustomDateChange = (event, selectedDate) => {
    setCustomPicker(null);
    if (!selectedDate) return;

    if (customPicker === 'start') {
      setCustomStartDate(selectedDate);
      if (selectedDate > customEndDate) setCustomEndDate(selectedDate);
    } else {
      setCustomEndDate(selectedDate);
      if (selectedDate < customStartDate) setCustomStartDate(selectedDate);
    }
  };

  const handleExportPdf = async () => {
    if (exporting) return;

    setExporting(true);
    try {
      if (typeof fetchLogsForExport !== 'function') {
        throw new Error('No authenticated log query provided for export');
      }

      const freshLogs = await fetchLogsForExport();
      const exportLogs = filterLogsByPeriod(
        freshLogs,
        selectedPeriod,
        customStartDate,
        customEndDate
      );

      if (exportLogs.length === 0) {
        Alert.alert(common.info, t.exportEmpty);
        return;
      }

      const rows = exportLogs.map((log) => `
        <tr>
          <td>${escapeHtml(new Date(log.timestamp).toLocaleString(locale))}</td>
          <td>${escapeHtml(`${log.sugar_level} ${t.unit}`)}</td>
          <td>${escapeHtml(getStatusLabel(log.status, t))}</td>
          <td>${escapeHtml(getNoteText(log.notes, t.noNotes))}</td>
        </tr>
      `).join('');

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
              h1 { color: #00BFA5; margin-bottom: 20px; }
              .meta { margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
              th { background: #e2f9e1; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(t.pdfTitle)}</h1>
            <div class="meta"><strong>${escapeHtml(t.pdfPatient)}:</strong> ${escapeHtml(patientName || t.unknownPatient)}</div>
            <div class="meta"><strong>${escapeHtml(t.pdfPeriod)}:</strong> ${escapeHtml(selectedPeriodLabel)}</div>
            <table>
              <thead>
                <tr>
                  <th>${escapeHtml(t.historyDate)}</th>
                  <th>${escapeHtml(t.historyValue)}</th>
                  <th>${escapeHtml(t.historyStatus)}</th>
                  <th>${escapeHtml(t.historyNotes)}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(common.info, t.exportUnavailable);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: t.exportPdf,
      });
    } catch (error) {
      console.error('Error exporting glucose history PDF', error);
      Alert.alert(common.error, t.errorExportFailed);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.historyHeader}>
        <Text style={[styles.title, { fontSize: getAdjustedFontSize(22) }]}>{t.history}</Text>
        <View style={styles.historyActions}>
          {onClose && (
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t.showDiary}
            >
              <List color="#00BFA5" size={18} />
              <Text style={[styles.viewToggleText, { fontSize: getAdjustedFontSize(12) }]}>{t.showDiary}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.disabledButton]}
            onPress={handleExportPdf}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={t.exportPdf}
          >
            <FileDown color="white" size={18} />
            <Text style={[styles.exportButtonText, { fontSize: getAdjustedFontSize(12) }]}>
              {exporting ? common.loading : t.exportPdf}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.periodLabel, { fontSize: getAdjustedFontSize(14) }]}>{t.periodFilter}</Text>
      <View style={styles.periodSelector}>
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[styles.periodButton, selectedPeriod === period.id && styles.periodButtonSelected]}
            onPress={() => setSelectedPeriod(period.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedPeriod === period.id }}
            accessibilityLabel={t[period.key]}
          >
            <Text style={[
              styles.periodButtonText,
              { fontSize: getAdjustedFontSize(12) },
              selectedPeriod === period.id && styles.periodButtonTextSelected,
            ]}>
              {t[period.key]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedPeriod === 'custom' && (
        <View style={styles.customRange}>
          <TouchableOpacity
            style={styles.customDateButton}
            onPress={() => setCustomPicker('start')}
            accessibilityRole="button"
            accessibilityLabel={t.customStart}
          >
            <Text style={[styles.customDateText, { fontSize: getAdjustedFontSize(13) }]}>
              {t.customStart}: {customStartDate.toLocaleDateString(locale)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.customDateButton}
            onPress={() => setCustomPicker('end')}
            accessibilityRole="button"
            accessibilityLabel={t.customEnd}
          >
            <Text style={[styles.customDateText, { fontSize: getAdjustedFontSize(13) }]}>
              {t.customEnd}: {customEndDate.toLocaleDateString(locale)}
            </Text>
          </TouchableOpacity>
          {customPicker && (
            <DateTimePicker
              value={customPicker === 'start' ? customStartDate : customEndDate}
              mode="date"
              display="default"
              onChange={handleCustomDateChange}
            />
          )}
        </View>
      )}

      <Text style={[styles.selectedPeriod, { fontSize: getAdjustedFontSize(13) }]}>
        {t.selectedPeriod}: {selectedPeriodLabel}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.dateCell, { fontSize: getAdjustedFontSize(11) }]}>{t.historyDate}</Text>
            <Text style={[styles.tableHeaderCell, styles.valueCell, { fontSize: getAdjustedFontSize(11) }]}>{t.historyValue}</Text>
            <Text style={[styles.tableHeaderCell, styles.statusCell, { fontSize: getAdjustedFontSize(11) }]}>{t.historyStatus}</Text>
            <Text style={[styles.tableHeaderCell, styles.notesCell, { fontSize: getAdjustedFontSize(11) }]}>{t.historyNotes}</Text>
          </View>
          {filteredLogs.length === 0 ? (
            <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(16) }]}>{t.historyEmptyPeriod}</Text>
          ) : (
            filteredLogs.map((item) => {
              const statusLabel = getStatusLabel(item.status, t);
              return (
                <View style={styles.tableRow} key={String(item.id)}>
                  <Text style={[styles.tableCell, styles.dateCell, { fontSize: getAdjustedFontSize(12) }]}>
                    {new Date(item.timestamp).toLocaleString(locale)}
                  </Text>
                  <Text style={[styles.tableCell, styles.valueCell, { fontSize: getAdjustedFontSize(13) }]}>
                    {item.sugar_level} {t.unit}
                  </Text>
                  <Text style={[styles.tableCell, styles.statusCell, { fontSize: getAdjustedFontSize(12) }]}>
                    {statusLabel}
                  </Text>
                  <Text style={[styles.tableCell, styles.notesCell, { fontSize: getAdjustedFontSize(12) }]}>
                    {getNoteText(item.notes, t.noNotes)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
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
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00BFA5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  exportButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  periodLabel: {
    color: '#555',
    fontWeight: '600',
    marginBottom: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  periodButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  periodButtonSelected: {
    backgroundColor: '#00BFA5',
    borderColor: '#00BFA5',
  },
  periodButtonText: {
    color: '#555',
    fontWeight: '500',
  },
  periodButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  customRange: {
    gap: 8,
    marginBottom: 4,
  },
  customDateButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
  },
  customDateText: {
    color: '#555',
  },
  selectedPeriod: {
    color: '#888',
    marginBottom: 8,
  },
  table: {
    minWidth: 560,
    paddingBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2f9e1',
    borderWidth: 1,
    borderColor: '#c8ebc7',
    paddingVertical: 10,
  },
  tableHeaderCell: {
    color: '#00796b',
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'white',
    paddingVertical: 10,
  },
  tableCell: {
    color: '#444',
    paddingHorizontal: 6,
  },
  dateCell: {
    width: 160,
  },
  valueCell: {
    width: 110,
  },
  statusCell: {
    width: 90,
  },
  notesCell: {
    width: 200,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
    paddingHorizontal: 20,
  },
});
