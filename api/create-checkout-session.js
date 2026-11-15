export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { planName, amount, userId, userEmail } = req.body;
  if (!amount || !userId) {
    return res.status(400).json({ error: 'amount, userId가 필요합니다' });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'TOSS_SECRET_KEY 환경변수 없음' });
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const orderId = `order_${userId.replace(/-/g, '').slice(0, 16)}_${Date.now()}`;

  try {
    const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerKey: userId,
        successUrl: `${origin}/api/toss-billing-success?userId=${userId}&amount=${amount}&planName=${encodeURIComponent(planName || '프로')}`,
        failUrl: `${origin}/?checkout=cancel`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.message || '토스 오류' });
    }

    res.status(200).json({ url: data.checkoutPage });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
