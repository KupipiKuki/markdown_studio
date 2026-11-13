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

const binaryExts = new Set(['.png', '.jpeg', '.jpg', '.ico', '.bundle', '.gz', '.zip', '.pdf']);
let modifiedFiles = new Set();
try {
  const unstaged = execSync('git diff --name-only', { cwd: root, encoding: 'utf8' });
  const staged = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8' });
  modifiedFiles = new Set(
    (unstaged + '\n' + staged)
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(p => p.replace(/^markdown_studio_phase_0\//, ''))
  );
} catch (e) {}

function getFileHash(rel) {
  const full = path.join(root, rel);
  const ext = path.extname(rel).toLowerCase();
  let buf;

  // For clean tracked files, read the committed git blob so line-endings match Linux/git blob exactly.
  // Exception: working/markdown_studio.html is always read from disk as the active candidate.
  if (tracked.includes(rel) && !modifiedFiles.has(rel) && rel !== 'working/markdown_studio.html') {
    try {
      buf = execSync('git show "HEAD:markdown_studio_phase_0/' + rel + '"', {
        cwd: root,
        maxBuffer: 20 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return crypto.createHash('sha256').update(buf).digest('hex');
    } catch (e) {
      buf = fs.readFileSync(full);
    }
  } else {
    buf = fs.readFileSync(full);
  }

  if (binaryExts.has(ext)) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }
  // All active text files (including working/markdown_studio.html and reports) are LF-normalized
  return crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
}

const lines = [];
for (const rel of allFiles) {
  const hash = getFileHash(rel);
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
  const actual = getFileHash(rel);
  if (actual === h) {
    ok++;
  } else {
    console.error(`Mismatch on ${rel}: expected ${h}, got ${actual}`);
  }
}
console.log(`Verification: ${ok}/${lines.length} match.`);

