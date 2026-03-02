import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  Flame,
  Calendar,
  CheckCircle2,
  Circle,
  Shuffle,
  Zap,
} from "lucide-react";
import { useStore } from "../store";
import { leetCodeApi, Problem } from "../services/leetcode";

interface UserProfile {
  username: string;
  avatar: string;
  ranking: number;
  reputation: number;
  totalQuestions: number;
  totalSubmissions: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

function ProgressRing({
  solved,
  total,
  color,
  label,
}: {
  solved: number;
  total: number;
  color: string;
  label: string;
}) {
  const percentage = total > 0 ? (solved / total) * 100 : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="var(--bg-tertiary)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {solved}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            / {total}
          </span>
        </div>
      </div>
      <span
        className="mt-2 text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
    </div>
  );
}

function HeatMap({ calendar }: { calendar: Record<string, number> }) {
  const today = new Date();
  const [activeDayLabel, setActiveDayLabel] = useState<string>(
    "Hover or tap a day to see details",
  );

  const days = useMemo(() => {
    const result: { date: Date; count: number }[] = [];

    for (let i = 400; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const timestamp = Math.floor(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 1000,
      );
      const count = calendar[timestamp] || 0;
      result.push({ date, count });
    }
    return result;
  }, [calendar]);

  const weeks = useMemo(() => {
    const result: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const dayOfWeek = day.date.getDay();

      if (i === 0) {
        for (let j = 0; j < dayOfWeek; j++) {
          currentWeek.push({ date: new Date(1970, 0, 1), count: -1 });
        }
      }

      currentWeek.push(day);

      if (dayOfWeek === 6 || i === days.length - 1) {
        while (currentWeek.length < 7) {
          currentWeek.push({ date: new Date(1970, 0, 1), count: -1 });
        }
        result.push(currentWeek);
        currentWeek = [];
      }
    }
    return result;
  }, [days]);

  const getColor = (count: number) => {
    if (count < 0) return "transparent";
    if (count === 0) return "var(--bg-tertiary)";
    if (count < 3) return "#0e4429";
    if (count < 6) return "#006d32";
    if (count < 10) return "#26a641";
    return "#39d353";
  };

  const getDayLabel = (day: { date: Date; count: number }) =>
    `${day.date.toLocaleDateString()}: ${day.count} submission${day.count === 1 ? "" : "s"}`;

  return (
    <div
      className="p-4 rounded-card"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-sm font-medium mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Submission Activity
      </h3>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-0.5 min-w-max w-fit mx-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getColor(day.count) }}
                  onMouseEnter={() => {
                    if (day.count >= 0) setActiveDayLabel(getDayLabel(day));
                  }}
                  onTouchStart={() => {
                    if (day.count >= 0) setActiveDayLabel(getDayLabel(day));
                  }}
                  onFocus={() => {
                    if (day.count >= 0) setActiveDayLabel(getDayLabel(day));
                  }}
                  tabIndex={day.count >= 0 ? 0 : -1}
                  aria-label={day.count >= 0 ? getDayLabel(day) : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
        {activeDayLabel}
      </p>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Less
        </span>
        <div className="flex gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#0e4429" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#006d32" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#26a641" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#39d353" }}
          />
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          More
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dailyProblem, setDailyProblem] = useState<Problem | null>(null);
  const [calendar, setCalendar] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loginStatus, setLoginStatus] = useState<string>("");

  const handleDaily = async () => {
    try {
      const problem = await leetCodeApi.getDailyProblem(settings.cookie);
      navigate(`/problems/${problem.titleSlug}`);
    } catch (error) {
      console.error("Failed to fetch daily problem:", error);
    }
  };

  const handleRandom = async () => {
    try {
      const problem = await leetCodeApi.getRandomProblem(settings.cookie);
      navigate(`/problems/${problem.titleSlug}`);
    } catch (error) {
      console.error("Failed to fetch random problem:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileData, daily, calendarData] = await Promise.all([
          leetCodeApi.getUserProfile(settings.cookie),
          leetCodeApi.getDailyProblem(settings.cookie),
          leetCodeApi.getSubmissionCalendar(settings.cookie),
        ]);
        setProfile(profileData);
        setDailyProblem(daily);
        setCalendar(calendarData || {});
        if (!profileData) {
          setLoginStatus("Not logged in or cookie expired");
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setLoginStatus("Error fetching data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [settings.cookie]);

  const streakStats = useMemo(() => {
    const oneDayInSeconds = 86400;
    const activeDays = Object.entries(calendar)
      .filter(([, count]) => Number(count) > 0)
      .map(([timestamp]) => Number(timestamp))
      .filter((timestamp) => Number.isFinite(timestamp))
      .sort((a, b) => a - b);

    if (activeDays.length === 0) {
      return {
        current: 0,
        best: 0,
        thisWeekSubmissions: 0,
        hasTodaySubmission: false,
      };
    }

    const activeSet = new Set(activeDays);
    const now = new Date();
    const todayTimestamp = Math.floor(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 1000,
    );
    const hasTodaySubmission = activeSet.has(todayTimestamp);

    let best = 1;
    let running = 1;
    for (let i = 1; i < activeDays.length; i++) {
      if (activeDays[i] - activeDays[i - 1] === oneDayInSeconds) {
        running += 1;
      } else {
        running = 1;
      }
      if (running > best) best = running;
    }

    let current = 0;
    let cursor = hasTodaySubmission
      ? todayTimestamp
      : todayTimestamp - oneDayInSeconds;
    while (activeSet.has(cursor)) {
      current += 1;
      cursor -= oneDayInSeconds;
    }

    let thisWeekSubmissions = 0;
    for (let i = 0; i < 7; i++) {
      const timestamp = todayTimestamp - i * oneDayInSeconds;
      thisWeekSubmissions += Number(calendar[timestamp] || 0);
    }

    return { current, best, thisWeekSubmissions, hasTodaySubmission };
  }, [calendar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{
              borderColor: "var(--accent-primary)",
              borderTopColor: "transparent",
            }}
          />
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  const totalSolved =
    (profile?.easySolved || 0) +
    (profile?.mediumSolved || 0) +
    (profile?.hardSolved || 0);
  const totalQuestions = profile?.totalQuestions || 3000;

  return (
    <div className="p-6 max-w-6xl mx-auto overflow-auto">
      <div className="mb-6 flex items-center gap-4">
        {profile?.avatar && (
          <img
            src={profile.avatar}
            alt="Profile"
            className="w-12 h-12 rounded-full"
          />
        )}
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Welcome{profile?.username ? `, ${profile.username}` : ""}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Keep practicing and improve your problem-solving skills
          </p>
          {loginStatus && (
            <p className="text-sm mt-1" style={{ color: "var(--warning)" }}>
              ⚠️ {loginStatus}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div
            className="p-6 rounded-card"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Zap size={20} style={{ color: "var(--accent-primary)" }} />
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Quick Actions
              </h2>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDaily}
                className="flex items-center gap-2 px-4 py-3 rounded-btn font-medium transition-all duration-150 hover:scale-105"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "white",
                }}
              >
                <Calendar size={18} />
                Daily Challenge
              </button>
              <button
                onClick={handleRandom}
                className="flex items-center gap-2 px-4 py-3 rounded-btn font-medium transition-all duration-150 hover:scale-105"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <Shuffle size={18} />
                Random Problem
              </button>
            </div>
          </div>

          {dailyProblem && (
            <div
              className="mt-4 p-5 rounded-card"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Calendar
                  size={20}
                  style={{ color: "var(--accent-primary)" }}
                />
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Problem of the Day
                </h2>
              </div>
              <div
                className="flex items-center justify-between p-4 rounded-btn cursor-pointer transition-all duration-150 hover:scale-[1.01]"
                style={{ backgroundColor: "var(--bg-tertiary)" }}
                onClick={() => navigate(`/problems/${dailyProblem.titleSlug}`)}
              >
                <div className="flex items-center gap-4">
                  {dailyProblem.status === "AC" ? (
                    <CheckCircle2
                      size={28}
                      style={{ color: "var(--success)" }}
                    />
                  ) : (
                    <Circle size={28} style={{ color: "var(--text-muted)" }} />
                  )}
                  <div>
                    <h3
                      className="font-medium text-base"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {dailyProblem.title}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {dailyProblem.difficulty} •{" "}
                      {dailyProblem.topicTags
                        ?.slice(0, 2)
                        .map((t: any) => t.name)
                        .join(", ") || "No tags"}
                    </p>
                  </div>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor:
                      dailyProblem.difficulty === "Easy"
                        ? "rgba(76, 175, 80, 0.2)"
                        : dailyProblem.difficulty === "Medium"
                          ? "rgba(255, 152, 0, 0.2)"
                          : "rgba(229, 57, 53, 0.2)",
                    color:
                      dailyProblem.difficulty === "Easy"
                        ? "#4CAF50"
                        : dailyProblem.difficulty === "Medium"
                          ? "#FF9800"
                          : "#E53935",
                  }}
                >
                  {dailyProblem.difficulty}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="p-5 rounded-card"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Progress
          </h3>
          <div className="flex justify-around">
            <ProgressRing
              solved={profile?.easySolved || 0}
              total={Math.floor(totalQuestions * 0.2)}
              color="#4CAF50"
              label="Easy"
            />
            <ProgressRing
              solved={profile?.mediumSolved || 0}
              total={Math.floor(totalQuestions * 0.5)}
              color="#FF9800"
              label="Medium"
            />
            <ProgressRing
              solved={profile?.hardSolved || 0}
              total={Math.floor(totalQuestions * 0.3)}
              color="#E53935"
              label="Hard"
            />
          </div>
          <div className="mt-6 text-center">
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {totalSolved}
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              / {totalQuestions} Problems Solved
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 max-w-4xl mx-auto">
        <div
          className="p-6 rounded-card"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="h-full flex items-center justify-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FFD70020" }}
            >
              <Trophy size={32} style={{ color: "#FFD700" }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Ranking
              </p>
              <p
                className="text-3xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                #{profile?.ranking?.toLocaleString() || "N/A"}
              </p>
            </div>
          </div>
        </div>
        <div
          className="p-6 rounded-card"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="h-full flex items-center justify-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FF980020" }}
            >
              <Flame size={32} style={{ color: "#FF9800" }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Reputation
              </p>
              <p
                className="text-3xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {profile?.reputation?.toLocaleString() || "0"}
              </p>
            </div>
          </div>
        </div>
        <div
          className="p-6 rounded-card"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(255, 87, 34, 0.15)" }}
            >
              <Flame size={32} style={{ color: "#FF5722" }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Current Streak
              </p>
              <p
                className="text-3xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {streakStats.current} day{streakStats.current === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Best: {streakStats.best} days • Last 7d:{" "}
            {streakStats.thisWeekSubmissions} submissions
          </div>
          <div
            className="mt-2 text-xs"
            style={{
              color: streakStats.hasTodaySubmission
                ? "var(--success)"
                : "var(--warning)",
            }}
          >
            {streakStats.hasTodaySubmission
              ? "Great job, you already submitted today."
              : "Submit today to keep your streak alive."}
          </div>
        </div>
      </div>

      <HeatMap calendar={calendar} />

      {!settings.rootFolder && (
        <div
          className="mt-6 p-4 rounded-card"
          style={{
            backgroundColor: "rgba(255, 152, 0, 0.1)",
            border: "1px solid rgba(255, 152, 0, 0.3)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--warning)" }}>
            ⚠️ Set your root folder in Settings to enable opening problems in
            your editor.
          </p>
        </div>
      )}
    </div>
  );
}
