export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.body;
  if (!address) return res.status(400).json({ error: '주소를 입력해주세요' });

  try {
    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    const encoded = encodeURIComponent(address);

    const response = await fetch(
      `https://apis.data.go.kr/1613000/BldRgstService_v2/getBldRgstInfo_v2?serviceKey=${apiKey}&sigunguCd=&bjdongCd=&platGbCd=&bun=&ji=&dongNm=&hoNm=&numOfRows=1&pageNo=1&_type=json&platPlc=${encoded}`,
    );

    const data = await response.json();
    const item = data?.response?.body?.items?.item;

    if (!item) {
      return res.status(200).json({ found: false, message: '건물 정보를 찾을 수 없습니다' });
    }

    const building = Array.isArray(item) ? item[0] : item;

    res.status(200).json({
      found: true,
      area: building.area ? Math.round(building.area) + '㎡' : '',
      floor: building.grndFlrCnt ? building.grndFlrCnt + '층' : '',
      buildYear: building.crtnDay ? building.crtnDay.toString().slice(0,4) + '년' : '',
      purpose: building.mainPurpsCdNm || '',
      address: building.platPlc || address,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
