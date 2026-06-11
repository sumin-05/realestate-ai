export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: '주소를 입력해주세요' });

  const kakaoKey = process.env.KAKAO_API_KEY;
  
  if (!kakaoKey) {
    return res.status(500).json({ error: 'KAKAO_API_KEY 환경변수 없음' });
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
    });

    const text = await response.text();
    const data = JSON.parse(text);
    const doc = data?.documents?.[0];

    if (!doc) {
      return res.status(200).json({ 
        found: false, 
        debug: { status: response.status, total: data?.meta?.total_count }
      });
    }

    const roadAddr = doc.road_address;
    const jibunAddr = doc.address;

    res.status(200).json({
      found: true,
      location: roadAddr?.address_name || doc.address_name || address,
      buildingName: roadAddr?.building_name || '',
      jibun: jibunAddr?.address_name || '',
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
