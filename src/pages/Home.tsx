import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  Flame,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Circle,
  Award,
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

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dailyProblem, setDailyProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginStatus, setLoginStatus] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileData, daily] = await Promise.all([
          leetCodeApi.getUserProfile(settings.cookie),
          leetCodeApi.getDailyProblem(settings.cookie),
        ]);
        console.log("Profile data:", profileData);
        console.log("Daily problem:", daily);
        setProfile(profileData);
        setDailyProblem(daily);
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        {profile?.avatar && (
          <img
            src={profile.avatar}
            alt="Profile"
            className="w-16 h-16 rounded-full"
          />
        )}
        <div>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Welcome{profile?.username ? `, ${profile.username}` : ""}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Keep practicing and improve your problem-solving skills
          </p>
          {loginStatus && (
            <p className="text-sm mt-2" style={{ color: "var(--warning)" }}>
              ⚠️ {loginStatus}
            </p>
          )}
        </div>
      </div>

      {profile && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <StatCard
              icon={Trophy}
              label="Ranking"
              value={`#${profile.ranking?.toLocaleString() || "N/A"}`}
              color="#FFD700"
            />
            <StatCard
              icon={Award}
              label="Easy"
              value={profile.easySolved?.toString() || "0"}
              color="#4CAF50"
            />
            <StatCard
              icon={Award}
              label="Medium"
              value={profile.mediumSolved?.toString() || "0"}
              color="#FF9800"
            />
            <StatCard
              icon={Award}
              label="Hard"
              value={profile.hardSolved?.toString() || "0"}
              color="#E53935"
            />
            <StatCard
              icon={Flame}
              label="Reputation"
              value={profile.reputation?.toString() || "0"}
              color="#FF9800"
            />
            <StatCard
              icon={TrendingUp}
              label="Submissions"
              value={profile.totalSubmissions?.toString() || "0"}
              color="#4CAF50"
            />
          </div>
        </>
      )}

      {dailyProblem && (
        <div
          className="p-6 rounded-card"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Calendar size={20} style={{ color: "var(--accent-primary)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Daily Challenge
            </h2>
          </div>

          <div
            className="flex items-center justify-between p-4 rounded-btn cursor-pointer transition-all duration-150 hover:scale-[1.01]"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
            onClick={() => navigate(`/problems/${dailyProblem.titleSlug}`)}
          >
            <div className="flex items-center gap-4">
              {dailyProblem.status === "AC" ? (
                <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
              ) : (
                <Circle size={24} style={{ color: "var(--text-muted)" }} />
              )}
              <div>
                <h3
                  className="font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {dailyProblem.title}
                </h3>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {dailyProblem.difficulty}
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

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="p-4 rounded-card"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
          <p
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
