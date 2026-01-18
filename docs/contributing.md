# Contributing to DeployNet

First off, thank you for considering contributing to DeployNet! It's people like you that make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make will benefit everybody else and are greatly appreciated.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read it before contributing.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for DeployNet. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- Use a clear and descriptive title for the issue
- Describe the exact steps which reproduce the problem
- Provide specific examples to demonstrate the steps
- Include screenshots and animated GIFs if possible
- Explain which behavior you expected to see instead and why

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for DeployNet, including completely new features and minor improvements to existing functionality.

- Use a clear and descriptive title for the issue
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the steps
- Describe the current behavior and explain which behavior you expected to see instead
- Explain why this enhancement would be useful to most DeployNet users

### Your First Code Contribution

Unsure where to begin contributing to DeployNet? You can start by looking through these `beginner` and `help-wanted` issues:

- [Beginner issues](https://github.com/princetheprogrammerbtw/deploy-net/issues?q=is%3Aopen+is%3Aissue+label%3Abeginner) - issues which should only require a few lines of code
- [Help wanted issues](https://github.com/princetheprogrammerbtw/deploy-net/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) - issues which should be a bit more involved than `beginner` issues

### Pull Requests

The process described here has several goals:

- Maintain DeployNet's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible DeployNet
- Enable a sustainable system for DeployNet's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in [the template](.github/PULL_REQUEST_TEMPLATE.md)
2. After you submit your pull request, verify that all status checks are passing
3. Participate in the code review process

## Style Guides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- When only changing documentation, include `[ci skip]` in the commit title

### Conventional Commits

DeployNet follows [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

Examples:
- `feat: add WebRTC connection pooling`
- `fix(signaling): resolve memory leak in peer management`
- `docs: update API reference for client initialization`

### JavaScript Style Guide

- Use 2 spaces for indentation
- Use semicolons
- Use camelCase for variables and functions
- Use PascalCase for constructors and classes
- Prefer const over let, let over var
- Use arrow functions where appropriate
- Use template literals instead of string concatenation

### Go Style Guide

- Follow [Effective Go](https://golang.org/doc/effective_go.html) guidelines
- Use `gofmt` for formatting
- Use `golint` for linting
- Write idiomatic Go code
- Include comments for exported functions/types
- Use meaningful variable names

### Documentation Style Guide

- Use Markdown for documentation
- Use [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/)
- Write in American English
- Use second person ("you") to address the reader
- Use active voice when possible

## Development Setup

1. Fork the repository
2. Clone your fork
3. Create a branch for your changes
4. Make your changes
5. Test your changes
6. Commit your changes using conventional commits
7. Push your branch to your fork
8. Open a pull request

### Prerequisites

- Go 1.21+
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/deploy-net.git
cd deploy-net

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm run test
```

### Running Locally

```bash
# Start the signaling server
go run cmd/signaling-server/main.go

# Serve the client
npm run serve
```

## Testing

All pull requests must have adequate test coverage. We use:

- Unit tests for individual functions
- Integration tests for component interactions
- End-to-end tests for user workflows

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/unit/

# Run with coverage
npm run test:coverage
```

## Community

- Join our Discord server for discussions
- Follow us on Twitter for updates
- Subscribe to our newsletter for monthly updates

## Recognition

All contributors are recognized in our [README](README.md) and in release notes. Major contributors may be invited to join the core team.

Thank you for your interest in contributing to DeployNet!