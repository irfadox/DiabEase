import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import {
  Plus,
  Minus,
  RotateCcw,
  Info,
  ChevronRight,
  LogOut,
} from "lucide-react-native";
import { supabase } from "../utils/supabase";
import { useSettings } from "../context/SettingsContext";
import {
  useLanguageContext,
  AVAILABLE_LANGUAGES,
} from "../context/LanguageContext";
import LangSettingsScreen from "../lang/LangSettingsScreen";
import LangCommon from "../lang/LangCommon";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function SettingsScreen({ navigation }) {
  const {
    minLimit: globalMin,
    maxLimit: globalMax,
    fontSize: globalFontSize,
    updateFontSize,
    updateLimits,
    getAdjustedFontSize,
  } = useSettings();

  const { language, setLanguage } = useLanguageContext();
  const t = LangSettingsScreen[language];
  const common = LangCommon[language];

  const [minLimit, setMinLimit] = useState(globalMin.toString());
  const [maxLimit, setMaxLimit] = useState(globalMax.toString());
  const [fontSize, setFontSize] = useState(globalFontSize);

  useEffect(() => {
    setMinLimit(globalMin.toString());
    setMaxLimit(globalMax.toString());
    setFontSize(globalFontSize);
  }, [globalMin, globalMax, globalFontSize]);

  const handleSave = async () => {
    const min = parseFloat(minLimit);
    const max = parseFloat(maxLimit);

    if (isNaN(min) || isNaN(max)) {
      Alert.alert(common.error, t.errorInvalidLimits);
      return;
    }

    if (min >= max) {
      Alert.alert(common.error, t.errorMinMax);
      return;
    }

    try {
      await updateLimits(min, max);
      await updateFontSize(fontSize);

      Alert.alert(common.success, t.successSaved, [
        { text: common.ok, onPress: () => navigation.navigate("Diary") },
      ]);
    } catch (e) {
      Alert.alert(common.error, t.errorSaveFailed);
    }
  };

  const handleResetFontSize = () => {
    setFontSize(16);
  };

  const handleLogout = () => {
    Alert.alert(t.logoutTitle, t.logoutMessage, [
      { text: common.cancel, style: "cancel" },
      {
        text: t.logout,
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert(common.error, t.errorLogout);
        },
      },
    ]);
  };

  const incrementFontSize = () => {
    if (fontSize < 24) {
      setFontSize((prev) => prev + 1);
    }
  };

  const decrementFontSize = () => {
    if (fontSize > 12) {
      setFontSize((prev) => prev - 1);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.aboutLink}
        onPress={() => navigation.navigate("AboutProject")}
      >
        <View style={styles.aboutLinkContent}>
          <Image
            source={require("../assets/favicon.png")}
            style={styles.aboutIcon}
          />
          <View style={styles.aboutLinkText}>
            <Text
              style={[
                styles.aboutLinkTitle,
                { fontSize: getAdjustedFontSize(16) },
              ]}
            >
              {t.aboutProject}
            </Text>
            <Text
              style={[
                styles.aboutLinkSubtitle,
                { fontSize: getAdjustedFontSize(13) },
              ]}
            >
              {t.aboutProjectSubtitle}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color="#999" />
      </TouchableOpacity>

      {/* Language Settings */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(18) }]}
        >
          {t.languageTitle}
        </Text>

        <View style={styles.infoBox}>
          <Info size={18} color="#00BFA5" style={styles.infoIcon} />
          <Text
            style={[styles.infoText, { fontSize: getAdjustedFontSize(13) }]}
          >
            {t.languageInfo}
          </Text>
        </View>

        <LanguageSwitcher
          languages={AVAILABLE_LANGUAGES}
          language={language}
          onChange={setLanguage}
          fontSize={getAdjustedFontSize(14)}
        />
      </View>

      {/* Target range inputs */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(18) }]}
        >
          {t.targetRangeTitle}
        </Text>

        <View style={styles.infoBox}>
          <Info size={18} color="#00BFA5" style={styles.infoIcon} />
          <Text
            style={[styles.infoText, { fontSize: getAdjustedFontSize(13) }]}
          >
            {t.targetRangeInfo}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getAdjustedFontSize(14) }]}>
              {t.minimum}
            </Text>
            <TextInput
              style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
              keyboardType="numeric"
              value={minLimit}
              onChangeText={setMinLimit}
              placeholder={t.minimumPlaceholder}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getAdjustedFontSize(14) }]}>
              {t.maximum}
            </Text>
            <TextInput
              style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
              keyboardType="numeric"
              value={maxLimit}
              onChangeText={setMaxLimit}
              placeholder={t.maximumPlaceholder}
            />
          </View>
        </View>
      </View>

      {/* Font Size Settings */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(18) }]}
        >
          {t.fontSizeTitle}
        </Text>

        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={[
              styles.stepperButton,
              fontSize <= 12 && styles.stepperButtonDisabled,
            ]}
            onPress={decrementFontSize}
            disabled={fontSize <= 12}
          >
            <Minus size={20} color={fontSize <= 12 ? "#ccc" : "#333"} />
          </TouchableOpacity>

          <View style={styles.fontSizeValueContainer}>
            <Text
              style={[
                styles.fontSizeValue,
                { fontSize: getAdjustedFontSize(18) },
              ]}
            >
              {fontSize}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.stepperButton,
              fontSize >= 24 && styles.stepperButtonDisabled,
            ]}
            onPress={incrementFontSize}
            disabled={fontSize >= 24}
          >
            <Plus size={20} color={fontSize >= 24 ? "#ccc" : "#333"} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetFontSize}
        >
          <RotateCcw size={16} color="#666" style={styles.resetIcon} />
          <Text
            style={[
              styles.resetButtonText,
              { fontSize: getAdjustedFontSize(14) },
            ]}
          >
            {t.resetFontSize}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preview Section */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { fontSize: getAdjustedFontSize(16) }]}
        >
          {t.previewTitle}
        </Text>
        <View style={styles.previewBox}>
          <Text
            style={[styles.previewLabel, { fontSize: getAdjustedFontSize(14) }]}
          >
            {t.previewSugar}{" "}
            <Text style={styles.previewValue}>5.4 {t.unit}</Text>
          </Text>
          <Text
            style={[styles.previewLabel, { fontSize: getAdjustedFontSize(14) }]}
          >
            {t.previewFood}{" "}
            <Text style={styles.previewValue}>{t.previewFoodValue}</Text>
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text
          style={[styles.saveButtonText, { fontSize: getAdjustedFontSize(18) }]}
        >
          {t.saveSettings}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color="#FF3B30" />
        <Text
          style={[styles.logoutButtonText, { fontSize: getAdjustedFontSize(16) }]}
        >
          {t.logout}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  aboutLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 20,
  },
  aboutLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  aboutIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 14,
  },
  aboutLinkText: {
    flex: 1,
  },
  aboutLinkTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  aboutLinkSubtitle: {
    color: "#888",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 30,
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e2f9e1",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    color: "#00796b",
    flex: 1,
  },
  inputGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inputContainer: {
    width: "47%",
  },
  label: {
    color: "#666",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    color: "#333",
    textAlign: "center",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  stepperButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  stepperButtonDisabled: {
    backgroundColor: "#f1f1f1",
    borderColor: "#e1e1e1",
  },
  fontSizeValueContainer: {
    width: 60,
    alignItems: "center",
  },
  fontSizeValue: {
    fontWeight: "bold",
    color: "#333",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: 8,
  },
  resetIcon: {
    marginRight: 6,
  },
  resetButtonText: {
    color: "#666",
    fontWeight: "500",
  },
  previewBox: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  previewLabel: {
    color: "#555",
    marginBottom: 4,
  },
  previewValue: {
    color: "#000",
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#00BFA5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFB2B2",
    marginTop: 14,
    marginBottom: 10,
  },
  logoutButtonText: {
    color: "#D32F2F",
    fontWeight: "600",
    marginLeft: 8,
  },
});
