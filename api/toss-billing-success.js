export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authKey, customerKey, userId, amount, planName } = req.query;
  if (!authKey || !customerKey) {
    return res.redirect('/?checkout=cancel');
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // 1. 빌링키 발급
    const billingRes = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ authKey, customerKey })
    });

    const billing = await billingRes.json();
    if (!billingRes.ok) throw new Error(billing.message || '빌링키 발급 실패');

    const billingKey = billing.billingKey;
    const orderId = `order_${userId.replace(/-/g, '').slice(0, 16)}_${Date.now()}`;

    // 2. 즉시 첫 결제 실행
    const payRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerKey,
        amount: parseInt(amount),
        orderId,
        orderName: `매물AI ${planName || '프로'} 월정액`,
        customerEmail: req.query.userEmail || ''
      })
    });

    const pay = await payRes.json();
    if (!payRes.ok) throw new Error(pay.message || '결제 실패');

    // 3. Supabase profiles 업데이트
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        plan: 'paid',
        toss_billing_key: billingKey,
        toss_customer_key: customerKey
      })
    });

    res.redirect('/?checkout=success');

  } catch (err) {
    console.error('토스 빌링 오류:', err.message);
    res.redirect('/?checkout=cancel');
  }
}
