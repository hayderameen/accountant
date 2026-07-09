import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const secondaryLinks = [
  { to: "/accounts",    label: "Accounts" },
  { to: "/categories",  label: "Categories" },
  { to: "/loans",       label: "Loans" },
  { to: "/automations", label: "Automations" },
  { to: "/import",      label: "Import" },
  { to: "/settings",    label: "Settings" },
] as const;

function HomeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 21v-7h6v7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6h10M9 12h10M9 18h10M5 6v.01M5 12v.01M5 18v.01"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* Blue dot logo mark */
function LogoMark() {
  return (
    <div
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "rgba(10,132,255,0.15)",
        border: "1px solid rgba(10,132,255,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0.5px 0 rgba(255,255,255,0.08) inset",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#409cff", lineHeight: 1 }}>A</span>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  /* Glass surface style — reused for header + nav */
  const glassBar: React.CSSProperties = {
    background: "rgba(0,0,0,0.78)",
    backdropFilter: "blur(32px) saturate(200%)",
    WebkitBackdropFilter: "blur(32px) saturate(200%)",
  };

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col">

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 px-4 pt-3.5 pb-0"
        style={{
          ...glassBar,
          borderBottom: "0.5px solid rgba(84,84,88,0.5)",
        }}
      >
        {/* Brand row */}
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark />
            <div className="min-w-0">
              <p
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 660,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.1,
                  color: "#fff",
                }}
              >
                Accountant
              </p>
              <p
                className="truncate"
                style={{ fontSize: "0.7rem", color: "rgba(235,235,245,0.4)" }}
              >
                {user?.name || user?.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost shrink-0"
            style={{ padding: "5px 11px", fontSize: "0.77rem" }}
          >
            Logout
          </button>
        </div>

        {/* Secondary nav — scrollable chips */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-2.5"
          style={{ scrollbarWidth: "none" }}
        >
          {secondaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `chip ${isActive ? "chip-active" : "chip-idle"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main
        className="flex-1 px-4 py-5"
        style={{ paddingBottom: "5.5rem" }}
      >
        <Outlet />
      </main>

      {/* ── Bottom tab bar ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20"
        style={{
          ...glassBar,
          borderTop: "0.5px solid rgba(84,84,88,0.45)",
        }}
      >
        <div
          className="mx-auto grid max-w-lg grid-cols-3"
          style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
        >
          {/* Home */}
          <NavLink to="/" end className="flex flex-col items-center pt-2 pb-1">
            {({ isActive }) => (
              <div className="flex flex-col items-center gap-1">
                <span
                  style={{
                    display: "flex",
                    width: 32,
                    height: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    color: isActive ? "#409cff" : "rgba(235,235,245,0.35)",
                    background: isActive ? "rgba(10,132,255,0.14)" : "transparent",
                    transition: "color 130ms, background 130ms",
                  }}
                >
                  <HomeIcon />
                </span>
                <span
                  style={{
                    fontSize: "0.63rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: isActive ? "#409cff" : "rgba(235,235,245,0.35)",
                  }}
                >
                  Home
                </span>
              </div>
            )}
          </NavLink>

          {/* Add — prominent floating glass button */}
          <NavLink to="/add" className="flex flex-col items-center pt-1.5 pb-1">
            {({ isActive }) => (
              <div className="flex flex-col items-center gap-1">
                <span
                  style={{
                    display: "flex",
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    background: "#0a84ff",
                    border: "0.5px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.22) inset, 0 -1px 0 rgba(0,0,0,0.1) inset, 0 4px 16px rgba(10,132,255,0.35)",
                    opacity: isActive ? 0.85 : 1,
                    transition: "opacity 130ms",
                  }}
                >
                  <PlusIcon />
                </span>
                <span
                  style={{
                    fontSize: "0.63rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: isActive ? "#409cff" : "rgba(235,235,245,0.35)",
                  }}
                >
                  Add
                </span>
              </div>
            )}
          </NavLink>

          {/* Ledger */}
          <NavLink to="/transactions" className="flex flex-col items-center pt-2 pb-1">
            {({ isActive }) => (
              <div className="flex flex-col items-center gap-1">
                <span
                  style={{
                    display: "flex",
                    width: 32,
                    height: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    color: isActive ? "#409cff" : "rgba(235,235,245,0.35)",
                    background: isActive ? "rgba(10,132,255,0.14)" : "transparent",
                    transition: "color 130ms, background 130ms",
                  }}
                >
                  <LedgerIcon />
                </span>
                <span
                  style={{
                    fontSize: "0.63rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: isActive ? "#409cff" : "rgba(235,235,245,0.35)",
                  }}
                >
                  Ledger
                </span>
              </div>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
