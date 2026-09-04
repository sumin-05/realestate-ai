export async function generateBlogImage(prompt, filename) {
  const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'low',
      n: 1
    })
  });
  const imgData = await imgRes.json();
  if (!imgRes.ok) {
    throw new Error(imgData.error?.message || '이미지 생성 실패');
  }

  let buffer;
  if (imgData.data[0].b64_json) {
    buffer = Buffer.from(imgData.data[0].b64_json, 'base64');
  } else {
    const fileRes = await fetch(imgData.data[0].url);
    if (!fileRes.ok) {
      throw new Error('생성된 이미지 다운로드 실패');
    }
    buffer = Buffer.from(await fileRes.arrayBuffer());
  }

  const uploadRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/blog-images/${filename}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!uploadRes.ok) {
    throw new Error('이미지 업로드 실패: ' + (await uploadRes.text()));
  }

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/blog-images/${filename}`;
}
