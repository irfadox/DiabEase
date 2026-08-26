import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Line,
  Path,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { ChevronDown, ChartLine } from 'lucide-react-native';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext } from '../context/LanguageContext';
import LangDiaryScreen from '../lang/LangDiaryScreen';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', ky: 'ky-KG' };
const CHART_HEIGHT = 188;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 28;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 10;

const CRITICAL_LOW_DEFAULT = 2.8;
const CRITICAL_HIGH_DEFAULT = 13.9;

const PERIODS = [
  { id: 'day', key: 'periodDay' },
  { id: 'week', key: 'periodWeek' },
  { id: 'month1', key: 'period1m' },
  { id: 'month3', key: 'period3m' },
  { id: 'month6', key: 'period6m' },
  { id: 'month9', key: 'period9m' },
  { id: 'year', key: 'periodYear' },
];

const COLORS = {
  teal: '#00BFA5',
  normalZone: '#e2f9e1',
  normalLine: '#43A047',
  criticalLow: '#FF3B30',
  criticalHigh: '#FF9500',
  axis: '#ddd',
  label: '#888',
  pointLow: '#FF3B30',
  pointHigh: '#FF9500',
  pointNormal: '#00BFA5',
};

function getPeriodBounds(periodId) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start;

  switch (periodId) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      break;
    case 'month1':
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case 'month3':
      start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'month6':
      start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case 'month9':
      start = new Date(now.getFullYear(), now.getMonth() - 9, now.getDate());
      break;
    case 'year':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { start, end };
}

function parseSugar(log) {
  const value = parseFloat(log.sugar_level);
  if (isNaN(value) || value <= 0) return null;
  return value;
}

function getCriticalLevels(minLimit, maxLimit) {
  let criticalLow = CRITICAL_LOW_DEFAULT;
  let criticalHigh = CRITICAL_HIGH_DEFAULT;
  if (criticalLow >= minLimit) {
    criticalLow = Math.max(0.5, +(minLimit - 1).toFixed(1));
  }
  if (criticalHigh <= maxLimit) {
    criticalHigh = +(maxLimit + 3).toFixed(1);
  }
  return { criticalLow, criticalHigh };
}

function formatTick(date, periodId, locale) {
  if (periodId === 'day') {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (periodId === 'week') {
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  }
  if (periodId === 'year' || periodId === 'month9' || periodId === 'month6') {
    return date.toLocaleDateString(locale, { month: 'short' });
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function pointColor(value, minLimit, maxLimit, criticalLow, criticalHigh) {
  if (value <= criticalLow || value >= criticalHigh) return COLORS.pointLow;
  if (value < minLimit) return COLORS.pointLow;
  if (value > maxLimit) return COLORS.pointHigh;
  return COLORS.pointNormal;
}

function placeYLabels(items, yFor, minGap = 14) {
  const sorted = [...items].sort((a, b) => yFor(a.value) - yFor(b.value));
  const placed = [];
  sorted.forEach((item) => {
    const y = yFor(item.value);
    if (placed.every((p) => Math.abs(p.y - y) >= minGap)) {
      placed.push({ ...item, y });
    }
  });
  return placed;
}

export default function SugarTrendChart({ logs }) {
  const { minLimit, maxLimit, getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangDiaryScreen[language];
  const locale = LOCALE_MAP[language] || 'ru-RU';

  const [expanded, setExpanded] = useState(true);
  const [period, setPeriod] = useState('day');
  const [chartWidth, setChartWidth] = useState(0);

  const { start, end } = useMemo(() => getPeriodBounds(period), [period]);
  const { criticalLow, criticalHigh } = useMemo(
    () => getCriticalLevels(minLimit, maxLimit),
    [minLimit, maxLimit]
  );

  const periodLogs = useMemo(() => {
    const startMs = start.getTime();
    const endMs = end.getTime();
    return (logs || [])
      .map((log) => {
        const value = parseSugar(log);
        const timestamp = new Date(log.timestamp).getTime();
        if (value === null || isNaN(timestamp)) return null;
        if (timestamp < startMs || timestamp >= endMs) return null;
        return { value, timestamp };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [logs, start, end]);

  const stats = useMemo(() => {
    if (periodLogs.length === 0) return null;
    const values = periodLogs.map((p) => p.value);
    const sum = values.reduce((acc, v) => acc + v, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [periodLogs]);

  const plot = useMemo(() => {
    if (chartWidth <= 0) return null;

    const plotWidth = Math.max(0, chartWidth - PLOT_LEFT - PLOT_RIGHT);
    const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
    const startMs = start.getTime();
    const endMs = end.getTime();
    const span = Math.max(endMs - startMs, 1);

    const dataMin = periodLogs.length ? Math.min(...periodLogs.map((p) => p.value)) : minLimit;
    const dataMax = periodLogs.length ? Math.max(...periodLogs.map((p) => p.value)) : maxLimit;
    const yMin = Math.max(0, Math.min(dataMin, criticalLow, minLimit) - 0.6);
    const yMax = Math.max(dataMax, criticalHigh, maxLimit) + 0.8;
    const ySpan = Math.max(yMax - yMin, 0.1);

    const xFor = (timestamp) => PLOT_LEFT + ((timestamp - startMs) / span) * plotWidth;
    const yFor = (value) => PLOT_TOP + (1 - (value - yMin) / ySpan) * plotHeight;

    const points = periodLogs.map((p) => ({
      ...p,
      x: xFor(p.timestamp),
      y: yFor(p.value),
      color: pointColor(p.value, minLimit, maxLimit, criticalLow, criticalHigh),
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PLOT_TOP + plotHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PLOT_TOP + plotHeight).toFixed(1)} Z`
      : '';

    const tickCount = 4;
    const xTicks = Array.from({ length: tickCount }, (_, i) => {
      const ts = startMs + span * (i / tickCount);
      return { x: xFor(ts), label: formatTick(new Date(ts), period, locale) };
    });

    const yLabels = placeYLabels(
      [
        { value: criticalHigh, color: COLORS.criticalHigh },
        { value: maxLimit, color: COLORS.normalLine },
        { value: minLimit, color: COLORS.normalLine },
        { value: criticalLow, color: COLORS.criticalLow },
      ],
      yFor
    );

    return {
      plotWidth,
      plotHeight,
      yFor,
      points,
      linePath,
      areaPath,
      xTicks,
      yLabels,
    };
  }, [chartWidth, periodLogs, start, end, period, locale, minLimit, maxLimit, criticalLow, criticalHigh]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const selectPeriod = (id) => {
    setPeriod(id);
  };

  const emptyMessage = (logs || []).length === 0 ? t.chartEmptyNoLogs : t.chartEmptyPeriod;
  const showPoints = plot && plot.points.length <= 40;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <ChartLine size={18} color="#00BFA5" />
          </View>
          <Text style={[styles.title, { fontSize: getAdjustedFontSize(16) }]}>
            {t.chartTitle}
          </Text>
        </View>
        <ChevronDown
          size={20}
          color="#999"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.periodRow}>
            {PERIODS.map((item) => {
              const selected = period === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.periodChip, selected && styles.periodChipSelected]}
                  onPress={() => selectPeriod(item.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.periodChipText,
                      { fontSize: getAdjustedFontSize(12) },
                      selected && styles.periodChipTextSelected,
                    ]}
                  >
                    {t[item.key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {periodLogs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <ChartLine size={32} color="#ccc" />
              <Text style={[styles.emptyTitle, { fontSize: getAdjustedFontSize(15) }]}>
                {t.chartEmptyTitle}
              </Text>
              <Text style={[styles.emptyText, { fontSize: getAdjustedFontSize(13) }]}>
                {emptyMessage}
              </Text>
            </View>
          ) : (
            <>
              {stats && (
                <Text style={[styles.stats, { fontSize: getAdjustedFontSize(12) }]}>
                  {t.chartAvg} {stats.avg.toFixed(1)}  ·  {t.chartMin} {stats.min.toFixed(1)}  ·  {t.chartMax} {stats.max.toFixed(1)}  {t.unit}
                </Text>
              )}

              <View
                style={styles.chartCanvas}
                collapsable={false}
                onLayout={(e) => {
                  const nextWidth = Math.round(e.nativeEvent.layout.width);
                  if (nextWidth !== chartWidth) setChartWidth(nextWidth);
                }}
              >
                {plot && chartWidth > 0 && (
                  <Svg width={chartWidth} height={CHART_HEIGHT}>
                    <Defs>
                      <LinearGradient id="sugarFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={COLORS.teal} stopOpacity="0.22" />
                        <Stop offset="1" stopColor={COLORS.teal} stopOpacity="0.02" />
                      </LinearGradient>
                    </Defs>

                    <Line
                      x1={PLOT_LEFT}
                      y1={PLOT_TOP}
                      x2={PLOT_LEFT}
                      y2={PLOT_TOP + plot.plotHeight}
                      stroke={COLORS.axis}
                      strokeWidth={1}
                    />
                    <Line
                      x1={PLOT_LEFT}
                      y1={PLOT_TOP + plot.plotHeight}
                      x2={PLOT_LEFT + plot.plotWidth}
                      y2={PLOT_TOP + plot.plotHeight}
                      stroke={COLORS.axis}
                      strokeWidth={1}
                    />

                    <Rect
                      x={PLOT_LEFT}
                      y={plot.yFor(maxLimit)}
                      width={plot.plotWidth}
                      height={Math.max(0, plot.yFor(minLimit) - plot.yFor(maxLimit))}
                      fill={COLORS.normalZone}
                    />

                    <Line
                      x1={PLOT_LEFT}
                      y1={plot.yFor(criticalHigh)}
                      x2={PLOT_LEFT + plot.plotWidth}
                      y2={plot.yFor(criticalHigh)}
                      stroke={COLORS.criticalHigh}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />
                    <Line
                      x1={PLOT_LEFT}
                      y1={plot.yFor(maxLimit)}
                      x2={PLOT_LEFT + plot.plotWidth}
                      y2={plot.yFor(maxLimit)}
                      stroke={COLORS.normalLine}
                      strokeWidth={1}
                    />
                    <Line
                      x1={PLOT_LEFT}
                      y1={plot.yFor(minLimit)}
                      x2={PLOT_LEFT + plot.plotWidth}
                      y2={plot.yFor(minLimit)}
                      stroke={COLORS.normalLine}
                      strokeWidth={1}
                    />
                    <Line
                      x1={PLOT_LEFT}
                      y1={plot.yFor(criticalLow)}
                      x2={PLOT_LEFT + plot.plotWidth}
                      y2={plot.yFor(criticalLow)}
                      stroke={COLORS.criticalLow}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />

                    {plot.areaPath ? (
                      <Path d={plot.areaPath} fill="url(#sugarFill)" />
                    ) : null}
                    {plot.linePath ? (
                      <Path
                        d={plot.linePath}
                        fill="none"
                        stroke={COLORS.teal}
                        strokeWidth={2.2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : null}

                    {showPoints &&
                      plot.points.map((p, i) => (
                        <Circle
                          key={`${p.timestamp}-${i}`}
                          cx={p.x}
                          cy={p.y}
                          r={4}
                          fill={p.color}
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                      ))}

                    {plot.yLabels.map((label) => (
                      <SvgText
                        key={`y-${label.value}`}
                        x={PLOT_LEFT - 6}
                        y={label.y + 3}
                        fontSize={10}
                        fill={label.color}
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {Number(label.value).toFixed(1)}
                      </SvgText>
                    ))}

                    {plot.xTicks.map((tick, i) => (
                      <SvgText
                        key={`x-${i}`}
                        x={tick.x}
                        y={CHART_HEIGHT - 8}
                        fontSize={10}
                        fill={COLORS.label}
                        textAnchor={i === 0 ? 'start' : 'middle'}
                      >
                        {tick.label}
                      </SvgText>
                    ))}
                  </Svg>
                )}
              </View>

              <View style={styles.legend}>
                <LegendSwatch color={COLORS.normalZone} border={COLORS.normalLine} filled />
                <Text style={[styles.legendText, { fontSize: getAdjustedFontSize(11) }]}>
                  {t.legendNormal}
                </Text>
                <LegendSwatch color={COLORS.criticalLow} dashed />
                <Text style={[styles.legendText, { fontSize: getAdjustedFontSize(11) }]}>
                  {t.legendCriticalLow}
                </Text>
                <LegendSwatch color={COLORS.criticalHigh} dashed />
                <Text style={[styles.legendText, { fontSize: getAdjustedFontSize(11) }]}>
                  {t.legendCriticalHigh}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function LegendSwatch({ color, dashed, filled, border }) {
  if (filled) {
    return (
      <View
        style={[
          styles.legendSwatchFill,
          { backgroundColor: color, borderColor: border || color },
        ]}
      />
    );
  }
  if (dashed) {
    return (
      <View style={styles.legendSwatchDashedRow}>
        <View style={[styles.legendSwatchDash, { backgroundColor: color }]} />
        <View style={[styles.legendSwatchDash, { backgroundColor: color }]} />
      </View>
    );
  }
  return <View style={[styles.legendSwatchLine, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    marginBottom: 0,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e2f9e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontWeight: '700',
    color: '#333',
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  periodChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  periodChipSelected: {
    backgroundColor: '#00BFA5',
    borderColor: '#00BFA5',
  },
  periodChipText: {
    color: '#333',
    fontWeight: '500',
  },
  periodChipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  stats: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  chartCanvas: {
    height: CHART_HEIGHT,
    width: '100%',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: '#555',
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  legendText: {
    color: '#666',
    marginRight: 8,
  },
  legendSwatchFill: {
    width: 14,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
  },
  legendSwatchLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  legendSwatchDashedRow: {
    flexDirection: 'row',
    width: 14,
    justifyContent: 'space-between',
  },
  legendSwatchDash: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
});
