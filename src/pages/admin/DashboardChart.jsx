import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "../../lib/supabase";

const DashboardChart = () => {
  const [colors, setColors] = useState({
    primary: "var(--primary)",
    secondary: "var(--secondary)",
    tag: "var(--tag)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    gray2: "var(--gray-2)",
  });

  const [lineData, setLineData] = useState([]);
  const [pieData, setPieData] = useState([]);

  useEffect(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    setColors({
      primary: rootStyle.getPropertyValue("--primary").trim() || "var(--primary)",
      secondary: rootStyle.getPropertyValue("--secondary").trim() || "var(--secondary)",
      tag: rootStyle.getPropertyValue("--tag").trim() || "var(--tag)",
      warning: rootStyle.getPropertyValue("--warning").trim() || "var(--warning)",
      danger: rootStyle.getPropertyValue("--danger").trim() || "var(--danger)",
      gray2: rootStyle.getPropertyValue("--gray-2").trim() || "var(--gray-2)",
    });
  }, []);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        // 1. 도넛 차트용: 모든 회원이 등록한 알레르기 전체 데이터와 알레르기 마스터 목록 가져오기
        const { data: userAllergiesData, error: allergyError } = await supabase
          .from("user_allergies")
          .select("allergen_id");

        if (allergyError) throw allergyError;

        const { data: allergensList, error: allergensListError } = await supabase.from("allergens").select("id, name");

        if (allergensListError) throw allergensListError;

        if (userAllergiesData && allergensList) {
          // 알레르기 ID별로 몇 명이나 체크했는지 빈도수 집계
          const counts = {};
          userAllergiesData.forEach(item => {
            const id = item.allergen_id;
            counts[id] = (counts[id] || 0) + 1;
          });

          // 전체 체크된 알레르기 총 개수 (비율 계산용 분모)
          const totalCheckCount = userAllergiesData.length;

          const colorPalette = [
            colors.primary,
            colors.secondary,
            colors.tag,
            colors.warning,
            colors.danger,
            colors.gray2,
          ];

          // 각 알레르기별 비율(%) 계산
          const calculatedPieData = allergensList
            .map((allergen, index) => {
              const count = counts[allergen.id] || 0;
              // 전체 중 해당 알레르기가 차지하는 퍼센티지 계산
              const percentage = totalCheckCount > 0 ? Math.round((count / totalCheckCount) * 100) : 0;
              return {
                name: allergen.name,
                value: percentage,
                count: count, // 실제 체크된 인원 수도 함께 보관
                color: colorPalette[index % colorPalette.length],
              };
            })
            .filter(item => item.value > 0); // 0%인 것은 제외

          if (calculatedPieData.length > 0) {
            setPieData(calculatedPieData);
          } else {
            setPieData([{ name: "등록된 알레르기 없음", value: 100, color: colors.gray2 }]);
          }
        }

        // 2. 꺾은선 차트용: profiles 테이블에서 실제 가입일(created_at) 가져와서 월별 누적 집계
        const { data: profilesData, error: profileError } = await supabase.from("profiles").select("created_at");

        if (profileError) throw profileError;

        const monthlyCounts = Array(12).fill(0);

        if (profilesData) {
          profilesData.forEach(profile => {
            if (profile.created_at) {
              const date = new Date(profile.created_at);
              const monthIndex = date.getMonth();
              if (monthIndex >= 0 && monthIndex < 12) {
                monthlyCounts[monthIndex] += 1;
              }
            }
          });
        }

        let cumulativeUsers = 0;
        const fullYearData = monthlyCounts.map((count, index) => {
          cumulativeUsers += count;
          const monthStr = `${index + 1}월`;

          return {
            month: monthStr,
            userCount: cumulativeUsers,
            aiCount: 0, // AI 검색량은 임시값 제거 후 0으로 깔끔하게 처리
          };
        });

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const startIndex = Math.max(0, currentMonth - 6);
        const endIndex = currentMonth;

        const generatedLineData = fullYearData.slice(startIndex, endIndex);
        setLineData(generatedLineData);
      } catch (err) {
        console.error("차트 데이터 연동 오류:", err);
      }
    };

    fetchChartData();
  }, [colors]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* 꺾은선 차트 영역 */}
      <div
        style={{
          width: "100%",
          height: 350,
          backgroundColor: "var(--white-1)",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid var(--gray-1)",
        }}
      >
        <h3 className="text-button-m" style={{ marginBottom: "20px", color: "var(--black-1)" }}>
          월별 회원 가입 및 AI 레시피 검색 추이
        </h3>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-1)" />
            <XAxis dataKey="month" stroke="var(--gray-3)" tickLine={false} style={{ fontSize: "var(--xsmall)" }} />
            <YAxis
              domain={[0, "auto"]}
              stroke="var(--gray-3)"
              axisLine={false}
              tickLine={false}
              style={{ fontSize: "var(--xsmall)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--white-1)",
                borderRadius: "8px",
                border: "1px solid var(--gray-1)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                fontSize: "var(--small)",
              }}
              formatter={(value, name) => {
                if (name === "userCount" || name === "가입 회원 수") {
                  return [`${value.toLocaleString()}명`, "가입 회원 수"];
                }
                return [`${value.toLocaleString()}회`, "실시간 AI 변환 요청량"];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: "var(--small)", color: "var(--black-2)" }}
            />
            <Line
              type="monotone"
              dataKey="userCount"
              name="가입 회원 수"
              stroke={colors.primary}
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#FFF", stroke: colors.primary, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: colors.primary }}
            />
            <Line
              type="monotone"
              dataKey="aiCount"
              name="실시간 AI 변환 요청량"
              stroke={colors.secondary}
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#FFF", stroke: colors.secondary, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: colors.secondary }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 도넛 차트 영역 */}
      <div
        style={{
          width: "100%",
          height: 360,
          backgroundColor: "var(--white-1)",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid var(--gray-1)",
        }}
      >
        <h3 className="text-button-m" style={{ marginBottom: "20px", color: "var(--black-1)" }}>
          보유 알레르기 & 비건 비율
        </h3>
        <ResponsiveContainer width="100%" height="80%">
          <PieChart>
            <Pie data={pieData} cx="40%" cy="50%" innerRadius={65} outerRadius={105} dataKey="value" paddingAngle={3}>
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--white-1)",
                borderRadius: "8px",
                border: "1px solid var(--gray-1)",
                fontSize: "var(--small)",
              }}
              formatter={(value, name, item) => [`${value}% (${item.payload.count}명)`, item.payload.name]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconSize={12}
              wrapperStyle={{
                right: "15%",
                lineY: "32px",
              }}
              formatter={value => (
                <span
                  style={{
                    fontSize: "14px",
                    color: "var(--black-2)",
                    fontWeight: 500,
                    marginLeft: "6px",
                  }}
                >
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardChart;
