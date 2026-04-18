export const rubyBuilders = {
  plain(pairs) {
    return pairs.map(([chars, pinyins]) => `${chars}(${pinyins})`).join('')
  },

  'TeX/overset': (pairs) => {
    const fragments = pairs.map(([chars, pinyins]) =>
      String.raw`\overset{\text{\scriptsize ${pinyins}}}{\text{${chars}}}`)
    return `$$${fragments.join(String.raw`\;`)}$$`
  },

  'TeX/array': (pairs) => {
    const colSpec = `*{${pairs.length}}{c}`
    const firstRow = pairs.map(([_, pinyins]) => `\\text{\\scriptsize ${pinyins}}`).join(' & ')
    const secondRow = pairs.map(([chars]) => `\\text{${chars}}`).join(' & ')
    return `$$\\begin{array}{${colSpec}}${firstRow}\\\\${secondRow}\\end{array}$$`
  },

  HTML(pairs) {
    return pairs
      .map(([chars, pinyins]) => `<ruby>${chars}<rp>(</rp><rt>${pinyins}</rt><rp>)</rp></ruby>`)
      .join('')
  },

  markdown(pairs) {
    return pairs.map(([chars, pinyins]) => ` {${chars}|${pinyins}} `).join('')
  },
} satisfies Record<string, (pairs: [chars: string, pinyins: string][]) => string>

export const rubyStyles = Object.keys(rubyBuilders) as (keyof typeof rubyBuilders)[]

export function makeRubyPairs(hanting: Record<'word' | 'pinyin', string>): [string, string][] {
  const pairs: [string, string][] = []
  let index = 0
  for (const part of hanting.pinyin.split(' ')) {
    const pinyins = part.split('-')
    const chars = hanting.word.slice(index, index + pinyins.length)
    pairs.push([chars, pinyins.join('')])
    index += pinyins.length
  }
  return pairs
}
