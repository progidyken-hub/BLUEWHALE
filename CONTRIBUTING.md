# Contributing to Bluewhale

First off, thank you for considering contributing to Bluewhale! It's people like you that make the Stellar ecosystem a better place for developers.

## Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Commit Message Convention](#commit-message-convention)
- [Signed Commits & Branch Protection](#signed-commits--branch-protection)
- [Changeset Workflow](#changeset-workflow)
- [Style Guide](#style-guide)
- [Code of Conduct](#code-of-conduct)

---

## How Can I Contribute?

### Adding Spec Vectors
The most impactful way to contribute is by adding new test vectors to `spec/vectors.json`. If you find an edge case or a tricky address format, follow these steps:
1. Add the case to `spec/vectors.json`.
2. Run `node spec/validate.js` to ensure it meets the schema.
3. Update the TypeScript, Go, and Dart implementations to pass the new vector.

### Reporting Bugs
- Check the [Issues](https://github.com/REDISHFISH/BLUEWHALE/issues) to see if the bug has already been reported.
- If not, open a new issue with a clear title and description, including steps to reproduce the bug.

### Suggesting Enhancements
- Open an issue to discuss your idea.
- Clearly explain why this enhancement would be useful to others.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes (`pnpm test`, `go test ./...`, `dart test`).
5. Follow the [Commit Message Convention](#commit-message-convention).
6. Run `pnpm changeset` to document your changes before opening a PR.

---

## Development Setup

```bash
# Install dependencies
pnpm install

# Run the spec validator
node spec/validate.js

# Run tests across all packages
pnpm test                                  # TypeScript
cd packages/core-go && go test ./...       # Go
cd packages/core-dart && dart test         # Dart
```

---

## Commit Message Convention

All commits and **pull request titles** must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Format

```
<type>(optional-scope): <short description>
```

The `type` must be one of:

| Type       | When to use                                              |
| ---------- | -------------------------------------------------------- |
| `feat`     | A new feature                                            |
| `fix`      | A bug fix                                                |
| `docs`     | Documentation-only changes                               |
| `style`    | Formatting, whitespace — no logic change                 |
| `refactor` | Code change that is neither a fix nor a feature          |
| `perf`     | Performance improvement                                  |
| `test`     | Adding or updating tests                                 |
| `build`    | Build system or external dependency changes              |
| `ci`       | CI/CD configuration changes                              |
| `chore`    | Maintenance tasks (bumping versions, updating lockfiles) |

### Examples

```
feat(core-ts): add M-address round-trip validation
fix(core-go): handle overflow in 64-bit routing ID
docs: update quickstart guide
ci: add Codecov upload to ci-ts workflow
chore: bump pnpm to v9
```

> **PR titles are linted automatically** via the `Lint PR Title` GitHub Actions workflow. A PR with a non-conforming title will fail the check and must be corrected before merging.

---

## Signed Commits & Branch Protection

Bluewhale's core deposit-routing libraries handle sensitive financial data. To protect the integrity of the `main` branch, **all commits merged into `main` must be cryptographically signed** with a GPG or SSH key, and **merge commits are not permitted** (the branch enforces a linear history).

The `commit-lint.yml` CI workflow automatically enforces both requirements on every PR. A PR with unsigned commits or merge commits will fail the check and cannot be merged until corrected.

### Setting up GPG commit signing

1. Generate a GPG key (if you don't have one):

   ```bash
   gpg --full-generate-key
   ```

2. Export the public key and [add it to your GitHub account](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account):

   ```bash
   gpg --armor --export <KEY_ID>
   ```

3. Tell Git to sign all commits automatically:

   ```bash
   git config --global user.signingkey <KEY_ID>
   git config --global commit.gpgsign true
   ```

### Setting up SSH commit signing (alternative)

1. [Add an SSH key to your GitHub account](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) if you haven't already.
2. Configure Git to use SSH signing:

   ```bash
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub   # adjust path as needed
   git config --global commit.gpgsign true
   ```

### Keeping a linear history

Do not merge `main` into your feature branch. Instead, rebase:

```bash
git fetch origin
git rebase origin/main
```

If you have already pushed commits that need to be rebased, use a force-push onto your own feature branch:

```bash
git push --force-with-lease origin <your-branch>
```

### Branch protection requirements for `main`

| Requirement                        | Enforced by                      |
| ---------------------------------- | -------------------------------- |
| All commits GPG/SSH signed         | `commit-lint.yml` CI check       |
| No merge commits (linear history)  | `commit-lint.yml` CI check       |
| At least 1 approving review        | GitHub branch protection rules   |
| All CI checks must pass            | GitHub branch protection rules   |
| No direct pushes to `main`         | GitHub branch protection rules   |

---

## Changeset Workflow

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR that changes user-facing behaviour (features, fixes, or breaking changes) **must include a changeset**.

### Creating a changeset

```bash
pnpm changeset
```

The interactive prompt will ask:
1. **Which packages** are affected (`@redishfish/bluewhale-core`, `core-go`, `core-dart`, …).
2. **Bump type** — `patch` for bug fixes, `minor` for new features, `major` for breaking changes.
3. **Summary** — a one-line description that will appear in the changelog.

A new file is added under `.changeset/`. Commit it along with your code changes.

### What happens on merge to `main`

The `Release` GitHub Actions workflow (`.github/workflows/release.yml`) runs on every push to `main`:

- If unreleased changesets exist, it opens (or updates) a **"Version Packages"** PR that bumps all affected package versions and updates their `CHANGELOG.md` files.
- When that PR is merged, the workflow **publishes** the new versions to the npm registry and creates **GitHub Releases** with the generated changelogs.

### When you don't need a changeset

Skip `pnpm changeset` for changes that don't affect published packages:
- CI/CD workflow changes
- Documentation-only changes
- Internal tooling / scripts
- Test-only changes

---

## Deprecation and Versioning

When changing or removing a feature, warning code, or error code, follow the [multi-language deprecation policy](docs/spec/deprecation-policy.mdx). Deprecations must land in the TypeScript, Go, and Dart SDKs together.

---

## Style Guide

- **TypeScript**: Follow the existing Prettier/ESLint config.
- **Go**: Run `go fmt` before committing.
- **Dart**: Run `dart format` before committing.

---

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
