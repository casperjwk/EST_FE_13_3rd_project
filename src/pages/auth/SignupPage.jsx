import React, { useState } from "react";
import SignupStep1 from "./SignupStep1";
import SignupStep2 from "./SignupStep2";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  /* 회원가입 단계 상태 관리 (1: 기본정보, 2: 식단정보선택) */
  const [step, setStep] = useState(1);

  /* 회원가입 전체 폼 데이터 통합 관리 상태 */
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    nickname: "",
    agree: false,
    allergies: [],
    veganType: "none",
  });

  /* Step 1에서 Step 2로 이동 핸들러 */
  const handleNextStep = step1Data => {
    setSignupData(prev => ({
      ...prev,
      ...step1Data,
    }));
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Step 2에서 Step 1로 이동 핸들러 (입력 데이터 유지) */
  const handlePrevStep = (step2Data = {}) => {
    setSignupData(prev => ({
      ...prev,
      ...step2Data,
    }));
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* 회원가입 최종 제출 및 Supabase Auth / profiles DB 연동 핸들러 */
  const handleCompleteSignup = async (step2Data = {}) => {
    const finalData = {
      ...signupData,
      ...step2Data,
    };

    try {
      /* 1. Supabase Auth 회원가입 진행 */
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalData.email,
        password: finalData.password,
        options: {
          data: {
            nickname: finalData.nickname,
          },
        },
      });

      if (authError) {
        console.error("회원가입 에러:", authError.message);
        alert(`회원가입 실패: ${authError.message}`);
        return;
      }

      const user = authData?.user;

      if (user) {
        /* 2. profiles 테이블에 유저 프로필 정보 저장 (upsert 처리) */
        const veganValue = finalData.veganType && finalData.veganType !== "none" ? finalData.veganType : "general";

        const { error: dbError } = await supabase.from("profiles").upsert({
          id: user.id,
          nickname: finalData.nickname || "사용자",
          vegan_type_id: veganValue,
          created_at: new Date().toISOString(),
        });

        if (dbError) {
          console.error("유저 프로필 DB 저장 오류:", dbError.message);
          alert(`프로필 저장 실패: ${dbError.message}`);
          return;
        }

        /* 3. 사용자가 선택한 알레르기 정보 저장 */
        if (finalData.allergies && finalData.allergies.length > 0) {
          const allergyInserts = finalData.allergies.map(allergenId => ({
            user_id: user.id,
            allergen_id: allergenId,
          }));

          const { error: allergyError } = await supabase.from("user_allergies").insert(allergyInserts);

          if (allergyError) {
            console.error("알레르기 정보 DB 저장 오류:", allergyError.message);
          }
        }

        alert("회원가입이 성공적으로 완료되었습니다!");
        window.location.href = "/login";
      }
    } catch (err) {
      console.error("회원가입 처리 중 예외 발생:", err);
      alert("회원가입 진행 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  /* 로그인 페이지 이동 핸들러 */
  const handleGoToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <>
      {step === 1 ? (
        <SignupStep1 onNext={handleNextStep} onGoToLogin={handleGoToLogin} initialData={signupData} />
      ) : (
        <SignupStep2 onPrev={handlePrevStep} onComplete={handleCompleteSignup} initialData={signupData} />
      )}
    </>
  );
}
