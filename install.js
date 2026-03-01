#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REMOTE_URL = 'https://github.com/joseph-ravenwolfe/hyperworker.git';
const AVAILABLE_STACKS = ['typescript', 'kubernetes'];
const SKIP_RESULT = { added: [], unchanged: [], status: 'skipped' };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Create a readline interface and return a prompt function.
 * Always call rl.close() when done (use try/finally).
 */
function createPrompt() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));
  return { rl, ask };
}

/**
 * Write JSON content atomically using temp file + rename.
 * Cleans up the temp file on failure.
 */
function writeJsonAtomic(targetPath, data) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });

  const content = JSON.stringify(data, null, 2) + '\n';
  const tmpPath = path.join(dir, `.settings.json.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Prompt user to overwrite invalid JSON or skip. Returns true to overwrite.
 * In --yes mode, always skips (returns false).
 */
async function promptOverwriteInvalidJson(opts, filePath, parseError) {
  console.warn(`  Warning: Invalid JSON in ${filePath}: ${parseError.message}`);

  if (opts.yes) {
    console.log(`  --yes mode: skipping settings merge (invalid target JSON).`);
    return false;
  }

  const { rl, ask } = createPrompt();
  try {
    const answer = (await ask('  Overwrite with hyperworker defaults? (y/N): ')).trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      console.log('  Overwriting invalid settings file.');
      return true;
    }
    console.log('  Skipping settings merge.');
    return false;
  } finally {
    rl.close();
  }
}

/**
 * Compute key-level change summary between two objects.
 */
function computeKeyChanges(before, after) {
  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  const added = afterKeys.filter((k) => !beforeKeys.includes(k));
  const changed = afterKeys.filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
  );
  const unchanged = beforeKeys.filter((k) => !changed.includes(k));
  return { added, changed, unchanged };
}

/**
 * Print indented JSON with a label, or a placeholder if the file was empty.
 */
function printJsonBlock(label, json, wasEmpty, emptyMessage) {
  console.log(`  --- ${label} ---`);
  if (wasEmpty) {
    console.log(`    ${emptyMessage}`);
  } else {
    json.split('\n').forEach((line) => console.log(`    ${line}`));
  }
}

// ---------------------------------------------------------------------------
// Reverse-merge utility
// ---------------------------------------------------------------------------

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Merge `source` into `target` using reverse-merge semantics.
 *
 * - Scalars: keep target's value if it exists (not null/undefined), else use source's.
 * - Objects: recursively merge, keeping target's values where keys conflict.
 * - Arrays: set-union -- append unique entries from source not already in target.
 *
 * Both arguments are left unmodified; a new object is returned.
 */
function reverseMerge(target, source) {
  if (target == null && source == null) return {};
  if (target == null) return JSON.parse(JSON.stringify(source));
  if (source == null) return JSON.parse(JSON.stringify(target));

  const result = {};
  const allKeys = new Set([...Object.keys(target), ...Object.keys(source)]);

  for (const key of allKeys) {
    const tVal = target[key];
    const sVal = source[key];

    if (Array.isArray(tVal) && Array.isArray(sVal)) {
      result[key] = [...tVal, ...sVal.filter((v) => !tVal.includes(v))];
    } else if (isPlainObject(tVal) && isPlainObject(sVal)) {
      result[key] = reverseMerge(tVal, sVal);
    } else if (tVal !== undefined && tVal !== null) {
      result[key] = tVal;
    } else {
      result[key] = isPlainObject(sVal) || Array.isArray(sVal)
        ? JSON.parse(JSON.stringify(sVal))
        : sVal;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse command-line arguments into an options object.
 * Supports: --target, --source, --remote, --stack, --dry-run, --yes/-y, --help
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    target: process.cwd(),
    source: null,
    remote: null,
    stack: null,
    dryRun: false,
    yes: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true;
        break;

      case '--dry-run':
        opts.dryRun = true;
        break;

      case '--yes':
      case '-y':
        opts.yes = true;
        break;

      case '--target': {
        const val = args[++i];
        if (!val || val.startsWith('-')) {
          console.error('Error: --target requires a path argument.');
          process.exit(1);
        }
        opts.target = path.resolve(val);
        break;
      }

      case '--source': {
        const val = args[++i];
        if (!val || val.startsWith('-')) {
          console.error('Error: --source requires a path argument.');
          process.exit(1);
        }
        opts.source = path.resolve(val);
        break;
      }

      case '--remote': {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          opts.remote = next;
          i++;
        } else {
          opts.remote = DEFAULT_REMOTE_URL;
        }
        break;
      }

      case '--stack': {
        const val = args[++i];
        if (!val || val.startsWith('-')) {
          console.error('Error: --stack requires a value (typescript or kubernetes).');
          process.exit(1);
        }
        if (!AVAILABLE_STACKS.includes(val)) {
          console.error(`Error: Invalid stack "${val}". Choose one of: ${AVAILABLE_STACKS.join(', ')}`);
          process.exit(1);
        }
        opts.stack = val;
        break;
      }

      default:
        console.error(`Error: Unknown argument "${arg}". Run with --help for usage.`);
        process.exit(1);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp() {
  const help = `
hyperworker-install - Install Hyperworker Claude Code skills into your project

USAGE
  node install.js [options]
  npx hyperworker-install [options]

OPTIONS
  --target <path>     Target project directory (default: current working directory)
  --source <path>     Path to a local hyperworker clone (default: script's own repo)
  --remote [url]      Clone hyperworker from GitHub into a temp directory
                      (default URL: ${DEFAULT_REMOTE_URL})
  --stack <name>      Stack variant to install: typescript or kubernetes
                      (skips interactive prompt)
  --dry-run           Preview changes without writing any files
  --yes, -y           Non-interactive mode (auto-skip conflicts, requires --stack)
  --help, -h          Show this help message

EXAMPLES
  # Install from local clone into current directory
  node install.js --stack typescript

  # Install from GitHub into a specific project
  npx hyperworker-install --remote --target ~/my-project --stack typescript

  # Preview what would change
  node install.js --stack kubernetes --dry-run

  # Non-interactive install (CI-friendly)
  node install.js --stack typescript --yes
`.trimStart();

  console.log(help);
}

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

/**
 * Determine the source directory for installation.
 *
 * Priority:
 *   1. --source flag (explicit local path)
 *   2. Script's own repo directory (__dirname) if stack dirs exist there
 *   3. --remote flag or auto-fallback to remote clone
 */
function resolveSource(opts) {
  if (opts.source) {
    if (!fs.existsSync(opts.source)) {
      console.error(`Error: Source directory does not exist: ${opts.source}`);
      process.exit(1);
    }
    return { sourceDir: opts.source, tempDir: null };
  }

  const scriptDir = __dirname;
  const hasStacks = AVAILABLE_STACKS.some((s) =>
    fs.existsSync(path.join(scriptDir, s))
  );

  if (hasStacks && !opts.remote) {
    return { sourceDir: scriptDir, tempDir: null };
  }

  const remoteUrl = opts.remote || DEFAULT_REMOTE_URL;
  if (opts.remote) {
    console.log(`Cloning from remote: ${remoteUrl}`);
  } else {
    console.log(`Stack directories not found locally. Cloning from: ${remoteUrl}`);
  }

  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.error('Error: git is required for remote installs but was not found on PATH.');
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hyperworker-'));
  try {
    execSync(`git clone --depth 1 "${remoteUrl}" "${tempDir}"`, {
      stdio: 'inherit',
    });
  } catch {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.error('Error: Failed to clone remote repository.');
    process.exit(1);
  }

  return { sourceDir: tempDir, tempDir };
}

// ---------------------------------------------------------------------------
// Step functions
// ---------------------------------------------------------------------------

/**
 * Prompt the user to select a stack, or use the --stack flag value.
 *
 * When --stack is provided via CLI, the prompt is skipped and the value is
 * validated directly.  In --yes (non-interactive) mode without --stack, an
 * error is raised so that CI pipelines always get a deterministic choice.
 * Otherwise an interactive numbered menu is presented via Node's readline.
 */
async function selectStack(opts, sourceDir) {
  if (opts.stack) {
    const stackDir = path.join(sourceDir, opts.stack);
    if (!fs.existsSync(stackDir)) {
      console.error(`Error: Stack directory not found: ${stackDir}`);
      process.exit(1);
    }
    console.log(`Selected stack: ${opts.stack}`);
    return opts.stack;
  }

  if (opts.yes) {
    console.error('Error: --yes mode requires --stack to be specified explicitly.');
    process.exit(1);
  }

  const availableStacks = AVAILABLE_STACKS.filter((s) =>
    fs.existsSync(path.join(sourceDir, s))
  );

  if (availableStacks.length === 0) {
    console.error('Error: No stack directories found in source directory.');
    process.exit(1);
  }

  const { rl, ask } = createPrompt();

  console.log('Which stack would you like to install?\n');
  availableStacks.forEach((name, idx) => {
    console.log(`  [${idx + 1}] ${name.charAt(0).toUpperCase() + name.slice(1)}`);
  });
  console.log();

  try {
    while (true) {
      const answer = (await ask('Enter selection (number): ')).trim();

      const num = parseInt(answer, 10);
      if (!isNaN(num) && num >= 1 && num <= availableStacks.length) {
        const selected = availableStacks[num - 1];
        console.log(`\nSelected stack: ${selected}`);
        return selected;
      }

      if (availableStacks.includes(answer.toLowerCase())) {
        const selected = answer.toLowerCase();
        console.log(`\nSelected stack: ${selected}`);
        return selected;
      }

      console.log(
        `Invalid selection "${answer}". Please enter a number (1-${availableStacks.length}) or a stack name.`
      );
    }
  } finally {
    rl.close();
  }
}

/**
 * Copy skill files from the source stack into the target project.
 *
 * Walks each skill directory under <sourceDir>/<stack>/.claude/skills/ and
 * copies it into <targetDir>/.claude/skills/.  When a file already exists at
 * the target, the user is prompted to skip, overwrite, or view a diff.
 *
 * In --yes mode, conflicting files are auto-skipped (non-destructive default).
 * In --dry-run mode, no files are written and a preview is printed instead.
 */
async function installSkills(opts, sourceDir, stack, targetDir) {
  const skillsSrc = path.join(sourceDir, stack, '.claude', 'skills');
  const skillsDst = path.join(targetDir, '.claude', 'skills');

  if (!fs.existsSync(skillsSrc)) {
    console.log('No skills directory found in source stack. Skipping skill installation.');
    return { installed: [], skipped: [] };
  }

  const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (skillDirs.length === 0) {
    console.log('No skill directories found. Skipping skill installation.');
    return { installed: [], skipped: [] };
  }

  console.log(`\nInstalling skills from ${stack} stack...`);

  if (!opts.dryRun) {
    fs.mkdirSync(skillsDst, { recursive: true });
  }

  const filesToProcess = [];
  for (const dir of skillDirs) {
    const srcDir = path.join(skillsSrc, dir);
    for (const relPath of walkDir(srcDir)) {
      filesToProcess.push({
        relativePath: path.join(dir, relPath),
        srcPath: path.join(srcDir, relPath),
        dstPath: path.join(skillsDst, dir, relPath),
      });
    }
  }

  const installed = [];
  const skipped = [];

  // Only create readline for interactive conflict resolution
  const needsPrompt = !opts.dryRun && !opts.yes;
  const prompt = needsPrompt ? createPrompt() : null;

  try {
    for (const file of filesToProcess) {
      const exists = fs.existsSync(file.dstPath);

      if (opts.dryRun) {
        if (exists) {
          console.log(`  [DRY RUN] CONFLICT: ${file.relativePath} (would skip — file exists)`);
          skipped.push(file.relativePath);
        } else {
          console.log(`  [DRY RUN] COPY: ${file.relativePath}`);
          installed.push(file.relativePath);
        }
        continue;
      }

      if (!exists) {
        fs.mkdirSync(path.dirname(file.dstPath), { recursive: true });
        fs.cpSync(file.srcPath, file.dstPath, { recursive: true });
        console.log(`  Installed: ${file.relativePath}`);
        installed.push(file.relativePath);
        continue;
      }

      if (opts.yes) {
        console.log(`  Skipped (exists): ${file.relativePath}`);
        skipped.push(file.relativePath);
        continue;
      }

      // Interactive conflict resolution
      let resolved = false;
      while (!resolved) {
        const answer = (
          await prompt.ask(`  File exists: ${file.relativePath} — [s]kip / [o]verwrite / [d]iff? `)
        ).trim().toLowerCase();

        switch (answer) {
          case 's':
          case 'skip':
            console.log(`  Skipped: ${file.relativePath}`);
            skipped.push(file.relativePath);
            resolved = true;
            break;

          case 'o':
          case 'overwrite':
            fs.cpSync(file.srcPath, file.dstPath, { recursive: true });
            console.log(`  Overwritten: ${file.relativePath}`);
            installed.push(file.relativePath);
            resolved = true;
            break;

          case 'd':
          case 'diff': {
            try {
              execSync(
                `diff -u "${file.dstPath}" "${file.srcPath}"`,
                { encoding: 'utf8' }
              );
              console.log('\n  Files are identical.\n');
            } catch (e) {
              if (e.stdout) {
                console.log(`\n${e.stdout}`);
              } else {
                console.log('\n  Could not generate diff.\n');
              }
            }
            break;
          }

          default:
            console.log('  Please enter s (skip), o (overwrite), or d (diff).');
            break;
        }
      }
    }
  } finally {
    if (prompt) {
      prompt.rl.close();
    }
  }

  console.log(`\nSkills summary: ${installed.length} installed, ${skipped.length} skipped.`);
  if (installed.length > 0) {
    console.log('  Installed:');
    installed.forEach((f) => console.log(`    - ${f}`));
  }
  if (skipped.length > 0) {
    console.log('  Skipped:');
    skipped.forEach((f) => console.log(`    - ${f}`));
  }

  return { installed, skipped };
}

/**
 * Recursively walk a directory and return relative file paths.
 */
function walkDir(dir, prefix = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      results.push(...walkDir(path.join(dir, entry.name), relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

/**
 * Reverse-merge a settings JSON file into a target settings JSON file.
 *
 * Reads source JSON, reads target JSON (handling missing/empty/invalid),
 * performs reverseMerge (target wins, source fills gaps), prints a
 * before/after diff, and writes atomically.
 *
 * @param {object} opts - Parsed CLI options.
 * @param {string} sourcePath - Path to the source settings JSON file.
 * @param {string} targetPath - Path to the target settings JSON file.
 * @param {string} label - Human-readable label for log messages (e.g. "Project settings").
 */
async function mergeSettings(opts, sourcePath, targetPath, label) {
  console.log(`\nMerging ${label.toLowerCase()}...`);

  if (!fs.existsSync(sourcePath)) {
    console.log(`  No source found at ${sourcePath} — skipping.`);
    return SKIP_RESULT;
  }

  let sourceSettings;
  try {
    sourceSettings = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (err) {
    console.error(`  Error: Could not parse source at ${sourcePath}: ${err.message}`);
    process.exit(1);
  }

  // Read target settings, handling missing/empty/invalid JSON
  let targetSettings = {};
  let targetWasEmpty = true;

  if (fs.existsSync(targetPath)) {
    const raw = fs.readFileSync(targetPath, 'utf8');

    if (raw.trim() === '') {
      console.log(`  Warning: ${targetPath} is empty.`);
    } else {
      try {
        targetSettings = JSON.parse(raw);
        targetWasEmpty = false;
      } catch (parseErr) {
        const shouldOverwrite = await promptOverwriteInvalidJson(opts, targetPath, parseErr);
        if (!shouldOverwrite) {
          return SKIP_RESULT;
        }
      }
    }
  }

  const merged = reverseMerge(targetSettings, sourceSettings);

  const beforeJson = JSON.stringify(targetSettings, null, 2);
  const afterJson = JSON.stringify(merged, null, 2);

  if (beforeJson === afterJson) {
    console.log(`  ${label} already up to date — no changes needed.`);
    return { added: [], unchanged: Object.keys(targetSettings), status: 'unchanged' };
  }

  const { added, changed, unchanged } = computeKeyChanges(targetSettings, merged);
  const mergedExisting = changed.filter((k) => !added.includes(k));

  console.log(`\n  ${label} changes (${path.basename(targetPath)}):`);
  if (added.length > 0) {
    console.log(`    Keys added:     ${added.join(', ')}`);
  }
  if (mergedExisting.length > 0) {
    console.log(`    Keys merged:    ${mergedExisting.join(', ')}`);
  }
  if (unchanged.length > 0 || targetWasEmpty) {
    console.log(`    Keys preserved: ${unchanged.length > 0 ? unchanged.join(', ') : '(none — new file)'}`);
  }

  printJsonBlock('Before', beforeJson, targetWasEmpty, '(file did not exist or was empty)');
  printJsonBlock('After', afterJson, false, '');
  console.log();

  if (opts.dryRun) {
    console.log(`  [DRY RUN] Would write merged settings to ${path.basename(targetPath)}`);
    return { added, unchanged, status: 'dry-run' };
  }

  writeJsonAtomic(targetPath, merged);

  if (targetWasEmpty) {
    console.log(`  Created ${targetPath}`);
  } else {
    console.log(`  Updated ${targetPath}`);
  }

  return { added, unchanged, status: 'updated' };
}

/**
 * Add /plans to .gitignore if not already present.
 * Skips if the target directory is not a git repository.
 */
async function updateGitignore(opts, targetDir) {
  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    console.warn('Warning: Target directory is not a git repository. Skipping .gitignore update.');
    return { status: 'skipped', reason: 'not a git repo' };
  }

  const gitignorePath = path.join(targetDir, '.gitignore');
  const entry = '/plans';
  const existingContent = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf8')
    : null;

  if (existingContent !== null && existingContent.split('\n').some((line) => line === entry)) {
    console.log('.gitignore already contains /plans — no changes needed.');
    return { status: 'already-present' };
  }

  // Build the new content: either append to existing or create fresh
  let newContent;
  let action;
  if (existingContent !== null) {
    const needsNewline = existingContent.length > 0 && !existingContent.endsWith('\n');
    newContent = existingContent + (needsNewline ? '\n' : '') + entry + '\n';
    action = 'appended';
  } else {
    newContent = entry + '\n';
    action = 'created';
  }

  if (opts.dryRun) {
    if (action === 'appended') {
      console.log('[DRY RUN] Would append /plans to .gitignore');
      return { status: 'dry-run', action: 'would append' };
    }
    console.log('[DRY RUN] Would create .gitignore with /plans');
    return { status: 'dry-run', action: 'would create' };
  }

  fs.writeFileSync(gitignorePath, newContent, 'utf8');
  if (action === 'appended') {
    console.log('Appended /plans to .gitignore');
    return { status: 'updated', action: 'appended' };
  }
  console.log('Created .gitignore with /plans');
  return { status: 'created', action: 'created' };
}

/**
 * Print a summary of all changes made during installation.
 */
function printSummary(opts, results) {
  const { skills, projectSettings, userSettings, gitignore } = results;

  console.log('\n' + '='.repeat(60));
  console.log(opts.dryRun ? '  DRY RUN SUMMARY — no files were written' : '  INSTALLATION SUMMARY');
  console.log('='.repeat(60));

  // Skills
  console.log('\n  Skills:');
  if (skills.installed.length === 0 && skills.skipped.length === 0) {
    console.log('    (none found)');
  } else {
    console.log(`    ${skills.installed.length} installed, ${skills.skipped.length} skipped`);
  }

  // Settings (project and user share the same display logic)
  printSettingsSummary('Project settings (.claude/settings.json)', projectSettings);
  printSettingsSummary('User settings (~/.claude/settings.json)', userSettings);

  // Gitignore
  console.log('\n  .gitignore:');
  switch (gitignore.status) {
    case 'already-present':
      console.log('    Already contains /plans — no changes');
      break;
    case 'updated':
    case 'created':
      console.log(`    ${gitignore.action === 'appended' ? 'Appended' : 'Created with'} /plans`);
      break;
    case 'dry-run':
      console.log(`    ${gitignore.action}`);
      break;
    case 'skipped':
      console.log(`    Skipped (${gitignore.reason || 'n/a'})`);
      break;
    default:
      console.log(`    ${gitignore.status}`);
  }

  console.log('\n' + '='.repeat(60));

  if (!opts.dryRun) {
    console.log('\n  Next steps:');
    console.log('    1. Start a tmux session: tmux new -s dev');
    console.log('    2. Run Claude Code: claude');
    console.log('    3. Try creating a PRD: /prd');
    console.log();
  }
}

function printSettingsSummary(label, settings) {
  console.log(`\n  ${label}:`);
  if (settings.status === 'skipped') {
    console.log('    Skipped');
  } else if (settings.status === 'unchanged') {
    console.log(`    Already up to date (${settings.unchanged.length} keys unchanged)`);
  } else {
    const added = settings.added.length;
    const unchanged = settings.unchanged.length;
    console.log(`    ${added} key${added !== 1 ? 's' : ''} added, ${unchanged} key${unchanged !== 1 ? 's' : ''} unchanged`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.dryRun) {
    console.log('=== DRY RUN MODE — no files will be written ===\n');
  }

  const { sourceDir, tempDir } = resolveSource(opts);

  try {
    const targetDir = opts.target;
    console.log(`Source:  ${sourceDir}`);
    console.log(`Target:  ${targetDir}`);
    console.log();

    const stack = await selectStack(opts, sourceDir);

    const skillsResult = await installSkills(opts, sourceDir, stack, targetDir);

    const projectSettingsResult = await mergeSettings(
      opts,
      path.join(sourceDir, stack, 'settings.json'),
      path.join(targetDir, '.claude', 'settings.json'),
      'Project settings'
    );

    const userSettingsResult = await mergeSettings(
      opts,
      path.join(sourceDir, stack, 'user-settings.json'),
      path.join(os.homedir(), '.claude', 'settings.json'),
      'User settings'
    );

    const gitignoreResult = await updateGitignore(opts, targetDir);

    printSummary(opts, {
      skills: skillsResult,
      projectSettings: projectSettingsResult,
      userSettings: userSettingsResult,
      gitignore: gitignoreResult,
    });

    console.log('\nInstallation complete.');
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('Cleaned up temporary directory.');
      } catch {
        console.warn(`Warning: Could not clean up temp directory: ${tempDir}`);
      }
    }
  }
}

// Run
main().then(
  () => process.exit(0),
  (err) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
);
