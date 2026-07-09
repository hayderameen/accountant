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

const primaryNav = [
  { to: "/",            label: "Home",   end: true,  icon: HomeIcon },
  { to: "/add",         label: "Add",    end: false, icon: PlusIcon, special: true },
  { to: "/transactions",label: "Ledger", end: false, icon: LedgerIcon },
] as const;

function HomeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path d="M9 21v-7h6v7" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LogoMark() {
  return (
    <div
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "rgba(99,102,241,0.15)",
        border: "1px solid rgba(99,102,241,0.3)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", lineHeight: 1 }}>A</span>
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

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col">
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 px-4 pt-3.5 pb-0"
        style={{
          background: "rgba(8,8,10,0.85)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
        }}
      >
        {/* Brand + logout */}
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoMark />
            <div className="min-w-0">
              <p
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 650,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.1,
                  color: "var(--color-paper)",
                }}
              >
                Accountant
              </p>
              <p className="truncate text-[0.72rem]" style={{ color: "var(--color-mist)" }}>
                {user?.name || user?.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 btn-ghost"
            style={{ padding: "5px 11px", fontSize: "0.78rem" }}
          >
            Logout
          </button>
        </div>

        {/* Secondary nav */}
        <div
          className="flex gap-1 overflow-x-auto pb-2.5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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

      {/* ── Page content ── */}
      <main className="flex-1 px-4 py-5" style={{ paddingBottom: "5.5rem" }}>
        <Outlet />
      </main>

      {/* ── Bottom tab bar ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20"
        style={{
          background: "rgba(8,8,10,0.9)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="mx-auto grid max-w-lg grid-cols-3"
          style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
        >
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex flex-col items-center pt-2 pb-1"
            >
              {({ isActive }) =>
                item.special ? (
                  /* ── Special Add button ── */
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-150"
                      style={
                        isActive
                          ? {
                              background: "linear-gradient(180deg, #6366f1, #4f46e5)",
                              boxShadow: "0 0 16px rgba(99,102,241,0.45)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              color: "#fff",
                            }
                          : {
                              background: "linear-gradient(180deg, #6366f1, #4f46e5)",
                              boxShadow: "0 0 10px rgba(99,102,241,0.3)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "#fff",
                            }
                      }
                    >
                      <item.icon />
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: isActive ? "#a5b4fc" : "var(--color-mist)",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                ) : (
                  /* ── Regular nav item ── */
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                      style={{
                        color: isActive ? "#818cf8" : "var(--color-mist)",
                        background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                      }}
                    >
                      <item.icon />
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: isActive ? "#818cf8" : "var(--color-mist)",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                )
              }
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
