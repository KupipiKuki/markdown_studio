const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// Get all git tracked files
const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

// Get untracked files in evidence/, tests/, reports/, working/
const untracked = execSync('git ls-files --others --exclude-standard', { cwd: root, encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

const allFiles = Array.from(new Set([...tracked, ...untracked]))
  .filter(f => {
    if (f === 'evidence/checksums.sha256') return false;
    if (f.startsWith('node_modules/') || f.includes('/node_modules/')) return false;
    if (f.endsWith('.tmp') || f.endsWith('.tmp.cjs')) return false;
    const full = path.join(root, f);
    return fs.existsSync(full) && fs.statSync(full).isFile();
  })
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const lines = [];
for (const rel of allFiles) {
  const full = path.join(root, rel);
  const buf = fs.readFileSync(full);
  let hash;
  if (rel === 'working/markdown_studio.html') {
    // LF-normalized per project convention
    hash = crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  } else {
    hash = crypto.createHash('sha256').update(buf).digest('hex');
  }
  // Standard two-space separator, forward slashes
  lines.push(`${hash}  ${rel.replace(/\\/g, '/')}`);
}

const outPath = path.join(root, 'evidence/checksums.sha256');
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Regenerated ${lines.length} checksums in evidence/checksums.sha256`);

// Verification pass
let ok = 0;
for (const line of lines) {
  const [h, rel] = line.split(/\s+/);
  const full = path.join(root, rel);
  const buf = fs.readFileSync(full);
  let actual;
  if (rel === 'working/markdown_studio.html') {
    actual = crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  } else {
    actual = crypto.createHash('sha256').update(buf).digest('hex');
  }
  if (actual === h) {
    ok++;
  } else {
    console.error(`Mismatch on ${rel}: expected ${h}, got ${actual}`);
  }
}
console.log(`Verification: ${ok}/${lines.length} match.`);
