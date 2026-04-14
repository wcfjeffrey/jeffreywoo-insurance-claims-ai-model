import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("customer@jwinsurance.test");
  const [password, setPassword] = useState("Password123");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // Store language preference in localStorage
    localStorage.setItem("i18nextLng", lng);
  };

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t("login.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "440px",
        overflow: "hidden"
      }}>
        {/* Header with logo area */}
        <div style={{
          background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
          padding: "32px",
          textAlign: "center",
          color: "white"
        }}>
          {/* Language Switcher */}
          <div style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            display: "flex",
            gap: "8px"
          }}>
            <button
              onClick={() => changeLanguage("en")}
              style={{
                padding: "4px 12px",
                background: i18n.language === "en" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = i18n.language === "en" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)";
              }}
            >
              English
            </button>
            <button
              onClick={() => changeLanguage("zh")}
              style={{
                padding: "4px 12px",
                background: i18n.language === "zh" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = i18n.language === "zh" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)";
              }}
            >
              中文
            </button>
          </div>

          <div style={{
            width: "64px",
            height: "64px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            fontSize: "32px"
          }}>
            🏦
          </div>
          <h1 style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "600",
            letterSpacing: "-0.5px"
          }}>
          <span style={{ color: "#ffd700" }}>JeffreyWoo</span>{" "}
          <span style={{ color: "#00ff00" }}>{t("app.title")}</span>
          </h1>
          <p style={{
            margin: "8px 0 0 0",
            fontSize: "13px",
            opacity: 0.9
          }}>
            {t("app.tagline")}
          </p>
        </div>

        {/* Login Form */}
        <div style={{ padding: "32px" }}>
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {t("login.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "14px",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxSizing: "border-box"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#ddd";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {t("login.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "14px",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxSizing: "border-box"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#ddd";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {err && (
              <div style={{
                marginBottom: "20px",
                padding: "12px 14px",
                background: "#ffebee",
                borderLeft: "4px solid #c62828",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#c62828",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <span>⚠️</span> {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: busy ? "#ccc" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: busy ? "not-allowed" : "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                marginBottom: "20px"
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!busy) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {busy ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span className="spinner"></span> {t("login.authenticating") || "Authenticating..."}
                </span>
              ) : (
                t("login.submit")
              )}
            </button>

            <div style={{
              padding: "16px",
              background: "#f8f9fa",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#666",
              textAlign: "center",
              border: "1px solid #e8e8e8"
            }}>
              <div style={{ fontWeight: "600", marginBottom: "8px", color: "#1a1a1a" }}>
                🔐 {t("login.demoCredentials")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div><strong>{t("login.customer")}:</strong> customer@jwinsurance.test / Password123</div>
                <div><strong>{t("login.claimOfficer")}:</strong> officer@jwinsurance.test / Password123</div>
                <div><strong>{t("login.accounting")}:</strong> accounting@jwinsurance.test / Password123</div>
                <div><strong>{t("login.manager")}:</strong> manager@jwinsurance.test / Password123</div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 32px",
          background: "#f8f9fa",
          borderTop: "1px solid #e8e8e8",
          fontSize: "11px",
          color: "#999",
          textAlign: "center"
        }}>
          <span>🔒 {t("login.secureSsl")}</span> | 
          <span> 📋 {t("login.gdprCompliant")}</span> | 
          <span> 🏦 {t("login.soc2")}</span>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}