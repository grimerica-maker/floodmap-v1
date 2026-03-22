// app/api/verify-purchase/route.js
// Verifies a Stripe checkout session and upgrades the user to Pro
// Called by the map page after redirect from Stripe payment link

import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// The Stripe price ID for the $18.99 one-time Pro product
// Set this in your .env.local after creating the product in Stripe
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return Response.json({ success: false, error: "No session_id provided" }, { status: 400 });
  }

  try {
    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    // Must be a completed payment
    if (session.payment_status !== "paid") {
      return Response.json({ success: false, error: "Payment not completed" }, { status: 402 });
    }

    // Optional: verify it's the right product
    // const priceId = session.line_items?.data?.[0]?.price?.id;
    // if (PRO_PRICE_ID && priceId !== PRO_PRICE_ID) {
    //   return Response.json({ success: false, error: "Wrong product" }, { status: 400 });
    // }

    // If user is signed in, write pro to their Clerk metadata for cross-device access
    try {
      const { userId } = await auth();
      if (userId) {
        const clerk = await clerkClient();
        await clerk.users.updateUser(userId, {
          publicMetadata: { tier: "pro" },
        });
      }
    } catch (clerkErr) {
      // Not signed in — that's fine, localStorage handles it
      console.log("[verify-purchase] Clerk update skipped:", clerkErr.message);
    }

    return Response.json({ success: true, tier: "pro" });

  } catch (err) {
    console.error("[verify-purchase] Stripe error:", err.message);
    return Response.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
