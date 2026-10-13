import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import { LogIn, LogOut, UserRound, X } from "lucide-react";
import { MagicCard } from "@/registry/magicui/magic-card";
import { ShimmerButton } from "@/registry/magicui/shimmer-button";
import { API_BASE, type AuthUser, readJson } from "../lib/api";

type AuthResponse = {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
};

type ModalMode = "login" | "register" | null;

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    const controller = new AbortController();
    void fetch(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(readJson<{ success: boolean; user?: AuthUser }>)
      .then((result) => {
        if (result.success && result.user) setUser(result.user);
        else localStorage.removeItem("authToken");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Auth check failed:", error);
      });

    return () => controller.abort();
  }, []);

  return { user, setUser };
}

export function AuthControls({
  user,
  onUserChange,
}: {
  user: AuthUser | null;
  onUserChange: (user: AuthUser | null) => void;
}) {
  const [modal, setModal] = useState<ModalMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const close = () => {
    setModal(null);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const registering = modal === "register";
      const response = await fetch(
        `${API_BASE}/auth/${registering ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            registering ? { username, email, password } : { email, password },
          ),
        },
      );
      const result = await readJson<AuthResponse>(response);
      if (!result.success) throw new Error(result.error || "Autentikasi gagal.");

      if (registering) {
        setModal("login");
        setNotice("Registrasi berhasil. Silakan masuk.");
      } else if (result.token && result.user) {
        localStorage.setItem("authToken", result.token);
        onUserChange(result.user);
        setNotice("Login berhasil.");
        close();
      } else {
        throw new Error("Respons login tidak berisi data akun yang lengkap.");
      }
    } catch (requestError) {
      console.error("Authentication request failed:", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat autentikasi.",
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("authToken");
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (requestError) {
      console.error("Logout request failed:", requestError);
    } finally {
      localStorage.removeItem("authToken");
      onUserChange(null);
      setNotice("Anda telah keluar.");
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {user ? (
          <motion.div
            className="user-chip"
            key="user"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <img
              className="user-avatar"
              src={
                user.githubAvatar ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username || user.email || "guest")}`
              }
              alt=""
            />
            <span className="user-name">{user.username || user.email}</span>
            <button className="icon-button" aria-label="Logout" onClick={logout}>
              <LogOut size={16} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="login-button-motion"
            key="login"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <ShimmerButton
              className="button button-quiet"
              onClick={() => {
                setNotice("");
                setModal("login");
              }}
            >
              <LogIn size={16} />
              Masuk
            </ShimmerButton>
          </motion.div>
        )}
      </AnimatePresence>

      {notice && (
        <div className="visually-hidden" role="status">
          {notice}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <motion.div
              className="auth-card-frame"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
            >
              <MagicCard
                mode="orb"
                className="auth-magic-card"
                glowFrom="#5c8bff"
                glowTo="#8259ec"
                glowSize={360}
                glowBlur={68}
                glowOpacity={0.62}
              >
                <section
                  className="modal-card auth-modal-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="auth-title"
                >
                  <button className="icon-button modal-close" onClick={close} aria-label="Tutup">
                    <X size={18} />
                  </button>
                  <div className="auth-card-heading">
                    <div className="modal-icon"><UserRound size={20} /></div>
                    <div>
                      <span className="eyebrow">GEM MINI ACCOUNT</span>
                      <h2 id="auth-title">{modal === "login" ? "Selamat datang kembali" : "Buat akun"}</h2>
                    </div>
                  </div>
                  <p className="muted">Masuk untuk menyimpan pengalaman Gem Mini AI Anda.</p>
                  <form className="auth-form" onSubmit={submit}>
                    {modal === "register" && (
                      <label>
                        Username
                        <input
                          autoComplete="username"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          required
                        />
                      </label>
                    )}
                    <label>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        autoComplete={modal === "login" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </label>
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <ShimmerButton className="button-primary button-full" disabled={busy} type="submit">
                      {busy ? "Memproses..." : modal === "login" ? "Masuk" : "Daftar"}
                    </ShimmerButton>
                  </form>
                  <p className="auth-switch">
                    {modal === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                    <button
                      className="text-button"
                      onClick={() => {
                        setError("");
                        setModal(modal === "login" ? "register" : "login");
                      }}
                    >
                      {modal === "login" ? "Daftar di sini" : "Masuk"}
                    </button>
                  </p>
                </section>
              </MagicCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
