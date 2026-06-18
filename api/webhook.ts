import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-05-27.dahlia',
});

// IMPORTANT: Requires the Supabase Service Role Key to bypass RLS!
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://opyekegukjocooshatgq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// We need to disable Vercel's default body parser to get the raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read raw body
const getRawBody = (req: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', (chunk: any) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Retrieve the user ID and tier from the session metadata
    const userId = session.client_reference_id;
    let tier = session.metadata?.tier;

    // Map Payment Links to tiers
    if (!tier && session.payment_link) {
      const proPaymentLinks = [
        'plink_1TgkmxRqoflFtIgs4RKGWpTZ', // Pro Family Yearly
        'plink_1TgkrQRqoflFtIgsR41ojC0Z', // Pro Family Monthly
        'plink_1TdnpTRqoflFtIgsYMzZdO66', // Pro Single Monthly
        'plink_1TdnqyRqoflFtIgsILv0UTxc'  // Pro Single Lifetime
      ];
      if (proPaymentLinks.includes(session.payment_link as string)) {
        tier = 'Pro';
      }
    }

    if (userId && tier) {
      console.log(`Upgrading user ${userId} to ${tier}`);
      // Update Supabase profile
      const { error } = await supabase
        .from('profiles')
        .update({ tier: tier })
        .eq('id', userId);

      if (error) {
        console.error('Error updating Supabase profile:', error);
        return res.status(500).json({ error: 'Database update failed' });
      }
    } else {
        console.warn('Webhook received but missing userId or tier in metadata.');
    }
  }

  res.status(200).json({ received: true });
}
