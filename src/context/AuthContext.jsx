import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 초기 세션 및 로컬 스토리지 동기화 확인
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && session.user) {
          setUser(session.user);
          localStorage.setItem("userEmail", session.user.email);
          localStorage.setItem("isLoggedIn", "true");
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

    // 2. Supabase 인증 상태 변경 감지 (로그인/로그아웃 실시간 반영)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        setUser(session.user);
        localStorage.setItem("userEmail", session.user.email);
        localStorage.setItem("isLoggedIn", "true");
      } else {
        setUser(null);
        localStorage.removeItem("userEmail");
        localStorage.removeItem("isLoggedIn");
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 로그아웃 함수
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("keepLoggedIn");
    window.location.href = "/login";
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
};

// 다른 컴포넌트에서 쉽게 쓸 수 있도록 커스텀 훅 제공
export const useAuth = () => useContext(AuthContext);
