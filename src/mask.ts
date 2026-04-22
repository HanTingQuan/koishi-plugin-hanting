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
    const arr = pinyin(sentence, { toneType: 'symbol', type: 'all' })
      .map(item => hanting.word.includes(item.origin)
        || pinyinSet.has(item.pinyin) ? ` ${item.pinyin} ` : item.origin)
    return arr.join('').replaceAll(/\s*(\p{P})\s*/gu, '$1').replaceAll(/\s+/g, ' ')
  }

  hanting.definition = maskText(hanting.definition)
  hanting.example && (hanting.example = maskText(hanting.example))
}
