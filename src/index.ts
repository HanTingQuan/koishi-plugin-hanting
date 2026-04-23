import type { Context, Tables } from 'koishi'
import type { VariantId } from './id'
import { } from '@koishijs/plugin-help'
import { $, h, Logger, Schema } from 'koishi'
import { shortcut } from 'koishi-plugin-montmorill'

import competitions from './competitions.json'
import { buildVariantId, parseVariantId } from './id'
import { maskAnswer } from './mask'
import { makeRubyPairs, rubyBuilders, rubyStyles } from './ruby'

export const name = 'hanting'
const logger = new Logger(name)

export interface Config {
  dataUrl: string
  rubyStyle: keyof typeof rubyBuilders
  replaceMap: Record<string, string>
  competitions: Record<string, string>
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    dataUrl: Schema.string().description('汉听词库 URL。').default('https://raw.githubusercontent.com/HanTingQuan/HTDictionary/refs/heads/main/hanting.csv'),
    rubyStyle: Schema.union(rubyStyles).description('拼音格式。').default('plain'),
  }),
  Schema.object({
    replaceMap: Schema.dict(Schema.string()).description('替换拼音中的字符。').collapse().default({ a: 'ɑ', ā: 'ɑ̄', á: 'ɑ́', ǎ: 'ɑ̌', à: 'ɑ̀', g: 'ɡ' }),
    competitions: Schema.dict(Schema.string()).description('比赛来源文本。').collapse().default(competitions),
  }).description('高级配置'),
])

export const inject = ['database']

declare module 'koishi' {
  interface Tables {
    hanting: {
      id: number
      variant: number
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
  ctx.model.extend('hanting', {
    id: 'unsigned',
    variant: 'unsigned',
    level: 'unsigned',
    word: 'string',
    competition: 'char',
    flag: 'unsigned',
    pinyin: 'string',
    definition: 'string',
    example: 'string',
  }, { primary: ['id', 'variant'] })

  ctx.command('hanting [id:string]', '从汉听词库中出题。')
    .alias('汉听', '👂来一道汉听')
    .option('flag', '-f <flag:number> 指定单词类型。')
    .alias('总', { options: { flag: 1 } })
    .alias('ziong', { options: { flag: 1 } })
    .alias('🥚', { options: { flag: 2 } })
    .option('level', '-l <level:number> 指定单词等级。')
    .option('competition', '-c <competition:string> 指定单词竞赛。')
    .option('variant', '-v <variant:number> 指定单词变体。', { hidden: true })
    .option('ruby', '-r <ruby:string> 指定拼音格式。', { hidden: true, type: rubyStyles })
    .option('answer', '-a 显示答案。')
    .action(async ({ options, session }, id?: string) => {
      if (!session)
        return

      const [hanting] = await ctx.database.select('hanting', {
        ...id ? parseVariantId(id as VariantId) : {},
        ...options?.flag ? { flag: options.flag } : {},
        ...options?.level ? { level: options.level } : {},
        ...options?.competition ? { competition: options.competition } : {},
        ...options?.variant ? { variant: options.variant } : {},
      }).orderBy($.random).limit(1).execute()
      if (!hanting)
        return '未找到符合条件的单词！'

      if (!options?.answer)
        maskAnswer(hanting)

      for (const [key, value] of Object.entries(config.replaceMap)) {
        hanting.pinyin = hanting.pinyin.replaceAll(key, value)
        hanting.definition = hanting.definition.replaceAll(key, value)
        hanting.example = hanting.example.replaceAll(key, value)
      }

      let variantId = buildVariantId(hanting.id, hanting.variant)
      const level = ['⭐', '🍄', '🥚'][hanting.flag].repeat(4 - hanting.level)

      if (hanting.variant === 0) {
        const variant = await ctx.database.get('hanting', { id: hanting.id })
        if (variant.length === 1) {
          variantId = hanting.id as any
        }
      }

      return h('qq:markdown', [
        `${config.competitions[hanting.competition]}#${variantId}${level}`,
        options?.answer
          ? rubyBuilders[options?.ruby ?? config.rubyStyle](makeRubyPairs(hanting))
          : hanting.pinyin.replaceAll('-', ''),
        hanting.definition,
        hanting.example,
        ...session.platform === 'qq' ? [
          `> 回答汉听 👉 ${shortcut.input(`/hanting.answer ${variantId} `)}`,
          !options?.answer && `> 查看答案 👉 ${shortcut(session.isDirect, `/hanting ${variantId} -a`)}`,
          `> 再来一题 👉 ${shortcut(session.isDirect, `/hanting`)}`,
        ].filter(Boolean) : [],
      ].map(frag => typeof frag === 'string' && !frag.endsWith('$$') ? `${frag}\n` : frag))
    })
    .subcommand('.answer <id:string> <answer:string>', '回答')
    .action(async ({ session }, id, answer) => {
      if (!session)
        return

      const [hanting] = await ctx.database.get('hanting', parseVariantId(id as VariantId))
      if (!hanting)
        return '未找到符合条件的单词！'
      const correctAnswer = hanting.word.split('/')
      if (!correctAnswer.includes(answer))
        return '❌️回答错误！'
      return '✅️回答正确！'
    })

  const stats = await ctx.database.stats()
  if (!stats.tables.hanting?.count) {
    logger.info('汉听词库为空，下载中...')
    const parser = (await import('csv-parse')).parse({ columns: true })
    const buffer: Tables['hanting'][] = []
    parser.on('readable', () => {
      let record = parser.read()
      while (record !== null) {
        buffer.push({
          variant: 0,
          ...record,
          ...parseVariantId(record.id),
        })
        record = parser.read()
      }
    })
    parser.write(await ctx.http.get(config.dataUrl))
    parser.end(() => {
      ctx.database.upsert('hanting', buffer)
      logger.info(`汉听词库下载完成，共 ${buffer.length} 条记录。`)
    })
  }
}
