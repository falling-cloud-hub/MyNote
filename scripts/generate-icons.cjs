// 生成 MyNote 应用图标 (PNG) — CommonJS
const { writeFileSync } = require('fs')
const { deflateSync } = require('zlib')

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lengthBuf = Buffer.alloc(4)
  lengthBuf.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf])
}

function createPNG(w, h, r, g, b) {
  // 原始像素 RGBA + filter byte per row
  const rowSize = w * 4 + 1
  const raw = Buffer.alloc(rowSize * h)
  const cx = w / 2, cy = h / 2
  const rx = w * 0.40, ry = h * 0.40

  for (let y = 0; y < h; y++) {
    raw[y * rowSize] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const off = y * rowSize + 1 + x * 4
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      // 圆角矩形 + 内部白色矩形（模拟笔记纸）
      const inOuter = dx * dx + dy * dy < 1.0
      const innerLeft = cx - rx * 0.55
      const innerRight = cx + rx * 0.55
      const innerTop = cy - ry * 0.45
      const innerBottom = cy + ry * 0.65
      const inInner = x > innerLeft && x < innerRight && y > innerTop && y < innerBottom

      if (inOuter && !inInner) {
        raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = 255
      } else if (inInner) {
        raw[off] = 255; raw[off + 1] = 255; raw[off + 2] = 255; raw[off + 3] = 240
      } else {
        raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0; raw[off + 3] = 0
      }
    }
  }

  const compressed = deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(w, 0)
  ihdrData.writeUInt32BE(h, 4)
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 6   // color type RGBA
  ihdrData[10] = 0  // compression
  ihdrData[11] = 0  // filter
  ihdrData[12] = 0  // interlace

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// 生成
const path = require('path')
const outDir = path.join(__dirname, '..', 'public')
writeFileSync(path.join(outDir, 'icon-192.png'), createPNG(192, 192, 91, 140, 90))
writeFileSync(path.join(outDir, 'icon-512.png'), createPNG(512, 512, 91, 140, 90))
console.log('✅ 图标已生成到 ' + outDir)
