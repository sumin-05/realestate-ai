const KEYWORDS = ['매물 설명문', '매물 설명 작성', '부동산 매물 올리기', '공인중개사 블로그'];

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '');
}

async function searchCafe(keyword) {
  const url = `https://naverapihub.apigw.ntruss.com/search/v1/cafearticle?query=${encodeURIComponent(keyword)}&display=10`;
  const response = await fetch(url, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
      'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET
    }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

async function insertNewMentions(rows) {
  if (rows.length === 0) return [];
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/cafe_mentions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'resolution=ignore-duplicates,return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) return [];
  return response.json();
}

export async function runCafeMonitor() {
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return { skipped: true, reason: 'NAVER 키 없음' };
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  let checked = 0;
  let newMentions = 0;

  for (const keyword of KEYWORDS) {
    const items = await searchCafe(keyword);
    checked += items.length;
    if (items.length === 0) continue;

    const rows = items.map(item => ({
      article_link: item.link,
      keyword,
      title: stripHtml(item.title),
      cafe_name: item.cafename
    }));

    const inserted = await insertNewMentions(rows);
    newMentions += inserted.length;

    if (webhookUrl) {
      for (const row of inserted) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'cafe_mention',
            keyword: row.keyword,
            title: row.title,
            cafeName: row.cafe_name,
            link: row.article_link
          })
        });
      }
    }
  }

  return { checked, newMentions };
}
