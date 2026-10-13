import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from "framer-motion";
import { useCallback, type PointerEvent, type ReactNode } from "react";

interface MagicCardProps extends HTMLMotionProps<"div"> {
  children?: ReactNode;
  mode?: "gradient" | "orb";
  gradientSize?: number;
  gradientFrom?: string;
  gradientTo?: string;
  gradientColor?: string;
  gradientOpacity?: number;
  glowFrom?: string;
  glowTo?: string;
  glowSize?: number;
  glowBlur?: number;
  glowOpacity?: number;
}

export function MagicCard({
  children,
  className = "",
  mode = "gradient",
  style,
  gradientSize = 220,
  gradientFrom = "rgba(113, 151, 255, .38)",
  gradientTo = "rgba(113, 151, 255, .05)",
  gradientColor = "rgba(83, 126, 228, .12)",
  gradientOpacity = 1,
  glowFrom = "#ee4f27",
  glowTo = "#6b21ef",
  glowSize = 420,
  glowBlur = 60,
  glowOpacity = 0.85,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  ...props
}: MagicCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const rawX = useMotionValue(-gradientSize);
  const rawY = useMotionValue(-gradientSize);
  const x = useSpring(rawX, { stiffness: 250, damping: 30, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 250, damping: 30, mass: 0.6 });
  const orbOpacity = useSpring(0, { stiffness: 300, damping: 35 });
  const pointerGlow = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${x}px ${y}px, ${gradientColor}, transparent 100%)`;
  const spotlight = useMotionTemplate`linear-gradient(var(--magic-card-background) 0 0) padding-box, radial-gradient(${gradientSize}px circle at ${x}px ${y}px, ${gradientFrom}, ${gradientTo}, var(--magic-card-border) 100%) border-box`;

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);
      if (shouldReduceMotion || event.pointerType === "touch") return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      rawX.set(pointerX);
      rawY.set(pointerY);
      if (mode === "orb") {
        orbOpacity.set(glowOpacity);
      }
    },
    [glowOpacity, mode, onPointerMove, orbOpacity, rawX, rawY, shouldReduceMotion],
  );

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerEnter?.(event);
      if (mode === "orb" && !shouldReduceMotion && event.pointerType !== "touch") {
        orbOpacity.set(glowOpacity);
      }
    },
    [glowOpacity, mode, onPointerEnter, orbOpacity, shouldReduceMotion],
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      if (mode === "orb") orbOpacity.set(0);
    },
    [mode, onPointerLeave, orbOpacity],
  );

  return (
    <motion.div
      {...props}
      className={`magic-card ${mode === "orb" ? "magic-card-orb" : ""} ${className}`}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        ...style,
        background:
          mode === "orb" || shouldReduceMotion
            ? "var(--magic-card-background)"
            : spotlight,
        "--magic-card-glow": pointerGlow,
        "--magic-card-glow-opacity": gradientOpacity,
      } as HTMLMotionProps<"div">["style"]}
    >
      {mode === "orb" && (
        <motion.div
          aria-hidden="true"
          className="magic-card-orb-glow"
          style={{
            width: glowSize,
            height: glowSize,
            x,
            y,
            translateX: "-50%",
            translateY: "-50%",
            opacity: shouldReduceMotion ? 0 : orbOpacity,
            background: `linear-gradient(135deg, ${glowFrom}, ${glowTo})`,
            filter: `blur(${glowBlur}px)`,
          }}
        />
      )}
      <div className="magic-card-content">{children}</div>
    </motion.div>
  );
}
