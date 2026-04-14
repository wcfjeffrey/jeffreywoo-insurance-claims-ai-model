import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, type Role } from "../auth/AuthContext";

/** Must match `RoleRoute` paths in `App.tsx` — only show links the role can open. */
const navForRole = (role: Role): { to: string; key: string }[] => {
  const base = [
    { to: "/", key: "dashboard" },
    { to: "/claims", key: "claims" },
  ];
  if (role === "customer") {
    return [...base, { to: "/claims/new", key: "newClaim" }];
  }
  if (role === "claim_officer") {
    return [
      ...base,
      { to: "/ai", key: "ai" },
      { to: "/compliance", key: "compliance" },
      { to: "/reports", key: "reports" },
    ];
  }
  if (role === "accounting_staff") {
    return [
      ...base,
      { to: "/accounting", key: "accounting" },
      { to: "/ai", key: "ai" },
      { to: "/compliance", key: "compliance" },
      { to: "/reports", key: "reports" },
      { to: "/hkfrs17", key: "hkfrs17" },
      { to: "/hkfrs17-calculator", key: "hkfrs17Calculator" },
    ];
  }
  if (role === "manager") {
    return [
      ...base,
      { to: "/accounting", key: "accounting" },
      { to: "/ai", key: "ai" },
      { to: "/compliance", key: "compliance" },
      { to: "/reports", key: "reports" },
      { to: "/audit", key: "audit" },
      { to: "/hkfrs17", key: "hkfrs17" },
      { to: "/hkfrs17-calculator", key: "hkfrs17Calculator" },
    ];
  }
  return base;
};

// Helper function to get display label
const getDisplayLabel = (key: string, t: (key: string) => string): string => {
  if (key === "hkfrs17") {
    return "HKFRS 17 Compliance";
  }
  if (key === "hkfrs17Calculator") {
    return "HKFRS 17 CSM Calculator";
  }
  return t(`nav.${key}`);
};

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  if (!user) return <Outlet />;

  const items = navForRole(user.role);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>{t("app.title")}</strong>
          <span className="muted">{user.fullName}</span>
          <span className="badge">{user.role.replace("_", " ")}</span>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              end={item.to === "/"}
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="lang">
            <button
              type="button"
              className={i18n.language === "en" ? "on" : ""}
              onClick={() => {
                void i18n.changeLanguage("en");
                localStorage.setItem("jw_lang", "en");
              }}
            >
              EN
            </button>
            <button
              type="button"
              className={i18n.language === "zh" ? "on" : ""}
              onClick={() => {
                void i18n.changeLanguage("zh");
                localStorage.setItem("jw_lang", "zh");
              }}
            >
              中文
            </button>
          </div>
          <button type="button" className="linkish" onClick={logout}>
            {t("nav.logout")}
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}