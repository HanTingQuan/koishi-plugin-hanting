import type { Context, Tables } from 'koishi'
import { $, h, Schema } from 'koishi'
import { shortcut } from 'koishi-plugin-montmorill'
import { pinyin } from 'pinyin-pro'

export const name = 'hanting'

export interface Config {
  competitions: Record<string, string>
}

export const Config: Schema<Config> = Schema.object({
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
  }),
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

  ctx.command('hanting [id:string]', '从汉听词库中出题')
    .alias('汉听', '👂来一道汉听')
    .option('flag', '-f <flag:number> 指定单词类型')
    .alias('总', { options: { flag: 1 } })
    .alias('🥚', { options: { flag: 2 } })
    .option('level', '-l <level:number> 指定单词等级')
    .option('competition', '-c <competition:string> 指定单词竞赛')
    .option('answer', '-a 显示答案')
    .action(async ({ options, session }, id?: string) => {
      if (!session)
        return
      options ??= {}

      const [hanting] = await ctx.database.select('hantings', {
        ...(id ? { id } : {}),
        ...(options.flag ? { flag: options.flag } : {}),
        ...(options.level ? { level: options.level } : {}),
        ...(options.competition ? { competition: options.competition } : {}),
      }).orderBy($.random).limit(1).execute()
      if (!hanting)
        return '未找到符合条件的单词！'

      if (!options?.answer)
        filterHomophone(hanting)

      const level = ['⭐', '🍄', '🥚'][hanting.flag].repeat(4 - hanting.level)

      return h('qq:markdown', [
        `${config.competitions[hanting.competition]}#${hanting.id}${level}`,
        options?.answer
          ? session.platform === 'qq'
            ? buildRuby(hanting)
            : h('template', h('b', hanting.word), ` ${hanting.pinyin.replaceAll('-', ' ')}`)
          : hanting.pinyin.replaceAll('-', ''),
        hanting.definition,
        hanting.example,
        ...(session.platform === 'qq'
          ? [
              !options?.answer
                ? `> 查看答案 👉 ${shortcut(session.isDirect, `/hanting ${hanting.id} -a`)}`
                : `> 查看原题 👉 ${shortcut(session.isDirect, `/hanting ${hanting.id}`)}`,
              `> 再来一题 👉 ${shortcut(session.isDirect, `/hanting`)}`,
            ]
          : []),
      ].map(frag => typeof frag === 'string' && !frag.endsWith('$$') ? `${frag}\n` : frag))
    })
}

function buildRuby({ word, pinyin }: Tables['hantings']): string {
  let result = ''
  let index = 0
  for (const part of pinyin.split(' ')) {
    const pinyins = part.split('-')
    const chars = word.slice(index, index + pinyins.length)
    result += String.raw`\begin{array}{c}\mathrm{${pinyins.join('')}}\\${chars}\end{array}`
    // result += `${chars}<rp>(</rp><rt>${pinyins.join('')}</rt><rp>)</rp>`
    // result += ` {${chars}|${pinyins.join('')}} `
    index += pinyins.length
  }
  return `$$${result}$$`
}

const pinyinSeparator = /[- ]/

function filterHomophone(hanting: Tables['hantings']): void {
  const pinyinSet = new Set(hanting.pinyin.toLowerCase().split(pinyinSeparator))
  const replaceHomophone = (sentence: string) =>
    pinyin(sentence, { toneType: 'symbol', type: 'all' })
      .map(item => pinyinSet.has(item.pinyin) ? ` ${item.pinyin} ` : item.origin)
      .join('')
      .replaceAll('  ', ' ')

  hanting.definition = replaceHomophone(hanting.definition)
  hanting.example && (hanting.example = replaceHomophone(hanting.example))
}
