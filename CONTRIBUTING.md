# Contributing to Bluewhale

First off, thank you for considering contributing to the Bluewhale! It's people like you that make the Stellar ecosystem a better place for developers.

### How Can I Contribute?

#### Adding Spec Vectors
The most impactful way to contribute is by adding new test vectors to `spec/vectors.json`. If you find an edge case or a tricky address format, follow these steps:
1. Add the case to `spec/vectors.json`.
2. Run `node spec/validate.js` to ensure it meets the schema.
3. Update the TypeScript, Go, and Dart implementations to pass the new vector.

#### Deprecating or Changing Public Behavior
Renaming, removing, or changing the behavior of an exported API, warning code, error code, or test vector must follow the [Deprecation Policy](docs/spec/deprecation-policy.mdx). In short:
*   Deprecations are announced in a **minor** release, in TypeScript, Go, and Dart at the same time.
*   Deprecated items stay supported for at least **two minor releases and 180 days**.
*   Removal only happens in the next **major** release, together with a major `spec_version` bump.

#### Reporting Bugs
*   Check the [Issues](https://github.com/REDISHFISH/BLUEWHALE/issues) to see if the bug has already been reported.
*   If not, open a new issue with a clear title and description, including steps to reproduce the bug.

#### Suggesting Enhancements
*   Open an issue to discuss your idea.
*   Clearly explain why this enhancement would be useful to others.

#### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation. Breaking or deprecating changes must follow the [Deprecation Policy](docs/spec/deprecation-policy.mdx).
4. Ensure the test suite passes (`pnpm test`, `go test ./...`, `dart test`).
5. Use `pnpm changeset` to document your changes.

### Development Setup

```bash
# Install dependencies
pnpm install

# Run the spec validator
node spec/validate.js

# Run tests across all packages
pnpm test
```

### Style Guide
*   **TypeScript**: Follow the existing Prettier/ESLint config.
*   **Go**: Run `go fmt` before committing.
*   **Dart**: Run `dart format` before committing.

### Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
