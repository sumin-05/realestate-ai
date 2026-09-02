export default async function handler(req, res) {
  const query = req.query.q || '매물 설명문';
  const url = `https://naverapihub.apigw.ntruss.com/v1/search/cafearticle.json?query=${encodeURIComponent(query)}&display=5&sort=date`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
        'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET
      }
    });

    const text = await response.text();
    res.status(200).json({
      requestedUrl: url,
      responseStatus: response.status,
      responseBody: text
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
