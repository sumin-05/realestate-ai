export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: '당신은 전문 부동산 공인중개사입니다. 반드시 지정된 출력 형식을 정확히 따라야 합니다. ###태그명### 형식을 절대 바꾸지 마세요.'
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
