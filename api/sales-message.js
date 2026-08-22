export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agentName, officeName, region } = req.body;
  if (!agentName) {
    return res.status(400).json({ error: 'agentName이 필요합니다' });
  }

  const prompt = `당신은 SaaS 영업 전문가입니다. '매물AI'라는 부동산 설명문 자동생성 서비스를 공인중개사에게 소개하는 개인화된 카카오톡 첫 영업 메시지를 작성하세요.
반드시 ###태그### 형식을 정확히 지키세요.

[대상 중개사 정보]
이름: ${agentName}
사무소명: ${officeName || '미입력'}
지역: ${region || '미입력'}

[매물AI 소개]
- 매물 정보만 입력하면 AI가 타깃 고객별 맞춤 설명문, 네이버 부동산 문구, 블로그 포스팅, 카카오톡 상담 메시지까지 자동 생성
- 무료 체험 월 5건 제공, 이후 유료 전환
- 매물마다 반복해서 설명문을 직접 쓰는 시간을 대폭 절약

###영업메시지###
(${agentName} 중개사님께 보내는 카카오톡 첫 영업 메시지. 사무소명·지역을 자연스럽게 언급해 개인화하고, 너무 광고 느낌 나지 않게 친근한 톤으로 작성. 무료 체험 유도 CTA 포함. 200자 내외)
###끝###

###팔로업메시지###
(위 메시지에 답이 없을 경우 3일 뒤 보낼 짧은 팔로업 메시지. 가볍고 부담 없는 톤. 80자 내외)
###끝###`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: '당신은 부동산 SaaS 서비스의 영업 담당자입니다. 반드시 지정된 출력 형식을 정확히 따라야 합니다. ###태그명### 형식을 절대 바꾸지 마세요.'
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: data.error?.message || 'API 오류' });
  }

  res.status(200).json({ result: data.choices[0].message.content });
}
