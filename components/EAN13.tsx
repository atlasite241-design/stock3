'use client'


// EAN-13 encoding tables
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export function ean13CheckDigit(d12: string): string {
  const sum = d12.split('').reduce((a, c, i) => a + Number(c) * (i % 2 === 0 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10)
}

export function normalizeEan13(code: string): string | null {
  const digits = (code || '').replace(/\D/g, '')
  if (digits.length === 13) return digits
  if (digits.length === 12) return digits + ean13CheckDigit(digits)
  return null
}

/** Generate a new EAN-13 barcode with the Moroccan prefix 611. */
export function generateEan13(): string {
  let d = '611'
  for (let i = 0; i < 9; i++) d += Math.floor(Math.random() * 10)
  return d + ean13CheckDigit(d)
}

export default function EAN13({
  code,
  height = 44,
  moduleWidth = 2,
  showText = true,
}: {
  code: string
  height?: number
  moduleWidth?: number
  showText?: boolean
}) {
  const c = normalizeEan13(code)
  if (!c) {
    return <span className="font-mono text-[10px] text-gray-400">{code || 'sans code'}</span>
  }

  let bits = '101'
  const pattern = PARITY[Number(c[0])]
  for (let i = 1; i <= 6; i++) {
    const d = Number(c[i])
    bits += pattern[i - 1] === 'L' ? L[d] : G[d]
  }
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[Number(c[i])]
  bits += '101'

  const quiet = 7
  const totalModules = bits.length + quiet * 2
  const w = totalModules * moduleWidth
  const textH = showText ? 14 : 0

  const rects: { x: number; w: number }[] = []
  let i = 0
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i
      while (j < bits.length && bits[j] === '1') j++
      rects.push({ x: (quiet + i) * moduleWidth, w: (j - i) * moduleWidth })
      i = j
    } else {
      i++
    }
  }

  return (
    <svg
      width={w}
      height={height + textH}
      viewBox={`0 0 ${w} ${height + textH}`}
      className="max-w-full"
      role="img"
      aria-label={`Code-barres ${c}`}
    >
      <rect x="0" y="0" width={w} height={height + textH} fill="white" />
      {rects.map((r, idx) => (
        <rect key={idx} x={r.x} y="0" width={r.w} height={height} fill="#111827" />
      ))}
      {showText && (
        <text
          x={w / 2}
          y={height + 11}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="11"
          fill="#111827"
        >
          {c}
        </text>
      )}
    </svg>
  )
}
