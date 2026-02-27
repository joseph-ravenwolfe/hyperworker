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
  console.log(`Stack directories not found locally. Cloning from: ${remoteUrl}`);

  // Verify git is available
  try {
    execSync('which git', { stdio: 'ignore' });
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
// Placeholder step functions (to be implemented in later stories)
// ---------------------------------------------------------------------------

/**
 * Prompt the user to select a stack, or use the --stack flag value.
 * HW-09-02 will implement the interactive prompt.
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

  // Placeholder: default to first available stack until HW-09-02 implements the prompt
  console.log('[TODO] Interactive stack selection not yet implemented.');
  console.log(`Defaulting to: ${AVAILABLE_STACKS[0]}`);
  return AVAILABLE_STACKS[0];
}

/**
 * Copy skill files from the source stack into the target project.
 * HW-09-03 will implement conflict resolution.
 */
async function installSkills(opts, sourceDir, stack, targetDir) {
  console.log('[TODO] installSkills: will be implemented in HW-09-03');
}

/**
 * Reverse-merge project-level settings.json into target's .claude/settings.json.
 * HW-09-05 will implement the merge logic (using the utility from HW-09-04).
 */
async function mergeProjectSettings(opts, sourceDir, stack, targetDir) {
  console.log('[TODO] mergeProjectSettings: will be implemented in HW-09-05');
}

/**
 * Reverse-merge user-level settings into ~/.claude/settings.json.
 * HW-09-06 will implement the merge logic (using the utility from HW-09-04).
 */
async function mergeUserSettings(opts, sourceDir, stack) {
  console.log('[TODO] mergeUserSettings: will be implemented in HW-09-06');
}

/**
 * Add /plans to .gitignore if not already present.
 * HW-09-07 will implement this.
 */
async function updateGitignore(opts, targetDir) {
  console.log('[TODO] updateGitignore: will be implemented in HW-09-07');
}

/**
 * Print a summary of all changes made during installation.
 * HW-09-09 will implement the full summary.
 */
function printSummary(opts) {
  console.log('[TODO] printSummary: will be implemented in HW-09-09');
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
    await installSkills(opts, sourceDir, stack, targetDir);

    // Step 3: Merge project-level settings
    await mergeProjectSettings(opts, sourceDir, stack, targetDir);

    // Step 4: Merge user-level settings
    await mergeUserSettings(opts, sourceDir, stack);

    // Step 5: Update .gitignore
    await updateGitignore(opts, targetDir);

    // Step 6: Print summary
    printSummary(opts);

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
