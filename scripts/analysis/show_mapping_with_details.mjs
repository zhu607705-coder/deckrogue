#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cardsPath = path.join(__dirname, '..', '..', 'src', 'content', 'data', 'cards.json')
const mappingPath = path.join(__dirname, '..', '..', 'output', 'image_mapping.json')

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'))
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))

console.log('# 卡牌图片映射表（含名称和简介）\n')
console.log('---|--- | --- | ---')
console.log('原文件名 | 卡牌ID | 卡牌名称 | 效果简介')
console.log('---|--- | --- | ---')

for (const [cardId, imageFile] of Object.entries(mapping)) {
  const card = cards.find(c => c.id === cardId)
  const name = card ? card.name : '(未找到)'
  const text = card ? card.text.replace(/\n/g, ' ').substring(0, 40) : ''
  console.log(`${imageFile} | ${cardId} | ${name} | ${text}`)
}
