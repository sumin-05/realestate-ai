const PROMO_TOPICS = [
  '매물AI를 만들게 된 계기 - 공인중개사가 겪는 반복 업무(매물 설명문, 홍보 문구 작성) 문제를 소개하고 왜 AI로 해결하려 했는지 이야기',
  '매물AI 개발 과정 - 로그인/결제 기능부터 인스타그램 홍보 콘텐츠, 블로그 자동 발행, 영업 메시지 자동화까지 하나씩 만들어간 과정 소개',
  '매물AI로 할 수 있는 것들 - 매물 설명문 자동 생성, 인스타그램 콘텐츠, 블로그 자동 발행 등 실제 기능을 예시와 함께 소개',
  '매물AI 무료체험 안내 - 누가 써야 하는지, 어떻게 시작하는지, 무료 체험 5건 이후 요금제 안내',
  '매물AI 최신 소식 - 네이버 카페에서 매물 설명 때문에 고민하는 공인중개사를 자동으로 찾아내는 기능 등 최근에 추가된 기능 소개'
];

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

async function callOpenAI(systemPrompt, userPrompt) {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  const aiData = await aiResponse.json();
  if (!aiResponse.ok) {
    throw new Error(aiData.error?.message || 'OpenAI 오류');
  }
  return aiData.choices[0].message.content;
}

function parseTitleAndBody(text, fallbackTitle) {
  const titleMatch = text.match(/###블로그제목###([\s\S]*?)###끝###/);
  const bodyMatch = text.match(/###블로그본문###([\s\S]*?)###끝###/);
  return {
    title: titleMatch ? titleMatch[1].trim() : fallbackTitle,
    content: bodyMatch ? bodyMatch[1].trim() : text
  };
}

async function insertDraft({ title, content, category, source_headlines }) {
  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/blog_drafts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ title, content, category, source_headlines: source_headlines || null })
  });
  if (!insertRes.ok) {
    throw new Error('Supabase 저장 실패: ' + (await insertRes.text()));
  }
}

async function countPromoDrafts() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/blog_drafts?select=id&category=eq.promo`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  const total = res.headers.get('content-range')?.split('/')[1];
  return total ? parseInt(total, 10) : 0;
}

async function generateTrendDraft() {
  const headlines = await fetchGoogleNewsHeadlines('부동산 시장 트렌드');
  if (headlines.length === 0) {
    return { skipped: true, reason: '헤드라인을 찾지 못함' };
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

  const text = await callOpenAI(
    '당신은 부동산 전문 블로거입니다. 반드시 지정된 출력 형식을 정확히 따라야 합니다. ###태그명### 형식을 절대 바꾸지 마세요.',
    prompt
  );
  const { title, content } = parseTitleAndBody(text, '이번 주 부동산 트렌드');
  await insertDraft({ title, content, category: 'trend', source_headlines: headlines });
  return { title };
}

async function generatePromoDraft() {
  const promoCount = await countPromoDrafts();
  const topic = PROMO_TOPICS[promoCount % PROMO_TOPICS.length];

  const prompt = `당신은 '매물AI'라는 부동산 매물 설명문/홍보 자동 생성 서비스를 만든 1인 개발자입니다.
매물AI는 공인중개사가 매물 정보만 입력하면 네이버/블로그/카카오톡/인스타그램용 홍보 문구를 자동으로 만들어주는 서비스입니다.
아래 주제로 네이버 블로그/티스토리에 올릴 홍보성 포스팅을 작성하세요. 과장 광고 느낌 없이, 개발자가 직접 쓴 진솔한 후기/개발기 톤으로 작성하세요.

[이번 글 주제]
${topic}

반드시 ###태그### 형식을 정확히 지키세요.

###블로그제목###
(친근하고 클릭하고 싶은 제목, 40자 이내)
###끝###

###블로그본문###
(자연스러운 문단 구성. 필요하면 소제목 사용. 마지막에는 무료 체험 링크(https://realestate-ai-sumin.vercel.app/) 안내로 마무리)

[해시태그]
#관련키워드 10개 이상
###끝###`;

  const text = await callOpenAI(
    '당신은 자신이 만든 서비스를 진솔하게 소개하는 1인 개발자입니다. 반드시 지정된 출력 형식을 정확히 따라야 합니다. ###태그명### 형식을 절대 바꾸지 마세요.',
    prompt
  );
  const { title, content } = parseTitleAndBody(text, topic);
  await insertDraft({ title, content, category: 'promo' });
  return { title, topic };
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers['authorization'] !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const result = {};

  try {
    result.trend = await generateTrendDraft();
  } catch (err) {
    result.trend = { error: err.message };
  }

  try {
    result.promo = await generatePromoDraft();
  } catch (err) {
    result.promo = { error: err.message };
  }

  res.status(200).json({ success: true, ...result });
}
