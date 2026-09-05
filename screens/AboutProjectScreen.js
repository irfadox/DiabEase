import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import {
  Book,
  Bell,
  MessageSquare,
  Settings,
  LogIn,
  Users,
} from "lucide-react-native";
import { useSettings } from "../context/SettingsContext";
import { useLanguageContext } from "../context/LanguageContext";
import LangAboutProjectScreen from "../lang/LangAboutProjectScreen";

const SCREEN_GUIDES = [
  { key: "diary", Icon: Book, color: "#00BFA5" },
  { key: "reminders", Icon: Bell, color: "#FF9800" },
  { key: "chat", Icon: MessageSquare, color: "#2196F3" },
  { key: "settings", Icon: Settings, color: "#607D8B" },
  { key: "auth", Icon: LogIn, color: "#9C27B0" },
  { key: "patients", Icon: Users, color: "#E91E63" },
];

export default function AboutProjectScreen() {
  const { getAdjustedFontSize } = useSettings();
  const { language } = useLanguageContext();
  const t = LangAboutProjectScreen[language];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroSection}>
        <Image source={require("../assets/favicon.png")} style={styles.icon} />
        <Text style={[styles.appName, { fontSize: getAdjustedFontSize(26) }]}>
          {t.appName}
        </Text>
        <Text style={[styles.version, { fontSize: getAdjustedFontSize(13) }]}>
          {t.version} v0.1.6
        </Text>
      </View>

      <View style={styles.section}>
        <Text
          style={[styles.description, { fontSize: getAdjustedFontSize(15) }]}
        >
          {t.description}
        </Text>
      </View>

      <Text style={[styles.guideTitle, { fontSize: getAdjustedFontSize(18) }]}>
        {t.screensGuideTitle}
      </Text>

      {SCREEN_GUIDES.map(({ key, Icon, color }) => (
        <View key={key} style={styles.guideCard}>
          <View
            style={[styles.guideIconWrap, { backgroundColor: `${color}18` }]}
          >
            <Icon size={22} color={color} />
          </View>
          <View style={styles.guideTextWrap}>
            <Text
              style={[
                styles.guideCardTitle,
                { fontSize: getAdjustedFontSize(16) },
              ]}
            >
              {t[`${key}Title`]}
            </Text>
            <Text
              style={[
                styles.guideCardDescription,
                { fontSize: getAdjustedFontSize(14) },
              ]}
            >
              {t[`${key}Description`]}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingVertical: 10,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: 14,
  },
  appName: {
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  version: {
    color: "#888",
  },
  section: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 28,
  },
  description: {
    color: "#444",
    lineHeight: 24,
  },
  guideTitle: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  guideCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
  },
  guideIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  guideTextWrap: {
    flex: 1,
  },
  guideCardTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  guideCardDescription: {
    color: "#666",
    lineHeight: 21,
  },
});
