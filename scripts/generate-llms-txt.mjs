#!/usr/bin/env node
/**
 * Generates llms.txt, llms-full.txt, and SKILL.md from README.md
 * Following the llmstxt.org specification
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read source files
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const readme = readFileSync(join(rootDir, 'README.md'), 'utf8');

// Extract first paragraph from README (after badges)
function extractSummary(content) {
  const lines = content.split('\n');
  let inBadges = true;
  let summary = [];

  for (const line of lines) {
    // Skip title and badges
    if (line.startsWith('#') || line.startsWith('[![') || line.trim() === '') {
      if (!inBadges && line.trim() === '' && summary.length > 0) break;
      continue;
    }
    inBadges = false;
    summary.push(line);
    if (summary.length >= 2) break;
  }

  return summary.join(' ').trim();
}

// === SKILL.md Generation ===

/**
 * Extract a section from markdown by heading pattern
 * Returns content between the matched heading and the next heading of same or higher level
 */
function extractSection(content, headingPattern, options = {}) {
  const { level = 2 } = options;
  const levelPattern = '#'.repeat(level);
  const regex = new RegExp(
    `^${levelPattern}\\s+${headingPattern}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,${level}}\\s|$)`,
    'mi'
  );
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract code blocks from a section
 */
function extractCodeBlocks(section, lang = null) {
  const pattern = lang
    ? new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``, 'g')
    : /```(\w+)?\n([\s\S]*?)```/g;

  const blocks = [];
  let match;
  while ((match = pattern.exec(section)) !== null) {
    blocks.push(lang ? match[1].trim() : { lang: match[1] || 'text', code: match[2].trim() });
  }
  return blocks;
}

/**
 * Extract markdown table from section
 */
function extractTable(section) {
  const tableRegex = /\|[^\n]+\|\n\|[-:|\s]+\|\n(\|[^\n]+\|\n?)*/;
  const match = section.match(tableRegex);
  return match ? match[0].trim() : '';
}

/**
 * Build the SKILL.md content from README
 */
function buildSkillMd(readmeContent, pkgInfo) {
  // AI-optimized description
  const description =
    'A lightweight Custom Elements library with fast built-in render core. Use this skill when helping developers create reactive web components with signals, templates, and SSR support.';

  // Extract install section - just npm install line
  const installSection = extractSection(readmeContent, 'Install', { level: 2 });
  const installBlocks = extractCodeBlocks(installSection, 'bash');
  const npmInstall = installBlocks[0]?.split('\n').find((l) => l.includes('npm install')) || 'npm install hyper-element';

  // Extract ES6 import
  const es6Section = extractSection(readmeContent, 'ES6 Modules', { level: 3 });
  const es6Blocks = extractCodeBlocks(es6Section, 'js');
  const importStatement = es6Blocks[0] || "import hyperElement from 'hyper-element';";

  // Build Examples section - curated for AI consumption
  const examples = `### Functional API (Recommended)

\`\`\`js
// Simple component
hyperElement('my-greeting', (Html, ctx) => Html\`
  <div>Hello \${ctx.attrs.name}!</div>
\`);

// Component with state
hyperElement('my-counter', {
  setup: (ctx, onNext) => {
    const store = { count: 0 };
    const render = onNext(() => store);
    ctx.increment = () => { store.count++; render(); };
  },
  handleClick: (ctx) => ctx.increment(),
  render: (Html, ctx, store) => Html\`
    <button onclick=\${ctx.handleClick}>
      Count: \${store?.count ?? 0}
    </button>
  \`
});
\`\`\`

### Class-based API

\`\`\`js
import { hyperElement } from 'hyper-element';

class MyElement extends hyperElement {
  render(Html) {
    Html\`<div>Hello \${this.attrs.name}!</div>\`;
  }
}
customElements.define('my-element', MyElement);
\`\`\`

### Template Syntax

\`\`\`js
// Iteration
Html\`<ul>{+each \${items}}<li>{name}</li>{-each}</ul>\`;

// Conditionals
Html\`{+if \${isLoggedIn}}<p>Welcome!</p>{else}<p>Please login</p>{-if}\`;

// Negation
Html\`{+unless \${hasErrors}}<p>Valid</p>{-unless}\`;

// Index access
Html\`<ol>{+each \${items}}<li>{@}: {title}</li>{-each}</ol>\`;
\`\`\`

### Signals (Reactive State)

\`\`\`js
import { signal, computed, effect, batch } from 'hyper-element';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => console.log('Count:', count.value));

count.value = 5; // Triggers effect, doubled.value = 10

// Batch multiple updates
batch(() => {
  firstName.value = 'Jane';
  lastName.value = 'Smith';
}); // Effects run once after batch
\`\`\`

### SSR (Server-Side Rendering)

\`\`\`js
import { renderElement } from 'hyper-element/ssr/server';

const html = await renderElement('my-card', {
  attrs: { name: 'Alice' },
  store: { role: 'Admin' },
  render: (Html, ctx) => Html\`
    <div class="card">
      <h2>\${ctx.attrs.name}</h2>
      <span>\${ctx.store.role}</span>
    </div>
  \`
});
\`\`\`

### Passing Functions to Child Elements

\`\`\`js
hyperElement('parent-elem', {
  handleAction: (ctx, value) => console.log('Action:', value),
  render: (Html, ctx) => Html\`
    <child-elem onaction=\${ctx.handleAction} />
  \`
});
\`\`\`

### External Store Integration (Redux/MobX/Backbone)

\`\`\`js
setup(attachStore) {
  store.subscribe(attachStore(store.getState));
}
\`\`\``;

  // Extract Context Object table from README
  const contextSection = extractSection(readmeContent, 'Context Object', { level: 2 });
  let contextTable = extractTable(contextSection);

  // If no table found, use default
  if (!contextTable) {
    contextTable = `| Property | Description |
|----------|-------------|
| \`ctx.attrs\` | Parsed attributes with automatic type coercion |
| \`ctx.dataset\` | Dataset proxy with automatic JSON parsing |
| \`ctx.store\` | Store value from setup |
| \`ctx.element\` | DOM element reference |
| \`ctx.wrappedContent\` | Text content between tags |`;
  } else {
    // Simplify the table for SKILL.md (ctx. prefix)
    contextTable = `| Property | Description |
|----------|-------------|
| \`ctx.attrs\` | Parsed attributes with automatic type coercion |
| \`ctx.dataset\` | Dataset proxy with automatic JSON parsing |
| \`ctx.store\` | Store value from setup |
| \`ctx.element\` | DOM element reference |
| \`ctx.wrappedContent\` | Text content between tags |`;
  }

  // Guidelines - curated best practices
  const guidelines = `- Use \`Html.wire(obj, ':id')\` for rendering arrays - ensures efficient DOM reuse
- Prefer functional API over class-based for simpler components
- Use signals (signal, computed, effect) for reactive state outside components
- Return cleanup function from \`setup()\` for resources that need disposal
- Use \`batch()\` when updating multiple signals to trigger effects once`;

  // Anti-Patterns - critical mistakes to avoid
  const antiPatterns = `- **NEVER** inline HTML strings in maps - creates XSS vulnerability and poor performance:
  \`\`\`js
  // BAD - XSS risk!
  Html\`<ul>\${users.map(u => \`<li>\${u.name}</li>\`)}</ul>\`;

  // GOOD - Safe and efficient
  Html\`<ul>\${users.map(u => Html.wire(u, ':item')\`<li>\${u.name}</li>\`)}</ul>\`;
  \`\`\`

- **NEVER** mutate dataset objects directly - use assignment:
  \`\`\`js
  // BAD - mutation doesn't trigger update
  this.dataset.user.name = 'Alice';

  // GOOD - assignment triggers update
  this.dataset.user = { name: 'Alice' };
  \`\`\``;

  return `---
name: ${pkgInfo.name}
description: ${description}
---

# ${pkgInfo.name}

A zero-dependency library for creating reactive Custom Elements. Components automatically re-render when attributes or store data changes with efficient DOM updates.

## Installation

\`\`\`bash
${npmInstall}
\`\`\`

\`\`\`js
${importStatement}
\`\`\`

## Examples

${examples}

## Context Properties

${contextTable}

## Guidelines

${guidelines}

## Anti-Patterns

${antiPatterns}
`;
}

const summary = extractSummary(readme);
const repoUrl = 'https://github.com/codemeasandwich/hyper-element';

// Generate concise llms.txt (per llmstxt.org spec)
const llmsTxt = `# hyper-element

> ${pkg.description}

${summary}

## Documentation

- [README](${repoUrl}#readme): Complete documentation with API reference
- [TypeScript](${repoUrl}/blob/master/index.d.ts): Type definitions
- [Examples](https://jsfiddle.net/codemeasandwich/k25e6ufv/): Live interactive demos
- [SKILL.md](${repoUrl}/blob/master/SKILL.md): AI agent instructions

## Optional

- [npm](https://www.npmjs.com/package/hyper-element): Package page
- [GitHub](${repoUrl}): Source code and issues
`;

// Generate full llms-full.txt (complete README)
const llmsFullTxt = `# hyper-element

${readme}`;

// Generate SKILL.md
const skillMd = buildSkillMd(readme, pkg);

// Write output files
writeFileSync(join(rootDir, 'llms.txt'), llmsTxt);
writeFileSync(join(rootDir, 'llms-full.txt'), llmsFullTxt);
writeFileSync(join(rootDir, 'SKILL.md'), skillMd);

console.log('Generated llms.txt, llms-full.txt, and SKILL.md');
console.log(`  llms.txt: ${llmsTxt.length} bytes`);
console.log(`  llms-full.txt: ${llmsFullTxt.length} bytes`);
console.log(`  SKILL.md: ${skillMd.length} bytes`);
