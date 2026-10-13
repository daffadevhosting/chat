import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { ShimmerButton } from "@/registry/magicui/shimmer-button";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

type GlobalConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const GlobalConfirmContext = createContext<GlobalConfirmContextValue | null>(null);

export function GlobalConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<ConfirmRequest | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const current = requestRef.current;
    if (!current) return;
    requestRef.current = null;
    setRequest(null);
    current.resolve(confirmed);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (requestRef.current) {
      requestRef.current.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      const nextRequest = { ...options, resolve };
      requestRef.current = nextRequest;
      setRequest(nextRequest);
    });
  }, []);

  useEffect(() => {
    if (!request) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, settle]);

  return (
    <GlobalConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {request && (
          <motion.div
            className="modal-backdrop confirm-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) settle(false);
            }}
          >
            <motion.section
              className="modal-card confirm-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="global-confirm-title"
              aria-describedby="global-confirm-message"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
            >
              <button
                className="icon-button modal-close"
                aria-label="Tutup"
                onClick={() => settle(false)}
              >
                <X size={18} />
              </button>
              <div className={`modal-icon ${request.destructive ? "confirm-icon-danger" : ""}`}>
                <AlertTriangle size={20} />
              </div>
              <h2 id="global-confirm-title">{request.title}</h2>
              <p className="muted" id="global-confirm-message">{request.message}</p>
              <div className="confirm-actions">
                <ShimmerButton className="button button-quiet" onClick={() => settle(false)}>
                  {request.cancelText || "Batal"}
                </ShimmerButton>
                <ShimmerButton
                  ref={confirmButtonRef}
                  className={request.destructive ? "button-danger" : "button-primary"}
                  onClick={() => settle(true)}
                >
                  {request.confirmText || "Ya, lanjutkan"}
                </ShimmerButton>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </GlobalConfirmContext.Provider>
  );
}

export function useGlobalConfirm() {
  const context = useContext(GlobalConfirmContext);
  if (!context) {
    throw new Error("useGlobalConfirm harus digunakan di dalam GlobalConfirmProvider.");
  }
  return context.confirm;
}
