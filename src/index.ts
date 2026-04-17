import type { Context, Tables } from 'koishi'
import { } from '@koishijs/plugin-help'
import { $, h, Schema } from 'koishi'
import { shortcut } from 'koishi-plugin-montmorill'
import { pinyin } from 'pinyin-pro'

export const name = 'hanting'

export interface Config {
  rubyStyle: 'tex' | 'html' | 'markdown'
  competitions: Record<string, string>
}

export const Config: Schema<Config> = Schema.object({
  rubyStyle: Schema.union([
    Schema.const('tex').description('TeX'),
    Schema.const('html').description('HTML'),
    Schema.const('markdown').description('Markdown'),
  ]).default('tex').description('拼音格式。'),
  unicode: Schema.boolean().default(true).description('显示 Unicode 字符。'),
  competitions: Schema.dict(Schema.string()).default({
    A: '百知杯',
    B: '博物杯',
    C: '采薇/撷芷杯',
    D: '电阻杯/天玑',
    E: '萌新杯',
    F: '翻翻乐/风引杯',
    G: '捷德杯/时之王者',
    H: '官方节目',
    I: '甘棠杯',
    J: '经史/适等',
    K: '扩展杯',
    L: '丽句/元晓/江左玉',
    M: '萌进杯',
    N: '脑洞大会',
    O: '肴馔盏',
    P: '拼释会',
    Q: '启莱杯/千秋梦',
    R: '小雅杯/合纵连横',
    S: '随蓝/风叶杯',
    T: '涛源杯/源点杯',
    U: '山水/鞑靼/明史/奊诟',
    V: '五行法会',
    W: '物生行',
    X: '夏季联赛',
    Y: '螈汁杯',
    Z: '祯休会',
  }).description('比赛来源文本。'),
})

export const inject = ['database']

declare module 'koishi' {
  interface Tables {
    hantings: {
      id: string
      level: number
      word: string
      competition: string
      flag: number
      pinyin: string
      definition: string
      example: string
    }
  }
}

const unicodeMap = {
  a: 'ɑ',
  ɑ̄: 'ɑ̄',
  á: 'ɑ́',
  ǎ: 'ɑ̌',
  à: 'ɑ̀',
  g: 'ɡ',
}

export async function apply(ctx: Context, config: Config) {
  ctx.model.extend('hantings', {
    id: 'string',
    level: 'unsigned',
    word: 'char',
    competition: 'char',
    flag: 'unsigned',
    pinyin: 'char',
    definition: 'string',
    example: 'string',
  })

  ctx.command('hanting [id:string]', '从汉听词库中出题。')
    .alias('汉听', '👂来一道汉听')
    .option('flag', '-f <flag:number> 指定单词类型。')
    .alias('总', { options: { flag: 1 } })
    .alias('🥚', { options: { flag: 2 } })
    .option('level', '-l <level:number> 指定单词等级。')
    .option('competition', '-c <competition:string> 指定单词竞赛。')
    .option('ruby', '-r <ruby:string> 指定拼音格式。', { type: ['tex', 'html', 'markdown'] })
    .option('unicode', '-u 显示 Unicode 字符。')
    .option('answer', '-a 显示答案。')
    .action(async ({ options, session }, id?: string) => {
      if (!session)
        return
      options ??= {}

      const [hanting] = await ctx.database.select('hantings', {
        ...id ? { id } : {},
        ...options.flag ? { flag: options.flag } : {},
        ...options.level ? { level: options.level } : {},
        ...options.competition ? { competition: options.competition } : {},
      }).orderBy($.random).limit(1).execute()
      if (!hanting)
        return '未找到符合条件的单词！'

      if (!options?.answer)
        maskAnswer(hanting)

      if (options.unicode ?? config) {
        for (const [key, value] of Object.entries(unicodeMap))
          hanting.pinyin = hanting.pinyin.replaceAll(key, value)
      }

      const level = ['⭐', '🍄', '🥚'][hanting.flag].repeat(4 - hanting.level)

      return h('qq:markdown', [
        `${config.competitions[hanting.competition]}#${hanting.id}${level}`,
        options?.answer ? session.platform === 'qq' ? buildRuby(hanting, options.ruby ?? config.rubyStyle)
          : h('template', h('b', hanting.word), ` ${hanting.pinyin.replaceAll('-', ' ')}`)
          : hanting.pinyin.replaceAll('-', ''),
        hanting.definition,
        hanting.example,
        ...session.platform === 'qq' ? [
          !options?.answer
            ? `> 查看答案 👉 ${shortcut(session.isDirect, `/hanting ${hanting.id} -a`)}`
            : `> 查看原题 👉 ${shortcut(session.isDirect, `/hanting ${hanting.id}`)}`,
          `> 再来一题 👉 ${shortcut(session.isDirect, `/hanting`)}`,
        ] : [],
      ].map(frag => typeof frag === 'string' && !frag.endsWith('$$') ? `${frag}\n` : frag))
    })
}

function buildRuby({ word, pinyin }: Tables['hantings'], style: Config['rubyStyle']): string {
  const pairs = []
  let index = 0
  for (const part of pinyin.split(' ')) {
    const pinyins = part.split('-')
    const chars = word.slice(index, index + pinyins.length)
    pairs.push({ chars, pinyins: pinyins.join('') })
    index += pinyins.length
  }
  switch (style) {
    case 'tex':
      return `$$${pairs.map(item => String.raw`\begin{array}{c}\mathrm{${item.pinyins}}\\${item.chars}\end{array}`).join('')}$$`
    case 'html':
      return pairs.map(item => `${item.chars}<rp>(</rp><rt>${item.pinyins}</rt><rp>)</rp>`).join('')
    case 'markdown':
      return pairs.map(item => ` {${item.chars}|${item.pinyins}} `).join(' ')
  }
}

const pinyinSeparator = /[- ]/

function maskAnswer(hanting: Tables['hantings']): void {
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
