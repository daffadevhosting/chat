import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AuthControls, useAuth } from "../components/AuthControls";
import { MagicCard } from "@/registry/magicui/magic-card";
import { ShimmerButton } from "@/registry/magicui/shimmer-button";
import { API_BASE, readJson } from "../lib/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Filler);

const DEFAULT_LIMIT = 10000;
const REFRESH_INTERVAL = 15000;

interface RecentRequest {
  time: number | string;
  user?: string;
  neurons: number;
  id?: string;
}

interface FeedbackItem {
  id?: string;
  type: string;
  text: string;
  timestamp?: string;
}

interface TodayData {
  date?: string;
  neurons_today?: number;
  limit?: number;
  requests_today?: number;
  recent_requests?: RecentRequest[];
}

interface HistoryData {
  history?: Array<{ date: string; neurons: number }>;
}

interface FeedbackData {
  feedback?: FeedbackItem[];
}

interface DashboardData {
  today: TodayData;
  history: HistoryData;
  feedback: FeedbackData;
  isMock: boolean;
}

function mockToday(): TodayData {
  return {
    date: new Date().toISOString().slice(0, 10),
    neurons_today: Math.floor(Math.random() * 9000),
    limit: DEFAULT_LIMIT,
    requests_today: 30,
    recent_requests: [
      { time: Date.now(), user: "192.168.1.1", neurons: 150, id: "req-mock-1" },
      { time: Date.now() - 300000, user: "10.0.0.5", neurons: 240, id: "req-mock-2" },
    ],
  };
}

function mockHistory(): HistoryData {
  return {
    history: Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      return {
        date: date.toISOString().slice(0, 10),
        neurons: Math.floor(Math.random() * 8000) + 1000,
      };
    }),
  };
}

function mockFeedback(): FeedbackData {
  return {
    feedback: [
      { id: "fb-1", type: "like", text: "Sistem kodingannya mantap banget, cepat dan kodenya bersih!", timestamp: "6 Jun 2026, 08:30" },
      { id: "fb-2", type: "dislike", text: "Analisis repository GitHub kadang timeout jika foldernya terlalu besar.", timestamp: "6 Jun 2026, 11:15" },
      { id: "fb-3", type: "like", text: "Model Llama 3.2 responsif banget buat tanya jawab santai.", timestamp: "5 Jun 2026, 15:45" },
    ],
  };
}

async function fetchDashboard(base: string): Promise<DashboardData> {
  if (base === "mock") {
    return { today: mockToday(), history: mockHistory(), feedback: mockFeedback(), isMock: true };
  }

  const [todayResponse, historyResponse] = await Promise.all([
    fetch(`${base}/usage/today`, { cache: "no-store" }),
    fetch(`${base}/usage/history`, { cache: "no-store" }),
  ]);
  const [today, history] = await Promise.all([
    readJson<TodayData>(todayResponse),
    readJson<HistoryData>(historyResponse),
  ]);

  let feedback: FeedbackData = { feedback: [] };
  try {
    const feedbackResponse = await fetch(`${base}/feedback`, { cache: "no-store" });
    feedback = await readJson<FeedbackData>(feedbackResponse);
  } catch (error) {
    console.warn("Gagal memuat umpan balik:", error);
  }
  return { today, history, feedback, isMock: false };
}

function formatNumber(value: number) {
  return Math.max(0, value).toLocaleString("id-ID");
}

function AnimatedNumber({ value }: { value: number }) {
  const element = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const counter = { value: 0 };
    const tween = gsap.to(counter, {
      value,
      duration: 0.75,
      ease: "power2.out",
      onUpdate: () => {
        if (element.current) element.current.textContent = formatNumber(counter.value);
      },
    });
    return () => { tween.kill(); };
  }, [value]);
  return <span ref={element}>{formatNumber(value)}</span>;
}

export function UsageApp() {
  const { user, setUser } = useAuth();
  const [apiBase, setApiBase] = useState(API_BASE);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);
    try {
      const next = await fetchDashboard(apiBase);
      setData(next);
      setErrorMessage("");
    } catch (error) {
      console.error("Gagal memuat data penggunaan:", error);
      setData({ today: mockToday(), history: mockHistory(), feedback: mockFeedback(), isMock: true });
      setErrorMessage(
        error instanceof Error
          ? `API tidak dapat dimuat: ${error.message}. Data simulasi ditampilkan.`
          : "API tidak dapat dimuat. Data simulasi ditampilkan.",
      );
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const limit = Number(data?.today.limit || DEFAULT_LIMIT);
  const neurons = Number(data?.today.neurons_today || 0);
  const requests = Number(data?.today.requests_today || 0);
  const remaining = Math.max(limit - neurons, 0);
  const percentage = limit > 0 ? Math.min(100, (neurons / limit) * 100) : 0;
  const recentRequests = data?.today.recent_requests ?? [];
  const feedback = data?.feedback.feedback ?? [];

  const chartData = useMemo<ChartData<"bar">>(() => {
    const history = data?.history.history ?? [];
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        label: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        amount: Number(history.find((entry) => entry.date === key)?.neurons ?? 0),
      };
    });
    return {
      labels: days.map((day) => day.label),
      datasets: [{
        label: "Neurons",
        data: days.map((day) => day.amount),
        backgroundColor: "rgba(76, 131, 255, 0.28)",
        hoverBackgroundColor: "rgba(76, 131, 255, 0.62)",
        borderColor: "rgba(102, 151, 255, 0.72)",
        borderWidth: 1,
        borderRadius: 7,
        borderSkipped: false,
        barPercentage: 0.54,
        categoryPercentage: 0.72,
      }],
    };
  }, [data]);

  const chartOptions = useMemo<ChartOptions<"bar">>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#17191f",
        titleColor: "#a4a9b7",
        bodyColor: "#f6f7fb",
        borderColor: "rgba(255,255,255,.1)",
        borderWidth: 1,
        displayColors: false,
        padding: 12,
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: "#828796", font: { family: "Plus Jakarta Sans", size: 11 } },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: "rgba(255,255,255,.045)" },
        ticks: { color: "#828796", font: { family: "Plus Jakarta Sans", size: 11 }, maxTicksLimit: 5 },
      },
    },
  }), []);

  return (
    <div className="usage-page">
      <div className="usage-ambient" />
      <div className="usage-container">
        <motion.header className="usage-header" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="usage-heading">
            <a className="brand" href="../"><span className="brand-mark"><Sparkles size={16} /></span><span>GEM <strong>MINI</strong></span></a>
            <div>
              <span className="eyebrow"><span className="status-dot" /> LIVE OVERVIEW</span>
              <h1>Usage <span>dashboard</span></h1>
              <p>Pantau penggunaan dan aktivitas Gem Mini AI.</p>
            </div>
          </div>
          <div className="usage-actions">
            <AuthControls user={user} onUserChange={setUser} />
            <label className="api-select-label" aria-label="Pilih sumber data">
              <select value={apiBase} onChange={(event) => setApiBase(event.target.value)}>
                <option value={API_BASE}>Production API</option>
                <option value="mock">Simulasi (Mock)</option>
              </select>
            </label>
            <a className="button button-quiet" href="../"><ArrowLeft size={16} /> Chat</a>
            <ShimmerButton className="button-primary" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} size={16} /> Refresh
            </ShimmerButton>
          </div>
        </motion.header>

        <AnimatePresence>
          {errorMessage && (
            <motion.div className="dashboard-alert" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Activity size={17} /><span>{errorMessage}</span>
              <button className="text-button" onClick={() => setApiBase("mock")}>Pakai simulasi</button>
            </motion.div>
          )}
          {!errorMessage && data?.isMock && (
            <motion.div className="dashboard-alert alert-neutral" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Activity size={17} /><span>Mode simulasi aktif — angka di bawah bukan data produksi.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="stats-grid">
          <MetricCard index={0} label="Neurons hari ini" value={neurons} detail={`Diperbarui ${data?.today.date || "—"}`} icon={<Zap size={17} />} accent="blue">
            <div className="progress-track"><motion.div className={`progress-value ${percentage >= 95 ? "progress-danger" : ""}`} initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: .8, ease: "easeOut" }} /></div>
            <div className="metric-foot"><span>{percentage.toFixed(1)}% dari limit</span><span>{formatNumber(limit)} total</span></div>
          </MetricCard>
          <MetricCard index={1} label="Sisa neurons" value={remaining} detail="Reset setiap 24 jam" icon={<Sparkles size={17} />} accent="violet">
            <div className="metric-foot metric-foot-alone"><span><span className="status-dot" /> Tersedia untuk digunakan</span></div>
          </MetricCard>
          <MetricCard index={2} label="Permintaan hari ini" value={requests} detail="Volume request masuk" icon={<Activity size={17} />} accent="mint">
            <div className="metric-foot metric-foot-alone"><span><Clock3 size={13} /> Refresh otomatis tiap 15 detik</span></div>
          </MetricCard>

          <MagicCard className="dashboard-card chart-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}>
            <div className="card-heading">
              <div><span className="eyebrow">TREN 7 HARI</span><h2>Statistik penggunaan</h2><p>Neurons yang digunakan setiap hari</p></div>
              <span className={`usage-badge ${percentage >= 95 ? "badge-danger" : ""}`}><span className="status-dot" /> {Math.round(percentage)}% terpakai</span>
            </div>
            <div className="usage-chart">{loading ? <div className="loading-skeleton" /> : <Bar data={chartData} options={chartOptions} />}</div>
          </MagicCard>

          <MagicCard className="dashboard-card requests-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .28 }}>
            <div className="card-heading">
              <div><span className="eyebrow">AKTIVITAS</span><h2>Permintaan terakhir</h2><p>Request yang baru diproses</p></div>
              <span className="card-heading-icon"><ArrowUpRight size={17} /></span>
            </div>
            <div className="request-table-wrap">
              <table className="request-table">
                <thead><tr><th>Waktu</th><th>User / IP</th><th>Neurons</th><th>Request ID</th></tr></thead>
                <tbody>
                  {recentRequests.length ? recentRequests.slice(0, 50).map((item, index) => (
                    <tr key={item.id || `${item.time}-${index}`}>
                      <td>{new Date(item.time).toLocaleString("id-ID")}</td>
                      <td>{item.user || "unknown"}</td>
                      <td>{formatNumber(Number(item.neurons) || 0)}</td>
                      <td><code>{item.id || "—"}</code></td>
                    </tr>
                  )) : <tr><td className="empty-cell" colSpan={4}>{loading ? "Memuat aktivitas..." : "Belum ada permintaan."}</td></tr>}
                </tbody>
              </table>
            </div>
          </MagicCard>

          <MagicCard className="dashboard-card feedback-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .36 }}>
            <div className="card-heading">
              <div><span className="eyebrow">DARI KOMUNITAS</span><h2>Umpan balik pengguna</h2><p>Testimoni dan saran pengguna Gem Mini AI</p></div>
              <span className="card-heading-icon"><Sparkles size={17} /></span>
            </div>
            <div className="feedback-grid">
              {feedback.length ? feedback.slice(0, 6).map((item, index) => (
                <MagicCard className={`feedback-item ${item.type === "like" ? "feedback-like" : "feedback-dislike"}`} key={item.id || `${index}-${item.timestamp}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 + index * .04 }}>
                  <div className="feedback-meta"><span className={`feedback-tag ${item.type === "like" ? "" : "feedback-tag-negative"}`}>{item.type === "like" ? "Testimoni" : "Kritik / saran"}</span><time>{item.timestamp || "Baru saja"}</time></div>
                  <p>“{item.text}”</p>
                </MagicCard>
              )) : <p className="empty-feedback">{loading ? "Mengambil data umpan balik..." : "Belum ada umpan balik yang masuk."}</p>}
            </div>
          </MagicCard>
        </div>
        <footer className="usage-footer"><span><span className="status-dot" /> AUTO-REFRESH AKTIF</span><span>Gem Mini AI · Neurons monitor</span></footer>
      </div>
    </div>
  );
}

function MetricCard({
  index,
  label,
  value,
  detail,
  icon,
  accent,
  children,
}: {
  index: number;
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
}) {
  return (
    <MagicCard className={`dashboard-card metric-card metric-${accent}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}>
      <div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-dots">•••</span></div>
      <p className="metric-label">{label}</p>
      <div className="metric-value"><AnimatedNumber value={value} /></div>
      <p className="metric-detail">{detail}</p>
      {children}
    </MagicCard>
  );
}
