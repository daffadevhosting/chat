import DOMPurify from "dompurify";
import { marked } from "marked";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowDown,
  Check,
  Copy,
  History,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthControls, useAuth } from "../components/AuthControls";
import { useGlobalConfirm } from "../components/GlobalConfirm";
import { BorderBeam } from "@/registry/magicui/border-beam";
import { ShineBorder } from "@/registry/magicui/shine-border";
import { ShimmerButton } from "@/registry/magicui/shimmer-button";
import { API_BASE, readJson } from "../lib/api";

type ChatMode = "chat" | "analyze-repo" | "generate-code" | "fix-error";
type Role = "user" | "assistant";
type ChatMessage = {
  role: Role;
  content: string;
  isFeedbackResponse?: boolean;
  feedbackType?: "like" | "dislike";
  feedbackSubmitted?: boolean;
};
type ChatThread = {
  id: string;
  title: string;
  mode: ChatMode;
  model: string;
  messages: ChatMessage[];
};
type FeedbackModal = {
  type: "like" | "dislike";
  threadId: string;
  messageIndex: number;
} | null;

const defaultModel = "@cf/meta/llama-3.2-3b-instruct";
const modeLabels: Record<ChatMode, string> = {
  chat: "Chat",
  "analyze-repo": "Analyze Repo",
  "generate-code": "Generate Code",
  "fix-error": "Fix Error",
};
const modeDescriptions: Record<ChatMode, string> = {
  chat: "Tanya apa saja dan lanjutkan percakapan.",
  "analyze-repo": "Dapatkan analisis mendalam dari repository GitHub.",
  "generate-code": "Ubah kebutuhan produk menjadi kode siap pakai.",
  "fix-error": "Cari akar masalah dan perbaiki potongan kode.",
};
const models: Record<ChatMode, string> = {
  chat: defaultModel,
  "analyze-repo": "@cf/qwen/qwen2.5-coder-32b-instruct",
  "generate-code": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "fix-error": "@cf/qwen/qwen2.5-coder-32b-instruct",
};
const prompts: Record<ChatMode, string> = {
  chat: "Apa yang bisa saya bantu hari ini?",
  "analyze-repo": "Berikan URL repository Anda untuk dianalisis secara mendalam.\nContoh: https://github.com/owner/repo",
  "generate-code": "Tuliskan spesifikasi aplikasi atau modul yang ingin Anda buat kodenya.",
  "fix-error":
    "Gunakan format berikut untuk mulai memperbaiki masalah kode:\n\nCODE_START\n[kode Anda]\nCODE_END\n\nERROR_START\n[pesan error Anda]\nERROR_END",
};
const placeholders: Record<ChatMode, string> = {
  chat: "Tuliskan apa saja...",
  "analyze-repo": "Tempelkan tautan URL repositori di sini...",
  "generate-code": "Rincikan aplikasi yang ingin dibuat...",
  "fix-error": "Masukkan kode & error Anda sesuai format...",
};

function newThread(mode: ChatMode = "chat"): ChatThread {
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: `Obrolan Baru (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
    mode,
    model: models[mode],
    messages: [],
  };
}

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem("geminiChatHistory");
    if (!raw) return [newThread()];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Format riwayat chat tidak valid.");
    const chats = parsed.filter(
      (item): item is ChatThread =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "messages" in item &&
        Array.isArray(item.messages),
    );
    return chats.length ? chats : [newThread()];
  } catch (error) {
    console.error("Gagal membaca riwayat chat lokal:", error);
    return [newThread()];
  }
}

function titleCaseMode(mode: ChatMode) {
  return modeLabels[mode];
}

function modelLabel(model: string) {
  if (model.includes("llama")) return "Llama";
  if (model.includes("qwen")) return "Qwen";
  if (model.includes("deepseek")) return "Deepseek";
  return model.split("/").pop() || "AI";
}

export function ChatApp() {
  const { user, setUser } = useAuth();
  const confirm = useGlobalConfirm();
  const [initialState] = useState(() => {
    const chats = loadThreads();
    const storedId = localStorage.getItem("lastActiveChatId");
    return {
      threads: chats,
      activeId: chats.some((thread) => thread.id === storedId)
        ? storedId!
        : chats[chats.length - 1].id,
    };
  });
  const [threads, setThreads] = useState(initialState.threads);
  const [activeId, setActiveId] = useState(initialState.activeId);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [panel, setPanel] = useState<"history" | "mode" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackModal>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [responseRatings, setResponseRatings] = useState<Record<string, "like" | "dislike">>({});
  const mainRef = useRef<HTMLElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? threads[threads.length - 1],
    [activeId, threads],
  );
  const mode = activeThread?.mode ?? "chat";
  const model = activeThread?.model ?? defaultModel;

  useEffect(() => {
    localStorage.setItem("geminiChatHistory", JSON.stringify(threads));
    localStorage.setItem("lastActiveChatId", activeId);
  }, [threads, activeId]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!orbRef.current) return;
      gsap.to(orbRef.current, {
        scale: 1.08,
        rotate: 12,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, orbRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return;
    const updateScroll = () => setShowScrollTop(element.scrollTop > 300);
    element.addEventListener("scroll", updateScroll, { passive: true });
    return () => element.removeEventListener("scroll", updateScroll);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateThread = (id: string, update: (thread: ChatThread) => ChatThread) => {
    setThreads((current) => current.map((thread) => (thread.id === id ? update(thread) : thread)));
  };

  const startChat = (nextMode: ChatMode = mode) => {
    const thread = newThread(nextMode);
    setThreads((current) => [...current, thread]);
    setActiveId(thread.id);
    setInput("");
    setPanel(null);
    inputRef.current?.focus();
  };

  const addFeedbackPrompt = (type: "like" | "dislike", messageIndex: number) => {
    const key = `${activeId}-${messageIndex}`;
    if (responseRatings[key]) return;
    setResponseRatings((current) => ({ ...current, [key]: type }));
    const prompt =
      type === "like"
        ? "Terima kasih banyak atas dukungannya! Bolehkah saya meminta ulasan atau testimoni singkat?"
        : "Terima kasih atas masukannya. Apa yang bisa saya perbaiki dari jawaban ini?";
    updateThread(activeId, (thread) => ({
      ...thread,
      messages: [
        ...thread.messages,
        { role: "assistant", content: prompt, isFeedbackResponse: true, feedbackType: type },
      ],
    }));
    mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" });
  };

  const sendFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedback || !feedbackText.trim()) return;
    setFeedbackBusy(true);
    try {
      const response = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: feedback.type, feedback: feedbackText.trim() }),
      });
      const result = await readJson<{ success: boolean; error?: string }>(response);
      if (!result.success) throw new Error(result.error || "Gagal menyimpan umpan balik.");
      const thankYou =
        feedback.type === "like"
          ? "Terima kasih banyak atas testimoni dan penilaian baiknya! Dukungan Anda sangat berarti bagi kami dan memotivasi Gem Mini AI untuk terus memberikan pengalaman yang lebih baik."
          : "Terima kasih sudah menyampaikan kritik dan saran. Masukan Anda sangat berarti dan akan membantu kami memperbaiki Gem Mini AI.";
      updateThread(feedback.threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message, index) =>
          index === feedback.messageIndex && message.isFeedbackResponse
            ? { ...message, content: thankYou, feedbackSubmitted: true }
            : message,
        ),
      }));
      setToast("Umpan balik berhasil dikirim.");
      setFeedback(null);
      setFeedbackText("");
    } catch (error) {
      console.error("Gagal mengirim umpan balik:", error);
      setToast(error instanceof Error ? error.message : "Umpan balik gagal dikirim.");
    } finally {
      setFeedbackBusy(false);
    }
  };

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = input.trim();
    if (!message || pending || !activeThread) return;

    const threadId = activeThread.id;
    const nextMessages = [...activeThread.messages, { role: "user" as const, content: message }];
    updateThread(threadId, (thread) => ({ ...thread, messages: nextMessages }));
    setInput("");
    setPending(true);

    try {
      let endpoint: string;
      let body: Record<string, unknown>;
      switch (mode) {
        case "chat":
          endpoint = "/chat";
          body = { message, context: nextMessages, model };
          break;
        case "analyze-repo":
          endpoint = "/analyze-repo";
          body = { repoUrl: message, model };
          break;
        case "generate-code":
          endpoint = "/generate-code";
          body = { requirements: message, language: "javascript", model };
          break;
        case "fix-error": {
          const code = message.match(/CODE_START\n([\s\S]*?)\nCODE_END/);
          const error = message.match(/ERROR_START\n([\s\S]*?)\nERROR_END/);
          if (!code || !error) {
            throw new Error(
              "Sertakan kode dan pesan error dengan format CODE_START ... CODE_END dan ERROR_START ... ERROR_END.",
            );
          }
          endpoint = "/fix-error";
          body = { code: code[1], error: error[1], language: "javascript", model };
          break;
        }
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJson<Record<string, unknown> & { success: boolean; error?: string }>(response);
      if (!data.success) throw new Error(data.error || "Permintaan AI gagal.");

      let answer: string;
      if (mode === "chat") {
        answer = String(data.response ?? "");
      } else if (mode === "analyze-repo") {
        const repository = data.repository as { full_name?: string } | undefined;
        answer = `### Analisis Repository:\n**${repository?.full_name || "Tidak Diketahui"}**\n\n${String(data.analysis ?? "")}`;
      } else if (mode === "generate-code") {
        const fullResponse = String(data.code ?? data.response ?? "");
        const codeBlock = fullResponse.match(/```([a-zA-Z]+)?\n([\s\S]*?)\n```/);
        answer = codeBlock
          ? `Kode Berhasil Dihasilkan:\n\n\`\`\`${codeBlock[1] || String(data.language || "javascript")}\n${codeBlock[2]}\n\`\`\`\n\nDeskripsi & Analisis:\n${fullResponse.slice(codeBlock.index! + codeBlock[0].length).trim()}`
          : fullResponse || "Tidak ada output kode yang berhasil dihasilkan oleh model.";
      } else if (mode === "fix-error") {
        const language = String(data.language || "javascript");
        answer = `### Analisis Pembenahan Kode\n\n**Bahasa Pemrograman:** ${language}\n\n**Kode Sebelum Perbaikan:**\n\`\`\`${language}\n${String(data.original_code ?? "")}\n\`\`\`\n\n**Kode Setelah Diperbaiki:**\n\`\`\`${language}\n${String(data.fixed_code ?? "")}\n\`\`\`\n\n**Penjelasan Teknis:**\n${String(data.fixed_code_explanation ?? "")}\n\n**Langkah Pencegahan Kedepan:**\n${String(data.prevention_tips ?? "")}`;
      }
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: [...thread.messages, { role: "assistant", content: answer }],
      }));
    } catch (error) {
      console.error("Error sending message:", error);
      const errorText = `Kesalahan: ${error instanceof Error ? error.message : "Permintaan tidak berhasil."}`;
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: [...thread.messages, { role: "assistant", content: errorText }],
      }));
    } finally {
      setPending(false);
      requestAnimationFrame(() =>
        mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  };

  const deleteThread = async (id: string) => {
    const confirmed = await confirm({
      title: "Hapus obrolan?",
      message: "Riwayat percakapan ini akan dihapus permanen dari perangkat ini.",
      confirmText: "Hapus obrolan",
      destructive: true,
    });
    if (!confirmed) return;
    const remaining = threads.filter((thread) => thread.id !== id);
    const next = remaining.length ? remaining : [newThread()];
    setThreads(next);
    if (id === activeId) setActiveId(next[next.length - 1].id);
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToast("Jawaban disalin.");
    } catch (error) {
      console.error("Gagal menyalin jawaban:", error);
      setToast("Browser tidak mengizinkan penyalinan.");
    }
  };

  return (
    <div className="chat-shell">
      <header className="topbar">
        <div className="topbar-start">
          <button className="icon-button" onClick={() => setPanel("history")} aria-label="Riwayat chat">
            <History size={19} />
          </button>
          <a className="brand" href="./">
            <span className="brand-mark"><Sparkles size={16} /></span>
            <span>GEM <strong>MINI</strong></span>
          </a>
          <span className="mode-indicator"><span className="status-dot" />{titleCaseMode(mode)}</span>
        </div>
        <div className="topbar-end">
          <AuthControls user={user} onUserChange={setUser} />
          <a className="button button-quiet usage-link" href="./usage/">
            <span className="usage-link-dot" /> Usage
          </a>
        </div>
      </header>

      <main className="chat-main" ref={mainRef}>
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <AnimatePresence mode="wait">
          {activeThread?.messages.length ? (
            <motion.section
              className="message-list"
              key={activeId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {activeThread.messages.map((message, index) => (
                <MessageBubble
                  key={`${activeId}-${index}`}
                  message={message}
                  rating={responseRatings[`${activeId}-${index}`]}
                  onRate={(type) => addFeedbackPrompt(type, index)}
                  onFeedback={() => {
                    setFeedback({
                      type: message.feedbackType || "like",
                      threadId: activeId,
                      messageIndex: index,
                    });
                    setFeedbackText("");
                  }}
                  onCopy={() => void copyMessage(message.content)}
                  onToast={setToast}
                />
              ))}
              {pending && (
                <motion.div className="assistant-message loading-message" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="assistant-avatar"><Sparkles size={16} /></span>
                  <span className="typing-dots"><i /><i /><i /></span>
                </motion.div>
              )}
            </motion.section>
          ) : (
            <motion.section
              className="welcome"
              key={`welcome-${activeId}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="welcome-orb-wrap">
                <div className="welcome-orb" ref={orbRef}><Sparkles size={30} /></div>
              </div>
              <span className="eyebrow"><span className="status-dot" /> ASISTEN AI UNTUK IDE BESAR</span>
              <h1>{mode === "chat" ? <>Apa yang ingin<br /><span>kamu ciptakan?</span></> : titleCaseMode(mode)}</h1>
              <p className="welcome-copy">{prompts[mode]}</p>
              <div className="suggestion-grid">
                {mode === "chat" ? (
                  <>
                    <button onClick={() => setInput("Bantu saya merancang struktur project yang skalabel.")}><span>01</span><strong>Rancang project</strong><small>Bangun fondasi yang siap tumbuh</small></button>
                    <button onClick={() => setInput("Jelaskan konsep machine learning dengan contoh sederhana.")}><span>02</span><strong>Pelajari konsep</strong><small>Uraian yang mudah dipahami</small></button>
                    <button onClick={() => setInput("Tinjau praktik terbaik untuk aplikasi web modern.")}><span>03</span><strong>Temukan insight</strong><small>Praktik terbaik untuk produkmu</small></button>
                  </>
                ) : (
                  <div className="mode-tip"><MessageCircle size={17} /><span>{modeDescriptions[mode]}</span></div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <button
        className={`scroll-top ${showScrollTop ? "is-visible" : ""}`}
        aria-label="Kembali ke atas"
        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowDown size={17} />
      </button>

      <footer className="composer-dock">
        <form className={`composer ${pending ? "is-pending" : ""}`} onSubmit={(event) => void sendMessage(event)}>
          <ShineBorder
            className={pending ? "shine-border-hidden" : ""}
            borderWidth={1}
            duration={12}
            shineColor={["rgba(74, 114, 211, .08)", "rgba(132, 168, 255, .95)", "rgba(74, 114, 211, .08)"]}
          />
          {pending && (
            <BorderBeam
              size={80}
              duration={2.4}
              colorFrom="#5386ff"
              colorTo="#c4d6ff"
              borderWidth={2}
            />
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholders[mode]}
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            aria-label="Pesan"
          />
          <div className="composer-footer">
            <div className="composer-tools">
              <button type="button" className="tool-pill" onClick={() => setPanel(panel === "mode" ? null : "mode")}>
                <Settings2 size={15} /> {titleCaseMode(mode)} <span className="chevron">⌄</span>
              </button>
              <button type="button" className="tool-pill model-pill" onClick={() => setInfoOpen(true)}>
                {modelLabel(model)} <span className="model-dot" />
              </button>
            </div>
            <div className="composer-end">
              <span className="keyboard-hint">↵ kirim · ⇧↵ baris baru</span>
              <ShimmerButton className="send-button" type="submit" disabled={!input.trim() || pending} aria-label="Kirim pesan">
                <Send size={17} />
              </ShimmerButton>
            </div>
          </div>
        </form>
        <p className="disclaimer">Gem Mini AI bisa melakukan kesalahan. Verifikasi informasi penting secara mandiri.</p>
      </footer>

      <AnimatePresence>
        {panel && (
          <>
            <motion.button className="panel-scrim" aria-label="Tutup panel" onClick={() => setPanel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside
              className={`side-panel ${panel === "history" ? "history-panel" : "mode-panel"}`}
              initial={{ x: panel === "history" ? -24 : 0, y: panel === "mode" ? 16 : 0, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={{ x: panel === "history" ? -18 : 0, y: panel === "mode" ? 12 : 0, opacity: 0 }}
            >
              <div className="panel-heading">
                <div><span className="eyebrow">{panel === "history" ? "RUANG KERJA" : "PREFERENSI"}</span><h2>{panel === "history" ? "Riwayat chat" : "Pilih mode"}</h2></div>
                <button className="icon-button" aria-label="Tutup" onClick={() => setPanel(null)}><X size={18} /></button>
              </div>
              {panel === "history" ? (
                <>
                  <ShimmerButton className="button-primary button-full new-chat" onClick={() => startChat()}><Plus size={17} /> Obrolan baru</ShimmerButton>
                  <div className="history-list">
                    {[...threads].reverse().map((thread) => (
                      <div className={`history-entry ${thread.id === activeId ? "active" : ""}`} key={thread.id}>
                        <button onClick={() => { setActiveId(thread.id); setPanel(null); }}><span className="history-icon"><MessageCircle size={15} /></span><span className="history-name">{thread.title}</span></button>
                        <button className="icon-button delete-thread" aria-label={`Hapus ${thread.title}`} onClick={() => deleteThread(thread.id)}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mode-options">
                  {(Object.keys(modeLabels) as ChatMode[]).map((option, index) => (
                    <button
                      className={`mode-option ${option === mode ? "selected" : ""}`}
                      key={option}
                      onClick={() => {
                        if (option !== mode) startChat(option);
                        else setPanel(null);
                      }}
                    >
                      <span className="mode-option-index">0{index + 1}</span>
                      <span><strong>{modeLabels[option]}</strong><small>{modeDescriptions[option]}</small></span>
                      {option === mode && <Check size={17} />}
                    </button>
                  ))}
                </div>
              )}
              <div className="panel-footnote">Setiap mode memilih model yang paling sesuai secara otomatis.</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(feedback || infoOpen) && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
            if (event.target === event.currentTarget) { setFeedback(null); setInfoOpen(false); }
          }}>
            <motion.section className="modal-card" role="dialog" aria-modal="true" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
              <button className="icon-button modal-close" aria-label="Tutup" onClick={() => { setFeedback(null); setInfoOpen(false); }}><X size={18} /></button>
              {feedback ? (
                <>
                  <div className="modal-icon"><MessageCircle size={20} /></div>
                  <h2>{feedback.type === "like" ? "Bagikan testimoni" : "Bantu kami berkembang"}</h2>
                  <p className="muted">Umpan balik Anda membantu membuat Gem Mini AI lebih baik.</p>
                  <form className="auth-form" onSubmit={(event) => void sendFeedback(event)}>
                    <label>Umpan balik<textarea className="feedback-input" value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} required placeholder="Ceritakan pengalaman Anda..." /></label>
                    <ShimmerButton className="button-primary button-full" type="submit" disabled={feedbackBusy}>{feedbackBusy ? "Mengirim..." : "Kirim umpan balik"}</ShimmerButton>
                  </form>
                </>
              ) : (
                <>
                  <div className="modal-icon"><Sparkles size={20} /></div>
                  <h2>Model yang dioptimalkan</h2>
                  <p className="muted">Mode <strong>{titleCaseMode(mode)}</strong> menggunakan <strong>{modelLabel(model)}</strong>. Model dipilih otomatis untuk hasil yang paling relevan.</p>
                </>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

function MessageBubble({
  message,
  rating,
  onRate,
  onFeedback,
  onCopy,
  onToast,
}: {
  message: ChatMessage;
  rating?: "like" | "dislike";
  onRate: (type: "like" | "dislike") => void;
  onFeedback: () => void;
  onCopy: () => void;
  onToast: (message: string) => void;
}) {
  if (message.role === "user") {
    return <motion.div className="user-message" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{message.content}</motion.div>;
  }
  const html = DOMPurify.sanitize(marked.parse(message.content) as string);
  return (
    <motion.article className="assistant-message" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <span className="assistant-avatar"><Sparkles size={16} /></span>
      <div className="assistant-content">
        <div className="assistant-label">GEM MINI <span>AI</span></div>
        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        {message.isFeedbackResponse && !message.feedbackSubmitted && (
          <button className="feedback-trigger" onClick={onFeedback}><MessageCircle size={15} /> Berikan {message.feedbackType === "like" ? "testimoni" : "kritik & saran"}</button>
        )}
        {!message.isFeedbackResponse && (
          <div className="message-actions">
            <button className={rating === "like" ? "rated" : ""} title="Suka" aria-label="Suka" onClick={() => onRate("like")}><ThumbsUp size={15} /></button>
            <button className={rating === "dislike" ? "rated" : ""} title="Tidak suka" aria-label="Tidak suka" onClick={() => onRate("dislike")}><ThumbsDown size={15} /></button>
            <button title="Salin jawaban" aria-label="Salin jawaban" onClick={onCopy}><Copy size={15} /></button>
            <button title="Bacakan jawaban" aria-label="Bacakan jawaban" onClick={() => {
              if (!("speechSynthesis" in window)) { onToast("Fitur suara tidak tersedia di browser ini."); return; }
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(new SpeechSynthesisUtterance(message.content));
            }}><Volume2 size={15} /></button>
            <button title="Lainnya" aria-label="Lainnya" onClick={() => onToast("Jawaban dibuat oleh Gem Mini AI.")}><MoreHorizontal size={15} /></button>
          </div>
        )}
        <p className="message-disclaimer">AI dapat membuat kesalahan. Periksa kembali informasi penting.</p>
      </div>
    </motion.article>
  );
}
