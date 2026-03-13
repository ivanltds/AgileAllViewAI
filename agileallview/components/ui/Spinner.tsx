"use client";
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block rounded-full border-2 border-[var(--bg4)] border-t-[var(--accent)] animate-spin-slow"
    />
  );
}
