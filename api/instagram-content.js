export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { location, price, afterText } = req.body;
  if (!afterText) {
    return res.status(400).json({ error: 'afterText가 필요합니다' });
  }

  const prompt = `당신은 SNS 마케팅 전문가입니다. '매물AI'라는 부동산 설명문 자동생성 서비스를 홍보하는 인스타그램 콘텐츠를 만드세요.
반드시 ###태그### 형식을 정확히 지키세요.

[매물 정보]
위치: ${location || '미입력'}
가격: ${price || '미입력'}

[매물AI가 생성한 설명문 (After)]
${afterText}

위 정보를 참고해서 아래 5가지를 생성하세요.

###비포문구###
(공인중개사가 매물AI 없이 직접 썼을 법한, 성의없고 밋밋한 매물 설명. 30~50자 내외. 예: "84㎡ 아파트 매매. 남향. 5억. 연락주세요.")
###끝###

###애프터문구###
(위에 주어진 "매물AI가 생성한 설명문"을 그대로 사용, 다듬지 말 것)
###끝###

###인스타캡션###
(인스타그램 게시물용 캡션. 첫 줄은 시선을 끄는 후킹 문구, Before/After 대비를 강조하는 내용, 매물AI 사용을 유도하는 CTA 포함. 300자 내외, 이모지 적절히 활용)
###끝###

###해시태그###
(부동산/공인중개사/AI 관련 해시태그 15개, #으로 시작, 공백으로 구분)
###끝###

###릴스씬구성###
(인스타그램 릴스용 15~30초 홍보 영상 대본. 5~6개 씬으로 구성하고, 각 씬마다 아래 형식을 정확히 지켜서 작성:

[씬N | 시작초-종료초]
화면: (화면에 무엇이 보이는지 - 텍스트 카드, 배경, 등장 요소 등을 구체적으로 묘사)
대사: (AI 음성 나레이션 대사, 자연스러운 구어체)
자막: (화면에 표시될 자막 텍스트, 짧고 임팩트있게)

1번 씬은 Before(성의없는 매물 설명)로 시작해서 문제 제기, 중간 씬에서 매물AI 사용 후 After로 전환, 마지막 씬은 반드시 매물AI 사용을 유도하는 CTA로 마무리)
###끝###`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: '당신은 부동산 서비스를 홍보하는 SNS 마케팅 전문가입니다. 반드시 지정된 출력 형식을 정확히 따라야 합니다. ###태그명### 형식을 절대 바꾸지 마세요.'
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
