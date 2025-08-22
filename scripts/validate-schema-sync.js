#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

/**
 * Schema Synchronization Validation Script
 *
 * This script validates that database schemas are synchronized between
 * the Next.js frontend and Node.js backend in our hybrid architecture.
 */

const FRONTEND_SCHEMA_DIR = path.join(__dirname, '../src/db/schema')
const BACKEND_SCHEMA_DIR = path.join(__dirname, '../backend/src/db/schema')

const SCHEMA_FILES = [
  'auth.ts',
  'subscriptions.ts',
  'chat.ts',
  'chat-relations.ts',
  'relations.ts',
  'index.ts',
]

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  const content = fs.readFileSync(filePath, 'utf8')
  return crypto.createHash('md5').update(content).digest('hex')
}

function validateSchemaSync() {
  console.log('🔍 Validating schema synchronization...\n')

  let allSynced = true
  const results = []

  for (const file of SCHEMA_FILES) {
    const frontendPath = path.join(FRONTEND_SCHEMA_DIR, file)
    const backendPath = path.join(BACKEND_SCHEMA_DIR, file)

    const frontendHash = getFileHash(frontendPath)
    const backendHash = getFileHash(backendPath)

    const frontendExists = fs.existsSync(frontendPath)
    const backendExists = fs.existsSync(backendPath)

    const result = {
      file,
      frontendExists,
      backendExists,
      frontendHash,
      backendHash,
      synced: frontendHash === backendHash && frontendHash !== null,
    }

    results.push(result)

    if (!result.synced) {
      allSynced = false
    }
  }

  // Print results
  console.log('📊 Schema Synchronization Status:\n')
  console.log('┌─────────────────────┬──────────┬─────────┬─────────┐')
  console.log('│ File                │ Frontend │ Backend │ Synced  │')
  console.log('├─────────────────────┼──────────┼─────────┼─────────┤')

  for (const result of results) {
    const file = result.file.padEnd(19)
    const frontend = result.frontendExists ? '✅' : '❌'
    const backend = result.backendExists ? '✅' : '❌'
    const synced = result.synced ? '✅' : '❌'

    console.log(
      `│ ${file} │    ${frontend}    │   ${backend}   │   ${synced}   │`
    )
  }

  console.log('└─────────────────────┴──────────┴─────────┴─────────┘\n')

  // Print detailed issues
  const issues = results.filter((r) => !r.synced)
  if (issues.length > 0) {
    console.log('⚠️  Schema synchronization issues found:\n')

    for (const issue of issues) {
      console.log(`❌ ${issue.file}:`)

      if (!issue.frontendExists) {
        console.log(
          `   - Missing in frontend: ${FRONTEND_SCHEMA_DIR}/${issue.file}`
        )
      }

      if (!issue.backendExists) {
        console.log(
          `   - Missing in backend: ${BACKEND_SCHEMA_DIR}/${issue.file}`
        )
      }

      if (
        issue.frontendExists &&
        issue.backendExists &&
        issue.frontendHash !== issue.backendHash
      ) {
        console.log(`   - Content differs between frontend and backend`)
        console.log(`   - Frontend hash: ${issue.frontendHash}`)
        console.log(`   - Backend hash:  ${issue.backendHash}`)
      }

      console.log('')
    }

    console.log('🔧 To fix synchronization issues:')
    console.log(
      '   npm run sync:schema-to-backend    # Copy from frontend to backend'
    )
    console.log(
      '   npm run sync:schema-from-backend  # Copy from backend to frontend\n'
    )
  }

  // Summary
  if (allSynced) {
    console.log('✅ All schemas are synchronized!\n')
    console.log(
      '🎉 Your hybrid architecture database schemas are in perfect sync.'
    )
    return true
  } else {
    console.log(`❌ ${issues.length} schema file(s) are out of sync.\n`)
    console.log(
      '⚠️  This could cause runtime errors in your hybrid architecture.'
    )
    console.log(
      'Please synchronize the schemas before deploying or running the application.'
    )
    return false
  }
}

function showUsage() {
  console.log('📚 Schema Validation Usage:\n')
  console.log(
    '  npm run verify:schema-sync     # Validate schema synchronization'
  )
  console.log(
    '  node scripts/validate-schema-sync.js  # Run this script directly\n'
  )
  console.log('🏗️  Hybrid Architecture Schema Management:\n')
  console.log('  Frontend schemas: src/db/schema/')
  console.log('  Backend schemas:  backend/src/db/schema/')
  console.log('  Both must be identical for proper operation.\n')
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    showUsage()
    process.exit(0)
  }

  const success = validateSchemaSync()
  process.exit(success ? 0 : 1)
}

module.exports = { validateSchemaSync }
