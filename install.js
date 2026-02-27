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

// ---------------------------------------------------------------------------
// Reverse-merge utility
// ---------------------------------------------------------------------------

/**
 * Determine whether a value is a plain object (not an array, null, Date, etc.).
 */
function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Merge `source` into `target` using reverse-merge semantics.
 *
 * - Source values fill in gaps but never overwrite existing target values.
 * - Scalars: keep target's value if it exists (not null/undefined), else use source's.
 * - Objects: recursively merge, keeping target's values where keys conflict.
 * - Arrays: append unique entries from source not already in target (set-union,
 *   exact string comparison, preserve order).
 *
 * Both arguments are left unmodified; a new object is returned.
 *
 * @param {object|null|undefined} target - The target object (takes priority).
 * @param {object|null|undefined} source - The source object (fills gaps).
 * @returns {object} The merged result.
 */
function reverseMerge(target, source) {
  // Handle null/undefined edge cases
  if (target == null && source == null) return {};
  if (target == null) return JSON.parse(JSON.stringify(source));
  if (source == null) return JSON.parse(JSON.stringify(target));

  const result = {};

  // Start with all keys from both objects
  const allKeys = new Set([...Object.keys(target), ...Object.keys(source)]);

  for (const key of allKeys) {
    const tVal = target[key];
    const sVal = source[key];

    if (Array.isArray(tVal) && Array.isArray(sVal)) {
      // Arrays: set-union — append unique entries from source not in target
      result[key] = [...tVal, ...sVal.filter((v) => !tVal.includes(v))];
    } else if (isPlainObject(tVal) && isPlainObject(sVal)) {
      // Objects: recurse
      result[key] = reverseMerge(tVal, sVal);
    } else if (tVal !== undefined && tVal !== null) {
      // Scalars: keep target if it exists (not null/undefined)
      result[key] = tVal;
    } else {
      // Target missing or null — use source value (deep copy to avoid mutation)
      result[key] = sVal !== undefined && sVal !== null && typeof sVal === 'object'
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
  const args = argv.slice(2); // skip node and script path
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
        // --remote can be used with or without a URL value
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
  // Explicit --source takes highest priority
  if (opts.source) {
    if (!fs.existsSync(opts.source)) {
      console.error(`Error: Source directory does not exist: ${opts.source}`);
      process.exit(1);
    }
    return { sourceDir: opts.source, tempDir: null };
  }

  // Check if stack dirs exist relative to the script (local clone scenario)
  const scriptDir = __dirname;
  const hasStacks = AVAILABLE_STACKS.some((s) =>
    fs.existsSync(path.join(scriptDir, s))
  );

  if (hasStacks && !opts.remote) {
    return { sourceDir: scriptDir, tempDir: null };
  }

  // Fall back to remote clone
  const remoteUrl = opts.remote || DEFAULT_REMOTE_URL;
  if (opts.remote) {
    console.log(`Cloning from remote: ${remoteUrl}`);
  } else {
    console.log(`Stack directories not found locally. Cloning from: ${remoteUrl}`);
  }

  // Verify git is available (use git --version for cross-platform compatibility)
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
    // Clean up on clone failure
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
  // --- Fast path: --stack provided via CLI flag ---
  if (opts.stack) {
    const stackDir = path.join(sourceDir, opts.stack);
    if (!fs.existsSync(stackDir)) {
      console.error(`Error: Stack directory not found: ${stackDir}`);
      process.exit(1);
    }
    console.log(`Selected stack: ${opts.stack}`);
    return opts.stack;
  }

  // --- Non-interactive mode requires an explicit --stack value ---
  if (opts.yes) {
    console.error('Error: --yes mode requires --stack to be specified explicitly.');
    process.exit(1);
  }

  // --- Build the list of stacks whose directories actually exist ---
  const availableStacks = AVAILABLE_STACKS.filter((s) =>
    fs.existsSync(path.join(sourceDir, s))
  );

  if (availableStacks.length === 0) {
    console.error('Error: No stack directories found in source directory.');
    process.exit(1);
  }

  // --- Interactive prompt via readline ---
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Helper: prompt once and return the answer
  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  console.log('Which stack would you like to install?\n');
  availableStacks.forEach((name, idx) => {
    console.log(`  [${idx + 1}] ${name.charAt(0).toUpperCase() + name.slice(1)}`);
  });
  console.log();

  try {
    // Keep asking until we get a valid selection
    while (true) {
      const answer = (await ask('Enter selection (number): ')).trim();

      // Accept a valid number
      const num = parseInt(answer, 10);
      if (!isNaN(num) && num >= 1 && num <= availableStacks.length) {
        const selected = availableStacks[num - 1];
        console.log(`\nSelected stack: ${selected}`);
        return selected;
      }

      // Accept a valid stack name typed directly
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

  // Verify source skills directory exists
  if (!fs.existsSync(skillsSrc)) {
    console.log('No skills directory found in source stack. Skipping skill installation.');
    return { installed: [], skipped: [] };
  }

  // Discover skill directories (each direct child of skillsSrc)
  const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (skillDirs.length === 0) {
    console.log('No skill directories found. Skipping skill installation.');
    return { installed: [], skipped: [] };
  }

  console.log(`\nInstalling skills from ${stack} stack...`);

  // Ensure target .claude/skills/ exists (unless dry-run)
  if (!opts.dryRun) {
    fs.mkdirSync(skillsDst, { recursive: true });
  }

  // Collect all files to process: { relativePath, srcPath, dstPath }
  const filesToProcess = [];
  for (const dir of skillDirs) {
    const srcDir = path.join(skillsSrc, dir);
    const entries = walkDir(srcDir);
    for (const relPath of entries) {
      filesToProcess.push({
        relativePath: path.join(dir, relPath),
        srcPath: path.join(srcDir, relPath),
        dstPath: path.join(skillsDst, dir, relPath),
      });
    }
  }

  // Track results for summary
  const installed = [];
  const skipped = [];

  // Set up readline only if we need interactive prompts
  let rl = null;
  let ask = null;
  if (!opts.dryRun && !opts.yes) {
    const readline = require('readline');
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    ask = (question) => new Promise((resolve) => rl.question(question, resolve));
  }

  try {
    for (const file of filesToProcess) {
      const exists = fs.existsSync(file.dstPath);

      // --- Dry-run mode ---
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

      // --- No conflict: copy directly ---
      if (!exists) {
        const dstDir = path.dirname(file.dstPath);
        fs.mkdirSync(dstDir, { recursive: true });
        fs.cpSync(file.srcPath, file.dstPath, { recursive: true });
        console.log(`  Installed: ${file.relativePath}`);
        installed.push(file.relativePath);
        continue;
      }

      // --- Conflict exists ---
      if (opts.yes) {
        // Non-interactive: auto-skip conflicts
        console.log(`  Skipped (exists): ${file.relativePath}`);
        skipped.push(file.relativePath);
        continue;
      }

      // --- Interactive conflict resolution ---
      let resolved = false;
      while (!resolved) {
        const answer = (
          await ask(`  File exists: ${file.relativePath} — [s]kip / [o]verwrite / [d]iff? `)
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
              const diff = execSync(
                `diff -u "${file.dstPath}" "${file.srcPath}"`,
                { encoding: 'utf8' }
              );
              // diff returns exit code 0 when files are identical
              console.log('\n  Files are identical.\n');
            } catch (e) {
              // diff returns exit code 1 when files differ (not a real error)
              if (e.stdout) {
                console.log(`\n${e.stdout}`);
              } else {
                console.log('\n  Could not generate diff.\n');
              }
            }
            // Re-prompt (don't set resolved)
            break;
          }

          default:
            console.log('  Please enter s (skip), o (overwrite), or d (diff).');
            break;
        }
      }
    }
  } finally {
    if (rl) {
      rl.close();
    }
  }

  // --- Summary ---
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
function walkDir(dir, prefix) {
  prefix = prefix || '';
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
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
 * Reverse-merge project-level settings.json into target's .claude/settings.json.
 *
 * Reads the source stack's settings.json and reverse-merges it into the
 * target project's .claude/settings.json.  Source fills gaps; target values
 * are always preserved.  Uses atomic write (temp file + rename) for safety.
 *
 * For invalid/empty JSON in the target: warns and asks to overwrite or skip.
 * In --yes mode, invalid target JSON is skipped (never silently overwritten).
 */
async function mergeProjectSettings(opts, sourceDir, stack, targetDir) {
  const sourcePath = path.join(sourceDir, stack, 'settings.json');
  const claudeDir = path.join(targetDir, '.claude');
  const targetPath = path.join(claudeDir, 'settings.json');

  console.log('\nMerging project settings...');

  // --- Read source settings ---
  if (!fs.existsSync(sourcePath)) {
    console.log(`  No source settings.json found at ${sourcePath} — skipping.`);
    return { added: [], unchanged: [], status: 'skipped' };
  }

  let sourceSettings;
  try {
    sourceSettings = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (err) {
    console.error(`  Error: Could not parse source settings.json at ${sourcePath}: ${err.message}`);
    process.exit(1);
  }

  // --- Read target settings (or create if missing) ---
  let targetSettings = null;
  let targetExists = fs.existsSync(targetPath);
  let targetWasEmpty = false;

  if (targetExists) {
    const raw = fs.readFileSync(targetPath, 'utf8');
    try {
      targetSettings = JSON.parse(raw);
    } catch (err) {
      // Invalid JSON in target — warn and ask
      console.warn(`  Warning: Invalid JSON in ${targetPath}: ${err.message}`);

      if (opts.yes) {
        // Non-interactive: skip to avoid destroying user data
        console.log('  --yes mode: skipping project settings merge (invalid target JSON).');
        return { added: [], unchanged: [], status: 'skipped' };
      }

      // Interactive: ask user whether to overwrite or skip
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const ask = (question) =>
        new Promise((resolve) => rl.question(question, resolve));

      try {
        const answer = (
          await ask('  Overwrite with hyperworker defaults? (y/N): ')
        ).trim().toLowerCase();

        if (answer === 'y' || answer === 'yes') {
          // Treat target as empty — source becomes the full result
          targetSettings = {};
          console.log('  Overwriting invalid target settings.');
        } else {
          console.log('  Skipping project settings merge.');
          return { added: [], unchanged: [], status: 'skipped' };
        }
      } finally {
        rl.close();
      }
    }
  } else {
    // Target file does not exist — start from empty
    targetSettings = {};
    targetWasEmpty = true;
  }

  // --- Perform reverse merge ---
  const merged = reverseMerge(targetSettings, sourceSettings);

  // --- Before/after summary ---
  const beforeJson = JSON.stringify(targetSettings, null, 2);
  const afterJson = JSON.stringify(merged, null, 2);

  if (beforeJson === afterJson) {
    console.log('  Project settings already up to date — no changes needed.');
    return { added: [], unchanged: Object.keys(targetSettings), status: 'unchanged' };
  }

  // Compute key-level change summary
  const projBeforeKeys = Object.keys(targetSettings);
  const projAfterKeys = Object.keys(merged);
  const projAddedKeys = projAfterKeys.filter((k) => !projBeforeKeys.includes(k));
  const projChangedKeys = projAfterKeys.filter((k) => {
    return JSON.stringify(targetSettings[k]) !== JSON.stringify(merged[k]);
  });
  const projUnchangedKeys = projBeforeKeys.filter((k) => !projChangedKeys.includes(k));

  console.log('\n  Project settings changes (.claude/settings.json):');
  console.log('  --- Before ---');
  if (targetWasEmpty) {
    console.log('    (file did not exist)');
  } else {
    beforeJson.split('\n').forEach((line) => console.log(`    ${line}`));
  }
  console.log('  --- After ---');
  afterJson.split('\n').forEach((line) => console.log(`    ${line}`));
  console.log();

  // --- Dry-run: stop here ---
  if (opts.dryRun) {
    console.log('  [DRY RUN] Would write merged settings to .claude/settings.json');
    return { added: projAddedKeys, unchanged: projUnchangedKeys, status: 'dry-run' };
  }

  // --- Ensure .claude/ directory exists ---
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // --- Atomic write: temp file + rename ---
  const content = JSON.stringify(merged, null, 2) + '\n';
  const tmpPath = path.join(claudeDir, `.settings.json.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }

  console.log('  Wrote merged settings to .claude/settings.json');
  return { added: projAddedKeys, unchanged: projUnchangedKeys, status: 'updated' };
}

/**
 * Reverse-merge user-level settings into ~/.claude/settings.json.
 *
 * - Reads the source user-settings.json from `<sourceDir>/<stack>/user-settings.json`.
 * - Reads the target ~/.claude/settings.json (creates ~/.claude/ dir if needed).
 * - Applies reverseMerge so that existing user values are preserved and only
 *   missing keys are filled in from the source.
 * - Handles invalid/empty JSON: warns and asks to overwrite or skip (--yes skips).
 * - Writes the result atomically (temp file + rename).
 * - In --dry-run mode, prints what would change without writing.
 * - Prints a before/after summary of changes made.
 */
async function mergeUserSettings(opts, sourceDir, stack) {
  const sourceSettingsPath = path.join(sourceDir, stack, 'user-settings.json');
  const claudeDir = path.join(os.homedir(), '.claude');
  const targetSettingsPath = path.join(claudeDir, 'settings.json');

  console.log('\nMerging user settings...');

  // --- Read source user-settings.json ---
  if (!fs.existsSync(sourceSettingsPath)) {
    console.log(`  No user-settings.json found at ${sourceSettingsPath} — skipping.`);
    return { added: [], unchanged: [], status: 'skipped' };
  }

  let sourceSettings;
  try {
    sourceSettings = JSON.parse(fs.readFileSync(sourceSettingsPath, 'utf8'));
  } catch (err) {
    console.error(`  Error: Could not parse source user-settings.json: ${err.message}`);
    process.exit(1);
  }

  // --- Ensure ~/.claude/ directory exists ---
  if (!fs.existsSync(claudeDir)) {
    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would create directory: ${claudeDir}`);
    } else {
      fs.mkdirSync(claudeDir, { recursive: true });
      console.log(`  Created directory: ${claudeDir}`);
    }
  }

  // --- Read target ~/.claude/settings.json ---
  let targetSettings = null;
  let targetRaw = null;
  let targetExisted = false;
  let targetWasEmpty = false;

  if (fs.existsSync(targetSettingsPath)) {
    targetExisted = true;
    targetRaw = fs.readFileSync(targetSettingsPath, 'utf8');

    if (targetRaw.trim() === '') {
      // Empty file — treat as no existing settings
      console.log(`  Warning: ${targetSettingsPath} is empty.`);
      targetSettings = {};
      targetWasEmpty = true;
    } else {
      try {
        targetSettings = JSON.parse(targetRaw);
      } catch (parseErr) {
        // Invalid JSON — prompt to overwrite or skip
        console.warn(`  Warning: ${targetSettingsPath} contains invalid JSON: ${parseErr.message}`);

        if (opts.yes) {
          console.log('  --yes mode: skipping user settings merge (invalid target JSON).');
          return { added: [], unchanged: [], status: 'skipped' };
        }

        // Interactive prompt: ask to overwrite or skip
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const ask = (question) =>
          new Promise((resolve) => rl.question(question, resolve));

        try {
          const answer = (
            await ask('  Overwrite with hyperworker defaults? (y/N): ')
          ).trim().toLowerCase();

          if (answer === 'y' || answer === 'yes') {
            targetSettings = {};
            console.log('  Overwriting invalid settings file.');
          } else {
            console.log('  Skipping user settings merge.');
            return { added: [], unchanged: [], status: 'skipped' };
          }
        } finally {
          rl.close();
        }
      }
    }
  } else {
    targetSettings = {};
    targetWasEmpty = true;
  }

  // --- Reverse-merge: target wins, source fills gaps ---
  const merged = reverseMerge(targetSettings, sourceSettings);

  // --- Before/after summary ---
  const beforeJson = JSON.stringify(targetSettings, null, 2);
  const afterJson = JSON.stringify(merged, null, 2);

  if (beforeJson === afterJson) {
    console.log('  User settings already up to date — no changes needed.');
    return { added: [], unchanged: Object.keys(targetSettings), status: 'unchanged' };
  }

  // Compute key-level change summary
  const beforeKeys = Object.keys(targetSettings);
  const afterKeys = Object.keys(merged);
  const addedKeys = afterKeys.filter((k) => !beforeKeys.includes(k));
  const changedKeys = afterKeys.filter((k) => {
    return JSON.stringify(targetSettings[k]) !== JSON.stringify(merged[k]);
  });
  const mergedExistingKeys = changedKeys.filter((k) => !addedKeys.includes(k));
  const preservedKeys = beforeKeys.filter((k) => !changedKeys.includes(k));

  console.log(`\n  User settings changes (~/.claude/settings.json):`);
  if (addedKeys.length > 0) {
    console.log(`    Keys added:     ${addedKeys.join(', ')}`);
  }
  if (mergedExistingKeys.length > 0) {
    console.log(`    Keys merged:    ${mergedExistingKeys.join(', ')}`);
  }
  console.log(`    Keys preserved: ${preservedKeys.length > 0 ? preservedKeys.join(', ') : '(none — new file)'}`);

  console.log('  --- Before ---');
  if (targetWasEmpty) {
    console.log('    (file did not exist or was empty)');
  } else {
    beforeJson.split('\n').forEach((line) => console.log(`    ${line}`));
  }
  console.log('  --- After ---');
  afterJson.split('\n').forEach((line) => console.log(`    ${line}`));
  console.log();

  // --- Dry run: stop here ---
  if (opts.dryRun) {
    console.log('  [DRY RUN] Would write merged settings to ~/.claude/settings.json');
    return { added: addedKeys, unchanged: preservedKeys, status: 'dry-run' };
  }

  // --- Atomic write: temp file + rename ---
  const content = JSON.stringify(merged, null, 2) + '\n';
  const tmpPath = path.join(claudeDir, `.settings.json.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, targetSettingsPath);
  } catch (writeErr) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    console.error(`  Error: Failed to write user settings: ${writeErr.message}`);
    process.exit(1);
  }

  if (targetExisted && !targetWasEmpty) {
    console.log(`  Updated ${targetSettingsPath}`);
  } else {
    console.log(`  Created ${targetSettingsPath}`);
  }

  return { added: addedKeys, unchanged: preservedKeys, status: 'updated' };
}

/**
 * Check if the target directory is a git repository, warn if not.
 * Add /plans to .gitignore if not already present.
 */
async function updateGitignore(opts, targetDir) {
  // Check if target is a git repository
  const gitDir = path.join(targetDir, '.git');
  const isGitRepo = fs.existsSync(gitDir);
  if (!isGitRepo) {
    console.warn('Warning: Target directory is not a git repository. Skipping .gitignore update.');
    return { status: 'skipped', reason: 'not a git repo' };
  }

  const gitignorePath = path.join(targetDir, '.gitignore');
  const entry = '/plans';

  // Check if .gitignore exists
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n');

    // Check for exact line match
    if (lines.some((line) => line === entry)) {
      console.log('.gitignore already contains /plans — no changes needed.');
      return { status: 'already-present' };
    }

    // Append /plans
    if (opts.dryRun) {
      console.log('[DRY RUN] Would append /plans to .gitignore');
      return { status: 'dry-run', action: 'would append' };
    } else {
      // Ensure we start on a new line if file doesn't end with one
      const suffix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(gitignorePath, content + suffix + entry + '\n', 'utf8');
      console.log('Appended /plans to .gitignore');
      return { status: 'updated', action: 'appended' };
    }
  } else {
    // Create .gitignore with /plans
    if (opts.dryRun) {
      console.log('[DRY RUN] Would create .gitignore with /plans');
      return { status: 'dry-run', action: 'would create' };
    } else {
      fs.writeFileSync(gitignorePath, entry + '\n', 'utf8');
      console.log('Created .gitignore with /plans');
      return { status: 'created', action: 'created' };
    }
  }
}

/**
 * Print a summary of all changes made during installation.
 *
 * Collects results from each step (skills, project settings, user settings,
 * gitignore) and formats a clean summary output.  After a real install,
 * also prints "next steps" guidance.
 *
 * @param {object}  opts            - The parsed CLI options.
 * @param {object}  results         - Result objects from each step.
 * @param {object}  results.skills  - { installed: string[], skipped: string[] }
 * @param {object}  results.projectSettings - { added: string[], unchanged: string[], status: string }
 * @param {object}  results.userSettings    - { added: string[], unchanged: string[], status: string }
 * @param {object}  results.gitignore       - { status: string, action?: string, reason?: string }
 */
function printSummary(opts, results) {
  const { skills, projectSettings, userSettings, gitignore } = results;

  console.log('\n' + '='.repeat(60));
  if (opts.dryRun) {
    console.log('  DRY RUN SUMMARY — no files were written');
  } else {
    console.log('  INSTALLATION SUMMARY');
  }
  console.log('='.repeat(60));

  // --- Skills ---
  console.log('\n  Skills:');
  const newCount = skills.installed.length;
  const skipCount = skills.skipped.length;
  if (newCount === 0 && skipCount === 0) {
    console.log('    (none found)');
  } else {
    console.log(`    ${newCount} installed, ${skipCount} skipped`);
  }

  // --- Project settings ---
  console.log('\n  Project settings (.claude/settings.json):');
  if (projectSettings.status === 'skipped') {
    console.log('    Skipped');
  } else if (projectSettings.status === 'unchanged') {
    console.log(`    Already up to date (${projectSettings.unchanged.length} keys unchanged)`);
  } else {
    const pAdded = projectSettings.added.length;
    const pUnchanged = projectSettings.unchanged.length;
    console.log(`    ${pAdded} key${pAdded !== 1 ? 's' : ''} added, ${pUnchanged} key${pUnchanged !== 1 ? 's' : ''} unchanged`);
  }

  // --- User settings ---
  console.log('\n  User settings (~/.claude/settings.json):');
  if (userSettings.status === 'skipped') {
    console.log('    Skipped');
  } else if (userSettings.status === 'unchanged') {
    console.log(`    Already up to date (${userSettings.unchanged.length} keys unchanged)`);
  } else {
    const uAdded = userSettings.added.length;
    const uUnchanged = userSettings.unchanged.length;
    console.log(`    ${uAdded} key${uAdded !== 1 ? 's' : ''} added, ${uUnchanged} key${uUnchanged !== 1 ? 's' : ''} unchanged`);
  }

  // --- Gitignore ---
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

  // --- Next steps (only after a real install, not dry-run) ---
  if (!opts.dryRun) {
    console.log('\n  Next steps:');
    console.log('    1. Start a tmux session: tmux new -s dev');
    console.log('    2. Run Claude Code: claude');
    console.log('    3. Try creating a PRD: /prd');
    console.log();
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

  // Resolve the source directory (local or remote)
  const { sourceDir, tempDir } = resolveSource(opts);

  try {
    const targetDir = opts.target;
    console.log(`Source:  ${sourceDir}`);
    console.log(`Target:  ${targetDir}`);
    console.log();

    // Step 1: Select stack
    const stack = await selectStack(opts, sourceDir);

    // Step 2: Install skill files
    const skillsResult = await installSkills(opts, sourceDir, stack, targetDir);

    // Step 3: Merge project-level settings
    const projectSettingsResult = await mergeProjectSettings(opts, sourceDir, stack, targetDir);

    // Step 4: Merge user-level settings
    const userSettingsResult = await mergeUserSettings(opts, sourceDir, stack);

    // Step 5: Update .gitignore
    const gitignoreResult = await updateGitignore(opts, targetDir);

    // Step 6: Print summary
    printSummary(opts, {
      skills: skillsResult || { installed: [], skipped: [] },
      projectSettings: projectSettingsResult || { added: [], unchanged: [], status: 'skipped' },
      userSettings: userSettingsResult || { added: [], unchanged: [], status: 'skipped' },
      gitignore: gitignoreResult || { status: 'skipped' },
    });

    console.log('\nInstallation complete.');
  } finally {
    // Clean up temp directory if we cloned from remote
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
