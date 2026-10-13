import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export interface ShimmerButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ children, className = "", type = "button", ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`shimmer-button ${className}`}
    >
      <span className="shimmer-button-content">{children}</span>
    </button>
  ),
);

ShimmerButton.displayName = "ShimmerButton";
