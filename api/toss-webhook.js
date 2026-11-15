import crypto from 'crypto';

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function updateProfile(filterColumn, filterValue, fields) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?${filterColumn}=eq.${filterValue}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(fields)
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '환경변수 설정 없음' });
  }

  const payload = await readRawBody(req);
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // 토스 웹훅 서명 검증 (선택: TOSS_WEBHOOK_SECRET 설정 시 활성화)
  const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers['x-toss-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature' });
    const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('base64');
    if (expected !== signature) return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const { eventType, data } = event;

    // 정기결제 성공
    if (eventType === 'PAYMENT_STATUS_CHANGED' && data?.status === 'DONE') {
      const customerKey = data.customerKey;
      if (customerKey) {
        await updateProfile('id', customerKey, { plan: 'paid' });
      }
    }

    // 정기결제 취소/실패 → free 로 다운그레이드
    if (eventType === 'PAYMENT_STATUS_CHANGED' &&
        (data?.status === 'CANCELED' || data?.status === 'ABORTED')) {
      const customerKey = data.customerKey;
      if (customerKey) {
        await updateProfile('id', customerKey, { plan: 'free' });
      }
    }

    res.status(200).json({ received: true });

  } catch (err) {
    console.error('토스 웹훅 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
}
