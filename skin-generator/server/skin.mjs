import sharp from 'sharp'

// Minecraft Java classic (4px arms), base layer only. Each cuboid is unfolded
// top/bottom above right/front/left/back. Coordinates are in a 64px atlas.
export const parts = [
  { name: 'head', x: 0, y: 0, w: 8, h: 8, d: 8 },
  { name: 'torso', x: 16, y: 16, w: 8, h: 12, d: 4 },
  { name: 'right leg', x: 0, y: 16, w: 4, h: 12, d: 4 },
  { name: 'right arm', x: 40, y: 16, w: 4, h: 12, d: 4 },
  { name: 'left leg', x: 16, y: 48, w: 4, h: 12, d: 4 },
  { name: 'left arm', x: 32, y: 48, w: 4, h: 12, d: 4 },
]
export function faces(p) {
  const { x, y, w, h, d } = p
  return [[x+d,y,w,d], [x+d+w,y,w,d], [x,y+d,d,h],
    [x+d,y+d,w,h], [x+d+w,y+d,d,h], [x+2*d+w,y+d,w,h]]
}
export async function template() {
  const colors = ['#dab291', '#53647d', '#424954', '#68778d', '#424954', '#68778d']
  const rectangles = parts.flatMap((p, i) => faces(p).map(([x,y,w,h], f) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[i]}" opacity="${1-f*.045}"/>`)).join('')
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ff00ff"/>${rectangles}</svg>`)).png().toBuffer()
}
export async function normalizeSkin(buffer) {
  const input = sharp(buffer, { limitInputPixels: 18000000 })
  const metadata = await input.metadata()
  if (!metadata.width || metadata.width !== metadata.height) throw new Error('Модель вернула неквадратную развёртку. Попробуйте повторить генерацию.')
  const { data } = await input.resize(64, 64, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(4096)
  for (const p of parts) for (const [x,y,w,h] of faces(p)) {
    for (let row=y; row<y+h; row++) for (let col=x; col<x+w; col++) mask[row*64+col]=1
  }
  let missing = 0
  for (let i=0; i<4096; i++) {
    const j=i*4
    if (mask[i] && (data[j+3]<128 || (data[j]>210 && data[j+1]<70 && data[j+2]>210))) missing++
    data[j+3] = mask[i] ? 255 : 0
  }
  if (missing > 30) throw new Error('Модель оставила пустые участки на теле. Попробуйте другое описание или повторите генерацию.')
  return sharp(data, {raw:{width:64,height:64,channels:4}}).png().toBuffer()
}
