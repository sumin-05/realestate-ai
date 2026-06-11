export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.body;
  if (!address) return res.status(400).json({ error: '주소를 입력해주세요' });

  try {
    const kakaoKey = process.env.KAKAO_API_KEY;

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}&analyze_type=similar`,
      {
        headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
      }
    );

    const data = await response.json();
    const doc = data?.documents?.[0];

    if (!doc) {
      return res.status(200).json({ found: false });
    }

    const roadAddr = doc.road_address;
    const jibunAddr = doc.address;

    res.status(200).json({
      found: true,
      location: roadAddr?.address_name || doc.address_name || address,
      buildingName: roadAddr?.building_name || '',
      jibun: jibunAddr?.address_name || '',
      region1: roadAddr?.region_1depth_name || '',
      region2: roadAddr?.region_2depth_name || '',
      region3: roadAddr?.region_3depth_name || '',
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}