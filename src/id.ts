export type VariantId = `${number}${string}`

function toBase26(n: number): string {
  let result = ''
  do {
    const remainder = n % 26
    result = String.fromCharCode('a'.charCodeAt(0) + remainder) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return result
}

function fromBase26(s: string): number {
  let result = 0
  for (let i = 0; i < s.length; i++) {
    result = result * 26 + (s.charCodeAt(i) - 'a'.charCodeAt(0)) + 1
  }
  return result - 1
}

export function buildVariantId(id: number, variant: number): VariantId {
  return `${id}${toBase26(variant)}`
}

export function parseVariantId(value: VariantId): { id: number, variant?: number } {
  const match = value.match(/^(\d+)([a-z]+)?$/)
  if (!match)
    return { id: -1 }
  return {
    id: Number.parseInt(match[1], 10),
    ...match[2] ? { variant: fromBase26(match[2]) } : {},
  }
}
