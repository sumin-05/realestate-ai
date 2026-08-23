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

async function supaGet(path) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  const data = await res.json();
  const total = res.headers.get('content-range')?.split('/')[1];
  return { data, total: total ? parseInt(total, 10) : data.length };
}

export default async function handler(req, res) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return res.status(403).json({ error: '관리자만 접근 가능합니다' });
  }

  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const [allProfiles, freeProfiles, paidProfiles, allGenerations, monthGenerations] = await Promise.all([
      supaGet('profiles?select=id'),
      supaGet('profiles?select=id&plan=eq.free'),
      supaGet('profiles?select=id&plan=eq.paid'),
      supaGet('generations?select=id'),
      supaGet(`generations?select=id&created_at=gte.${monthStartIso}`)
    ]);

    const { data: paidList } = await supaGet('profiles?select=id,email,created_at&plan=eq.paid');

    const customerReports = await Promise.all(paidList.map(async (p) => {
      const { data: gens } = await supaGet(`generations?select=id&user_id=eq.${p.id}&created_at=gte.${monthStartIso}`);
      return {
        email: p.email,
        monthlyGenerations: gens.length,
        estimatedMinutesSaved: gens.length * 15
      };
    }));

    res.status(200).json({
      totalCustomers: allProfiles.total,
      freeCustomers: freeProfiles.total,
      paidCustomers: paidProfiles.total,
      totalGenerations: allGenerations.total,
      monthGenerations: monthGenerations.total,
      customerReports
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
