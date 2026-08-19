import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 프로필 정보를 Supabase에서 가져오는 함수
  const fetchProfile = useCallback(async userId => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

      if (error) {
        console.error("프로필 조회 오류:", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("프로필 조회 중 예외 발생:", err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && session.user) {
          setUser(session.user);
          localStorage.setItem("userEmail", session.user.email);
          localStorage.setItem("isLoggedIn", "true");
          await fetchProfile(session.user.id);
        } else {
          const savedEmail = localStorage.getItem("userEmail");
          if (savedEmail) {
            setUser({ email: savedEmail });
          }
        }
      } catch (err) {
        console.error("AuthContext 세션 확인 오류:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && session.user) {
        setUser(session.user);
        localStorage.setItem("userEmail", session.user.email);
        localStorage.setItem("isLoggedIn", "true");
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem("userEmail");
        localStorage.removeItem("isLoggedIn");
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // Supabase Realtime 구독
  useEffect(() => {
    if (!user?.id) return;

    const profileChannel = supabase
      .channel(`public:profiles:id=eq.${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        payload => {
          if (payload.new) {
            setProfile(payload.new);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  //  마이페이지에서 다른 페이지(홈, 레시피 등)로 이동하거나 창을 클릭할 때 즉시 최신 프로필 동기화
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user?.id) {
        fetchProfile(user.id);
      }
    };

    const handleFocus = () => {
      if (user?.id) {
        fetchProfile(user.id);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id, fetchProfile]);

  // 로그아웃 함수
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("keepLoggedIn");
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, refreshProfile: () => user && fetchProfile(user.id), loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
