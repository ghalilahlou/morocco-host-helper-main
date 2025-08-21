#!/usr/bin/env node

/**
 * Script to clean up debug logs from Edge Functions
 * This script removes console.log statements and replaces them with proper logging
 */

const fs = require('fs');
const path = require('path');

const EDGE_FUNCTIONS_DIR = path.join(__dirname, '../supabase/functions');

// Patterns to match and replace
const LOG_PATTERNS = [
  {
    pattern: /console\.log\(['"`](🚀|📊|📋|👤|✅|❌|⚠️|🔄|🛑|🔍|🎯|🧹|♻️|💾|📡|📄|📅|🗑️|🟡|💥)[^'"`]*['"`][^)]*\);/g,
    replacement: '// Debug log removed'
  },
  {
    pattern: /console\.log\(['"`]([^'"`]*)[^)]*\);/g,
    replacement: '// Log removed: $1'
  },
  {
    pattern: /console\.warn\(['"`]([^'"`]*)[^)]*\);/g,
    replacement: '// Warning removed: $1'
  }
];

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let hasChanges = false;

    LOG_PATTERNS.forEach(({ pattern, replacement }) => {
      const newContent = modifiedContent.replace(pattern, replacement);
      if (newContent !== modifiedContent) {
        hasChanges = true;
        modifiedContent = newContent;
      }
    });

    if (hasChanges) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  let cleanedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      cleanedCount += walkDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      if (processFile(filePath)) {
        cleanedCount++;
      }
    }
  });

  return cleanedCount;
}

// Main execution
console.log('🧹 Starting log cleanup...');
const cleanedFiles = walkDirectory(EDGE_FUNCTIONS_DIR);
console.log(`✅ Cleanup complete! Processed ${cleanedFiles} files.`);
