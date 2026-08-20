async function verifyAdmin(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');

  const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user.id) return null;

  const profileRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_admin`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const profiles = await profileRes.json();
  if (!profiles[0] || !profiles[0].is_admin) return null;

  return user.id;
}

export default async function handler(req, res) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return res.status(403).json({ error: '관리자만 접근 가능합니다' });
  }

  if (req.method === 'GET') {
    const listRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/blog_drafts?select=*&order=created_at.desc`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const drafts = await listRes.json();
    return res.status(200).json({ drafts });
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'id, status가 필요합니다' });
    }
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/blog_drafts?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ status })
    });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
