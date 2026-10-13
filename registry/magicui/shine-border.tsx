import type { CSSProperties, HTMLAttributes } from "react";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | string[];
}

type ShineBorderStyle = CSSProperties & {
  "--shine-duration": string;
  "--shine-colors": string;
};

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "#7da2ff",
  className = "",
  style,
  ...props
}: ShineBorderProps) {
  const colors = Array.isArray(shineColor) ? shineColor.join(", ") : shineColor;

  return (
    <div
      aria-hidden="true"
      className={`shine-border ${className}`}
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--shine-duration": `${duration}s`,
          "--shine-colors": colors,
          ...style,
        } as ShineBorderStyle
      }
      {...props}
    />
  );
}
