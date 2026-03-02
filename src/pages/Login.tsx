import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useStore } from "../store";
import { leetCodeApi } from "../services/leetcode";

export default function Login() {
  const navigate = useNavigate();
  const { setSettings, setAuthenticated } = useStore();
  const [cookie, setCookie] = useState("");
  const [showCookie, setShowCookie] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await leetCodeApi.validateCookie(cookie);

      if (result.valid) {
        const finalCookie = result.cookie || cookie;
        await window.electronAPI.store.set("cookie", finalCookie);
        setSettings({ cookie: finalCookie });
        setAuthenticated(true);
        navigate("/");
      } else {
        setError(
          result.reason || "Invalid cookie. Please check and try again.",
        );
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err?.message || "Failed to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md p-8 rounded-card"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-4"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            L
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            LeetGrind
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Sign in with your LeetCode cookie
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              LeetCode Session Cookie
            </label>
            <div className="relative">
              <KeyRound
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={18}
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type={showCookie ? "text" : "password"}
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="Paste your LEETCODE_SESSION cookie"
                className="w-full pl-10 pr-10 py-3 rounded-input text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowCookie(!showCookie)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              >
                {showCookie ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-btn mb-4 text-sm"
              style={{
                backgroundColor: "rgba(244, 67, 54, 0.1)",
                color: "var(--error)",
              }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !cookie}
            className="w-full py-3 rounded-btn font-medium transition-all duration-150 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "white",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            To get your cookie: <br />
            1. Log in to LeetCode in your browser <br />
            2. Open Developer Tools (F12) → Application → Cookies <br />
            3. Copy the value of LEETCODE_SESSION
          </p>
        </div>
      </div>
    </div>
  );
}
