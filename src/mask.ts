import type { Tables } from 'koishi'
import { pinyin } from 'pinyin-pro'

const pinyinSeparator = /[- ]/

export function maskAnswer(hanting: Tables['hanting']): void {
  const replaceMap = new Map()
  const words = hanting.word.split('/')
  let index = 0
  for (const pinyin of hanting.pinyin.split(pinyinSeparator)) {
    for (const word of words)
      replaceMap.set(word[index], pinyin)
    index++
  }

  const pinyinSet = new Set(hanting.pinyin.toLowerCase().split(pinyinSeparator))
  const maskText = (sentence: string) => {
    for (const [char, pinyin] of replaceMap)
      sentence = sentence.replaceAll(char, pinyin)
    return pinyin(sentence, { toneType: 'symbol', type: 'all' })
      .map(item => pinyinSet.has(item.pinyin) ? ` ${item.pinyin} ` : item.origin)
      .join('')
      .replaceAll('  ', ' ')
  }

  hanting.definition = maskText(hanting.definition)
  hanting.example && (hanting.example = maskText(hanting.example))
}
