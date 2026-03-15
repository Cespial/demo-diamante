"use client";

import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/5 p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("mb-3 text-sm font-semibold text-white/70", className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn("", className)}>{children}</div>;
}
