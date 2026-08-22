const FOLLOWUP_DAYS = [3, 7, 14];

async function fetchFreeProfiles() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/profiles?plan=eq.free&select=id,email,created_at,followups_sent`;
  const response = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  return response.json();
}

async function markFollowupSent(id, followupsSent, day) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ followups_sent: [...followupsSent, day] })
  });
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers['authorization'] !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'MAKE_WEBHOOK_URL 환경변수 없음' });
  }

  try {
    const profiles = await fetchFreeProfiles();
    let sentCount = 0;

    for (const profile of profiles) {
      const daysSince = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
      const followupsSent = profile.followups_sent || [];

      if (FOLLOWUP_DAYS.includes(daysSince) && !followupsSent.includes(daysSince)) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'trial_followup',
            followupDay: daysSince,
            email: profile.email,
            signupDate: profile.created_at
          })
        });
        await markFollowupSent(profile.id, followupsSent, daysSince);
        sentCount++;
      }
    }

    res.status(200).json({ success: true, checked: profiles.length, sent: sentCount });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
