import {
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import type { CSSProperties } from "react";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  transition?: Transition;
  className?: string;
  style?: CSSProperties;
  reverse?: boolean;
  initialOffset?: number;
  borderWidth?: number;
}

export function BorderBeam({
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
  className = "",
}: BorderBeamProps) {
  const shouldReduceMotion = useReducedMotion();
  const start = reverse ? 100 - initialOffset : initialOffset;
  const end = reverse ? -initialOffset : 100 + initialOffset;

  return (
    <div
      aria-hidden="true"
      className="magicui-border-beam"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
          "--beam-from": colorFrom,
          "--beam-to": colorTo,
        } as CSSProperties
      }
    >
      <motion.div
        className={`magicui-border-beam-light ${className}`}
        style={
          {
            ...style,
            width: size,
            offsetPath: "inset(0 round var(--beam-radius, 16px))",
            offsetAnchor: "center",
            "--color-from": colorFrom,
            "--color-to": colorTo,
          } as CSSProperties
        }
        initial={{ offsetDistance: `${start}%` }}
        animate={{
          offsetDistance: shouldReduceMotion ? `${start}%` : [`${start}%`, `${end}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}
