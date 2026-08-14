import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    allow_on_demand: true,
    show_cross_contam_modal: false,
    card_count: "5개 노출(권장)",
  });
  const [loading, setLoading] = useState(true);

  // Supabase에서 설정값을 가져오는 함수
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error("설정값 로드 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings: fetchSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
