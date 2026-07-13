import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LoadingLabel } from "../components/LoadingLabel";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5"
      style={{ paddingTop: "2rem", paddingBottom: "3rem" }}
    >
      {/* Logo */}
      <div className="fade-up mb-9">
        <div
          className="mb-5 inline-flex items-center justify-center rounded-xl px-4 py-2"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>
            Your Accountant
          </span>
        </div>
        <h1
          style={{
            fontSize: "1.85rem",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            color: "var(--color-paper)",
            marginBottom: "0.45rem",
          }}
        >
          Welcome back
        </h1>
        <p style={{ fontSize: "0.9rem", color: "var(--color-mist)" }}>
          Sign in to your account
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="fade-up fade-up-delay-1 space-y-3"
        aria-busy={loading}
        inert={loading ? true : undefined}
      >
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          autoComplete="current-password"
          required
        />

        {error && (
          <p
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              color: "var(--color-red)",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.18)",
            }}
          >
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <LoadingLabel>Signing in…</LoadingLabel> : "Sign in"}
        </button>
      </form>

      <p
        className="fade-up fade-up-delay-2 mt-5 text-center text-sm"
        style={{ color: "var(--color-mist)" }}
      >
        No account?{" "}
        <Link
          to="/signup"
          style={{ color: "var(--color-sage-bright)", fontWeight: 500 }}
          className="hover:underline"
        >
          Sign up free
        </Link>
      </p>
    </div>
  );
}
