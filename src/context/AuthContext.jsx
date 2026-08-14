import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // 🟢 프로필 상태 추가
  const [loading, setLoading] = useState(true);

  // 🟢 프로필 정보를 Supabase에서 가져오는 함수 (외부에서도 호출 가능)
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
          await fetchProfile(session.user.id); // 🟢 로그인 시 프로필 함께 로드
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
        await fetchProfile(session.user.id); // 🟢 상태 변경 시 프로필 로드
      } else {
        setUser(null);
        setProfile(null); // 🟢 로그아웃 시 프로필 초기화
        localStorage.removeItem("userEmail");
        localStorage.removeItem("isLoggedIn");
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // 로그아웃 함수
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("keepLoggedIn");
    window.location.href = "/login";
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
