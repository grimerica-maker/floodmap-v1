import { NextResponse } from "next/server";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Map Stripe price IDs to tiers — update with your real price IDs
const PRICE_TO_TIER = {
  // Pro — $4.99/mo
  "price_pro_monthly": "pro",
  // Ultra — $8.88/mo  
  "price_ultra_monthly": "ultra",
};

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] Event:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;
      const customerId = session.customer;

      // Get the subscription to find the price
      let tier = "pro"; // default
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = sub.items.data[0]?.price?.id;
        tier = PRICE_TO_TIER[priceId] || "pro";
      }

      // Find user in Clerk by email
      if (customerEmail) {
        const users = await clerkClient.users.getUserList({ emailAddress: [customerEmail] });
        if (users.data?.length > 0) {
          const user = users.data[0];
          await clerkClient.users.updateUserMetadata(user.id, {
            publicMetadata: {
              tier,
              stripeCustomerId: customerId,
              subscribedAt: new Date().toISOString(),
            },
          });
          console.log(`[webhook] Set tier=${tier} for user ${user.id} (${customerEmail})`);
        } else {
          // User not signed up to Clerk yet — store against email for when they do
          console.log(`[webhook] No Clerk user found for ${customerEmail} — will apply on first sign-in`);
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Find user by Stripe customer ID in metadata
      const users = await clerkClient.users.getUserList();
      const user = users.data?.find(u => u.publicMetadata?.stripeCustomerId === customerId);
      if (user) {
        await clerkClient.users.updateUserMetadata(user.id, {
          publicMetadata: { tier: "free", stripeCustomerId: customerId },
        });
        console.log(`[webhook] Downgraded user ${user.id} to free (subscription cancelled)`);
      }
    }
  } catch (err) {
    console.error("[webhook] Error processing event:", err);
  }

  return NextResponse.json({ received: true });
}
