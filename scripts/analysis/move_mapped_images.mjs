#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mappingPath = path.join(__dirname, '..', '..', 'output', 'image_mapping.json')
const images2Dir = path.join(__dirname, '..', '..', 'images 2')
const cardsDir = path.join(__dirname, '..', '..', 'public', 'assets', 'cards')

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))

let moved = 0
let skipped = 0
let errors = 0

for (const [cardId, imageFile] of Object.entries(mapping)) {
  const sourcePath = path.join(images2Dir, imageFile)
  const targetPath = path.join(cardsDir, `${cardId}.jpg`)

  if (!fs.existsSync(sourcePath)) {
    console.log(`Error: Source file not found: ${sourcePath}`)
    errors++
    continue
  }

  const stat = fs.statSync(sourcePath)
  if (!stat.isFile()) {
    console.log(`Skipping: ${imageFile} is not a file (it's a directory)`)
    continue
  }

  fs.copyFileSync(sourcePath, targetPath)
  console.log(`Moved: ${imageFile} -> ${cardId}.jpg`)
  moved++

  if (fs.existsSync(targetPath)) {
    skipped++
  }
}

console.log(`\n=== Summary ===`)
console.log(`Moved: ${moved} images`)
console.log(`Errors: ${errors} files not found`)

const svgFiles = fs.readdirSync(cardsDir).filter(f => f.endsWith('.svg'))
if (svgFiles.length > 0) {
  console.log(`\nNote: ${svgFiles.length} SVG placeholder files still exist`)
  console.log(`You may want to remove them or replace with real images`)
}
