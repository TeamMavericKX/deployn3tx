# DeployNet Conventional Commits Guide

## Overview

DeployNet follows the [Conventional Commits](https://www.conventionalcommits.org/) specification to create a consistent and automated changelog. This guide explains how to properly format commit messages for the DeployNet project.

## Commit Format

Each commit message consists of a header, body, and footer (optional):

```
<type>(<scope>): <short summary>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### Header

The header is mandatory and consists of three parts:

1. **Type** - Required, describes the kind of change
2. **Scope** - Optional, provides additional contextual information
3. **Summary** - Required, short description of the change

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add WebRTC connection pooling` |
| `fix` | Bug fix | `fix: resolve memory leak in peer management` |
| `docs` | Documentation only changes | `docs: update API reference for client` |
| `style` | Formatting changes | `style: fix indentation in signaling server` |
| `refactor` | Code restructuring | `refactor: extract peer connection logic` |
| `perf` | Performance improvements | `perf: optimize cache lookup algorithm` |
| `test` | Adding or modifying tests | `test: add unit tests for content cache` |
| `build` | Build system changes | `build: update webpack configuration` |
| `ci` | CI configuration changes | `ci: add woodpecker pipeline` |
| `chore` | Other changes | `chore: update dependencies` |
| `revert` | Reverting previous commits | `revert: undo previous cache change` |

### Scopes

Common scopes for DeployNet:

- `client` - Client-side JavaScript code
- `signaling` - Signaling server (Go)
- `webrtc` - WebRTC specific functionality
- `cache` - Content caching system
- `routing` - Content routing algorithms
- `security` - Security-related changes
- `docs` - Documentation
- `tests` - Test files
- `build` - Build system
- `ci` - CI/CD configuration

### Summary Guidelines

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize the first letter
- No period at the end
- Limit to 72 characters or less
- Be specific and descriptive

## Examples

### Good Commit Messages

```
feat(client): add WebRTC connection pooling

Implements connection pooling to reduce overhead of establishing
new peer connections. Pool maintains up to 5 idle connections per
peer and reuses them when possible.

Resolves #123
```

```
fix(signaling): resolve race condition in message broadcast

Fixed a race condition that could cause messages to be sent
to disconnected peers. Added mutex locking around broadcast
operations in the hub.

Fixes #456
```

```
docs(api): update client initialization parameters

Clarified the required and optional parameters for client
initialization. Added examples for different configuration
scenarios.

See: docs/client-api.md
```

```
perf(cache): optimize content lookup performance

Replaced linear search with hash map lookup for cache entries.
Results in O(1) lookup time instead of O(n).

Performance improved by 40% for cache hits.
```

### Bad Commit Messages

```
fixed bug
```

```
update stuff in client code
```

```
more changes
```

```
feat: add new thing #123
```

## Body Guidelines

- Use the imperative mood ("change" not "changed" or "changes")
- Include motivation for the change
- Compare with previous behavior if applicable
- Wrap at 72 characters
- Separate paragraphs with blank lines

## Footer Guidelines

### Breaking Changes

Breaking changes should start with `BREAKING CHANGE:` followed by a space and a description:

```
feat: change client API

BREAKING CHANGE: The initialize() method now requires explicit
configuration object instead of accepting individual parameters.
```

### Referencing Issues

Reference issues using keywords:

```
Closes #123
Fixes #456
Resolves #789
```

## Commit Templates

### VS Code Template

Add to `.vscode/settings.json`:

```json
{
  "emmet.includeLanguages": {
    "plaintext": "git-commit"
  }
}
```

Then create `.gitmessage` template:

```
# <type>(<scope>): <subject>
# Example: feat(client): add connection pooling
#
# Type: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
# Scope: client|signaling|webrtc|cache|routing|security|docs|tests|build|ci
#
# Remember:
# - Use imperative mood
# - No capitalization in subject
# - No period at the end
# - Limit subject to 72 chars
#
# Body (explain WHAT and WHY, not HOW):
#
# Issue references (if any):
# Closes/Fixes/Resolves #
```

### Git Template

Set as default template:

```bash
git config commit.template .gitmessage
```

## Automated Tools

### Commitizen

Install and use Commitizen for guided commits:

```bash
npm install -g commitizen cz-conventional-changelog
echo '{ "path": "cz-conventional-changelog" }' > .czrc
```

### Husky Pre-commit Hook

Create `.husky/commit-msg`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx commitlint --edit $1
```

### Commitlint Configuration

Create `commitlint.config.js`:

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'build',
      'chore',
      'ci',
      'docs',
      'feat',
      'fix',
      'perf',
      'refactor',
      'revert',
      'style',
      'test'
    ]],
    'scope-enum': [2, 'always', [
      'client',
      'signaling',
      'webrtc',
      'cache',
      'routing',
      'security',
      'docs',
      'tests',
      'build',
      'ci'
    ]],
    'header-max-length': [2, 'always', 72]
  }
};
```

## Best Practices

### Writing Good Commits

1. **Single Responsibility**: Each commit should address one concern
2. **Logical Units**: Group related changes together
3. **Descriptive Messages**: Explain the "why" not just the "what"
4. **Consistency**: Follow the same patterns across the team
5. **Atomic Changes**: Keep commits focused and coherent

### Review Checklist

Before committing, verify:

- [ ] Type is appropriate for the change
- [ ] Scope is accurate (if applicable)
- [ ] Summary follows imperative mood
- [ ] Summary is < 72 characters
- [ ] Body explains the change (if complex)
- [ ] Breaking changes are marked properly
- [ ] Issues are referenced appropriately

### Common Mistakes to Avoid

- Using past tense ("added", "fixed")
- Capitalizing the first letter of summary
- Adding periods to summary
- Making commits too large
- Mixing different types of changes
- Not explaining breaking changes
- Using unclear or vague language

## Examples by Type

### Feature Commits

```
feat(client): implement content caching mechanism

Adds client-side content caching with configurable size limits.
Implements LRU eviction policy and content integrity verification.

Resolves #789
```

### Fix Commits

```
fix(webrtc): handle connection timeout gracefully

Connection attempts now properly time out after 10 seconds and
fall back to alternative peers. Previously connections would hang
indefinitely.

Fixes #101
```

### Documentation Commits

```
docs: add detailed deployment guide

Complete guide covering standalone and Docker deployments,
including SSL configuration and production best practices.

See: docs/deployment/
```

### Performance Commits

```
perf(routing): optimize peer selection algorithm

Replaced linear peer scanning with indexed lookup structure.
Improves peer selection from O(n) to O(log n) time complexity.

Performance improvement: 60% faster peer discovery
```

## Impact on Changelog Generation

Proper conventional commits enable automated changelog generation:

- `feat` → Features section
- `fix` → Bug Fixes section  
- `perf` → Performance Improvements section
- Breaking changes → Breaking Changes section
- Other types → Miscellaneous section

This creates a clear, organized changelog that users can easily understand.

---

*Follow this guide to maintain consistency across the DeployNet codebase and enable automated release processes.*