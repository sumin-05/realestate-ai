import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isValidStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

async function updateProfile(filterColumn, filterValue, fields) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${supabaseUrl}/rest/v1/profiles?${filterColumn}=eq.${filterValue}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(fields)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '환경변수 설정 없음' });
  }

  const payload = await readRawBody(req);

  if (!isValidStripeSignature(payload, req.headers['stripe-signature'], webhookSecret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(payload);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.client_reference_id) {
        await updateProfile('id', session.client_reference_id, {
          plan: 'paid',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await updateProfile('stripe_subscription_id', subscription.id, { plan: 'free' });
    }

    res.status(200).json({ received: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
