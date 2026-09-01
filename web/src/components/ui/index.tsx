import { type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`brutalist-card p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ variant = "default", children, size = "md" }: { variant?: "default" | "success" | "warning" | "danger" | "honey"; children: ReactNode; size?: "sm" | "md" | "lg" }) {
  const colors: Record<string, string> = {
    default: "bg-ink text-white",
    success: "bg-green-700 text-white",
    warning: "bg-honey text-ink",
    danger: "bg-red-700 text-white",
    honey: "bg-honey text-ink border-2 border-ink",
  };
  const sizes: Record<string, string> = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-3 py-1",
  };
  return (
    <span className={`font-mono font-black uppercase tracking-widest inline-block ${colors[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

export function Button({ variant = "primary", children, className = "", ...props }: { variant?: "primary" | "outline" | "honey"; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = variant === "outline"
    ? "brutalist-btn-outline"
    : variant === "honey"
      ? "brutalist-btn bg-honey text-ink hover:bg-ink hover:text-white"
      : "brutalist-btn";
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && (
        <span className="font-mono text-[11px] font-black uppercase tracking-widest block mb-1.5">
          {label}
        </span>
      )}
      <input className="brutalist-input w-full" {...props} />
    </label>
  );
}

export function StatBlock({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={`stat-block ${accent ? "bg-honey" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
