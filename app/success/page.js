"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const [tier, setTier] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = searchParams.get("tier") || "pro";
    const validTier = ["pro", "ultra"].includes(t) ? t : "pro";
    setTier(validTier);
    try { localStorage.setItem("dm_pro_tier", validTier); } catch {}
    let count = 5;
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) { clearInterval(interval); router.push("/"); }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isUltra = tier === "ultra";
  const tierConfirmed = user?.publicMetadata?.tier === tier;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", padding: 20 }}>
      <div style={{ background: "#111827", border: `1px solid ${isUltra ? "#4c1d95" : "#1e3a5f"}`, borderRadius: 20, padding: "40px 36px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>

        <div style={{ width: 72, height: 72, borderRadius: "50%", background: isUltra ? "#4c1d95" : "#1e3a5f", border: `3px solid ${isUltra ? "#7c3aed" : "#3b82f6"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>✓</div>

        <div style={{ color: "#f97316", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", marginBottom: 8 }}>PAYMENT SUCCESSFUL</div>
        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 26, marginBottom: 8 }}>Welcome to {isUltra ? "Ultra" : "Pro"}</div>
        <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          {isUltra ? "Unlimited simulations, satellite & globe view, embeddable maps, and feature request priority." : "50 simulations/hour, satellite & globe view, flood displaced counts, and no ads."}
        </div>

        <div style={{ background: "#0a0f1e", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13 }}>
          {isSignedIn
            ? tierConfirmed
              ? <span style={{ color: "#4ade80" }}>✓ Account upgraded — works on all your devices</span>
              : <span style={{ color: "#94a3b8" }}>⏳ Syncing to your account...</span>
            : <span style={{ color: "#f97316" }}>💡 Sign up to access Pro on all your devices</span>
          }
        </div>

        <div style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>Returning to Disaster Map in {countdown}s...</div>

        <button onClick={() => router.push("/")} style={{ width: "100%", padding: "13px", background: isUltra ? "#7c3aed" : "#f97316", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Go to Disaster Map →
        </button>

        <div style={{ color: "#334155", fontSize: 11, marginTop: 16 }}>Manage your subscription at stripe.com/billing</div>
      </div>
    </div>
  );
}
