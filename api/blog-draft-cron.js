function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchGoogleNewsHeadlines(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const response = await fetch(url);
  const xml = await response.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .slice(0, 8)
    .map(m => {
      const block = m[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
      return {
        title: decodeEntities(title),
        link: decodeEntities(link),
        pubDate,
        source: decodeEntities(source)
      };
    });
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers['authorization'] !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const headlines = await fetchGoogleNewsHeadlines('부동산 시장 트렌드');
    if (headlines.length === 0) {
      return res.status(200).json({ skipped: true, reason: '헤드라인을 찾지 못함' });
    }

    const headlineList = headlines.map((h, i) => `${i + 1}. ${h.title} (${h.source})`).join('\n');

    const prompt = `당신은 부동산 전문 블로거입니다. 아래는 이번 주 부동산 관련 최신 뉴스 헤드라인입니다.

[이번 주 부동산 뉴스 헤드라인]
${headlineList}

이 헤드라인들의 주제와 흐름을 참고해서, 공인중개사와 부동산 실수요자를 대상으로 한 네이버 블로그용 주간 부동산 트렌드 포스팅을 작성하세요.
특정 기사를 그대로 인용하거나 베끼지 말고, 전반적인 흐름과 인사이트를 자연스럽게 녹여 직접 작성하세요.
반드시 ###태그### 형식을 정확히 지키세요.

###블로그제목###
(SEO 최적화된 제목, 40자 이내)
###끝###

###블로그본문###
[이번 주 부동산 시장 한눈에 보기]
(도입부, 이번 주 부동산 시장 전반 요약 2~3문장)

[주요 이슈 정리]
(헤드라인들에서 드러나는 2~3가지 핵심 트렌드를 소제목과 함께 각각 200자 이상 설명)

[공인중개사가 알아두면 좋은 포인트]
(이 트렌드가 중개 실무에 어떤 의미인지 3가지)

[마무리]
자연스러운 마무리

[해시태그]
#관련키워드 15개 이상
###끝###`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: '당신은 부동산 전문 블로거입니다. 반드시 지정된 출력 형식을 정확히 따라야 합니다. ###태그명### 형식을 절대 바꾸지 마세요.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      return res.status(500).json({ error: aiData.error?.message || 'OpenAI 오류' });
    }

    const text = aiData.choices[0].message.content;
    const titleMatch = text.match(/###블로그제목###([\s\S]*?)###끝###/);
    const bodyMatch = text.match(/###블로그본문###([\s\S]*?)###끝###/);
    const title = titleMatch ? titleMatch[1].trim() : '이번 주 부동산 트렌드';
    const content = bodyMatch ? bodyMatch[1].trim() : text;

    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/blog_drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ title, content, source_headlines: headlines })
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return res.status(500).json({ error: 'Supabase 저장 실패: ' + errText });
    }

    res.status(200).json({ success: true, title });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
