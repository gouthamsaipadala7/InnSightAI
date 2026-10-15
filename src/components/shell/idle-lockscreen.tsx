"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_LOCK_MINUTES ?? "3") * 60_000;

export function IdleLockscreen({ hotelName }: { hotelName: string }) {
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLocked(true), IDLE_MS);
    }
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Incorrect password.");
        return;
      }
      setLocked(false);
      setPassword("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setChecking(false);
    }
  }

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-graphite-950/50 backdrop-blur-md transition-opacity duration-300 animate-in fade-in">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-white/20 bg-white/80 p-8 text-center shadow-soft-lg backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="size-6 text-emerald-hover" />
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 text-sm text-graphite-500">
            <Building2 className="size-4" />
            {hotelName}
          </div>
          <p className="mt-1 text-base font-semibold text-graphite-900">Session locked</p>
          <p className="mt-1 text-sm text-graphite-500">Enter your password to continue</p>
        </div>
        <form onSubmit={handleUnlock} className="flex w-full flex-col gap-3">
          <PasswordInput
            autoFocus
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={checking} className="w-full">
            {checking ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}