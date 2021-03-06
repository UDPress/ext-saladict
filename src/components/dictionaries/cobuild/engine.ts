import { fetchDirtyDOM } from '@/_helpers/fetch-dom'
import {
  HTMLString,
  getText,
  getInnerHTMLBuilder,
  handleNoResult,
  handleNetWorkError,
  SearchFunction,
  GetSrcPageFunction,
} from '../helpers'
import { DictConfigs } from '@/app-config'
import { DictSearchResult } from '@/typings/server'

export const getSrcPage: GetSrcPageFunction = (text) => {
  return `https://www.collinsdictionary.com/dictionary/english/${text}`
}

const getInnerHTML = getInnerHTMLBuilder()

export interface COBUILDResult {
  title: string
  defs: HTMLString[]
  level?: string
  star?: number
  prons?: Array<{
    phsym: string
    audio: string
  }>
}

type COBUILDSearchResult = DictSearchResult<COBUILDResult>

export const search: SearchFunction<COBUILDSearchResult> = (
  text, config, payload
) => {
  text = encodeURIComponent(text.replace(/\s+/g, ' '))
  const isChz = config.langCode === 'zh-TW'
  return fetchDirtyDOM('http://www.iciba.com/' + text)
    .then(doc => handleDOM(doc, config.dicts.all.cobuild.options, isChz))
    .catch(() => {
      return fetchDirtyDOM('https://www.iciba.com/' + text)
        .catch(handleNetWorkError)
        .then(doc => handleDOM(doc, config.dicts.all.cobuild.options, isChz))
    })
}

function handleDOM (
  doc: Document,
  options: DictConfigs['cobuild']['options'],
  isChz: boolean,
): COBUILDSearchResult | Promise<COBUILDSearchResult> {
  const result: Partial<COBUILDResult> = {}
  const audio: { uk?: string, us?: string } = {}

  result.title = getText(doc, '.keyword', isChz)
  if (!result.title) { return handleNoResult() }

  result.level = getText(doc, '.base-level')

  let $star = doc.querySelector('.word-rate [class^="star"]')
  if ($star) {
    let star = Number($star.className[$star.className.length - 1])
    if (!isNaN(star)) { result.star = star }
  }

  let $pron = doc.querySelector('.base-speak')
  if ($pron) {
    result.prons = Array.from($pron.children).map(el => {
      const phsym = (el.textContent || '').trim()
      const mp3 = (/http\S+.mp3/.exec(el.innerHTML) || [''])[0]

      if (phsym.indexOf('英') !== -1) {
        audio.uk = mp3
      } else if (phsym.indexOf('美') !== -1) {
        audio.us = mp3
      }

      return {
        phsym,
        audio: mp3,
      }
    })
  }

  let $article = Array.from(doc.querySelectorAll('.info-article'))
    .find(x => /柯林斯高阶英汉双解学习词典/.test(x.textContent || ''))
  if ($article) {
    result.defs = Array.from($article.querySelectorAll('.prep-order'))
      .slice(0, options.sentence)
      .map(d => getInnerHTML(d, isChz))
  }

  if (result.defs && result.defs.length > 0) {
    return { result, audio } as COBUILDSearchResult
  }

  return handleNoResult()
}
