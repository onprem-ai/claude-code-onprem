# Contributing to claude-code-onprem

Thanks for your interest in contributing! This project is community-driven and we welcome contributions.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/claude-code-onprem.git`
3. Install dependencies: `npm install`
4. Build: `npm run build`
5. Run tests: `npm test`

## Development

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm test           # Run tests
npm run test:run   # Run tests once (no watch)
```

## Branching

We use feature branches off `main`:

```
main (always releasable)
  └── feat/add-xyz
  └── fix/issue-123
```

Branch naming: `feat/`, `fix/`, `docs/`, `chore/`

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update README
chore: update dependencies
refactor: restructure code
test: add tests
```

Optional scope: `feat(cli): add uninstall prompt`

## Making Changes

1. Create a branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Run tests: `npm run test:run`
4. Commit using conventional commits
5. Push and open a Pull Request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation if needed
- Ensure all tests pass

## Reporting Issues

- Check existing issues first
- Include steps to reproduce
- Include your environment (OS, Node version, etc.)

## Code Style

- TypeScript with strict mode
- Use existing patterns in the codebase
- Keep it simple

## Versioning & Releases

We use [Semantic Versioning](https://semver.org/):

- `v1.0.0` - Major: breaking changes
- `v1.1.0` - Minor: new features (backwards compatible)
- `v1.1.1` - Patch: bug fixes

Releases (maintainers only):

```bash
npm run release:patch  # bug fixes
npm run release:minor  # new features
npm run release:major  # breaking changes
npm publish
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
