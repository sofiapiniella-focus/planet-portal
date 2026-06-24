#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// Daily return-window follow-up reminder.
//
//   node scripts/return_reminders.mjs            (uses today's date)
//   node scripts/return_reminders.mjs --date=2026-07-13   (test a date)
//
// Reads scripts/partners_data.json, computes DAYS LEFT in the 30-day
// return window for each kit that has a return_by_date (i.e. delivered,
// non-gifted kits — gifted / not-yet-delivered kits have no return date),
// and reports which partners hit a follow-up milestone TODAY.
//
// Milestones (days remaining):
//   • 15-DAY follow-up  → exactly 15 days left
//   • 5-DAY follow-up   → exactly 5 days left
//   • OVERDUE           → past the return date (reported every run until
//                         the kit's status / return_by_date changes)
//
// Prints "No follow-ups due today." and exits 0 when nothing matches.
// Exits 0 normally; exits 1 only on a read/parse error.
// Designed to be run by a daily scheduled task — output is plain text.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Optional --date=YYYY-MM-DD override (for testing); defaults to today.
const dateArg = process.argv.find((a) => a.startsWith('--date='))
const today = new Date()
if (dateArg) {
  const [y, m, d] = dateArg.slice('--date='.length).split('-').map(Number)
  today.setFullYear(y, m - 1, d)
}
today.setHours(0, 0, 0, 0)

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function fmtToday() {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

let data
try {
  data = JSON.parse(readFileSync(join(__dirname, 'partners_data.json'), 'utf8'))
} catch (e) {
  console.error(`✗ Could not read partners_data.json: ${e.message}`)
  process.exit(1)
}

const nameByEmail = new Map(data.partners.map((p) => [p.email, p.name]))

const overdue = []
const fiveDay = []
const fifteenDay = []

for (const k of data.kits) {
  if (!k.return_by_date) continue // not in a return window
  const left = daysUntil(k.return_by_date)
  const name = nameByEmail.get(k.partner_email) || k.partner_email
  const entry = { name, left, date: k.return_by_date }
  if (left < 0) overdue.push(entry)
  else if (left === 5) fiveDay.push(entry)
  else if (left === 15) fifteenDay.push(entry)
}

console.log(`Return follow-ups — ${fmtToday()}`)
console.log('')

const total = overdue.length + fiveDay.length + fifteenDay.length
if (total === 0) {
  console.log('No follow-ups due today.')
  process.exit(0)
}

if (overdue.length) {
  console.log(`OVERDUE (${overdue.length}):`)
  for (const e of overdue.sort((a, b) => a.left - b.left)) {
    const n = Math.abs(e.left)
    console.log(`  - ${e.name} — overdue by ${n} ${n === 1 ? 'day' : 'days'} (return was ${e.date})`)
  }
  console.log('')
}
if (fiveDay.length) {
  console.log(`5-DAY follow-up (${fiveDay.length}):`)
  for (const e of fiveDay) {
    console.log(`  - ${e.name} — 5 days left (return by ${e.date})`)
  }
  console.log('')
}
if (fifteenDay.length) {
  console.log(`15-DAY follow-up (${fifteenDay.length}):`)
  for (const e of fifteenDay) {
    console.log(`  - ${e.name} — 15 days left (return by ${e.date})`)
  }
  console.log('')
}

process.exit(0)
