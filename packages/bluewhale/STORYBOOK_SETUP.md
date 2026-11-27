# Storybook 8 Setup Complete ✓

## Overview

Successfully configured Storybook 8 with Vite builder for the Bluewhale UI components, including comprehensive stories for all AddressInput variants and automated interaction testing.

## What Was Added

### 1. Storybook Configuration
- **`.storybook/main.ts`**: Main configuration with Vite builder and addons
  - Storybook React Vite framework
  - Essential addons (controls, actions, docs, viewport, backgrounds)
  - Interactions addon for user interaction testing
  - A11y addon for accessibility testing
  - Auto-documentation enabled

- **`.storybook/preview.ts`**: Global preview settings
  - Component styles imported (components.css, theme.css)
  - Background controls (light/dark)
  - Control matchers for color and date props

- **`.storybook/test-runner.ts`**: Test runner with accessibility checks
  - Automated axe-playwright accessibility tests
  - Runs on every story

### 2. Stories

**`src/AddressInput.stories.tsx`** - Comprehensive story catalog including:

#### Basic Variants
- **Default**: Empty component state with interaction test
- **GAddress**: Classic G-address with memo field visibility test
- **MAddress**: Muxed M-address with memo field hidden test
- **CAddress**: Contract address showing error warning test

#### Feature Stories
- **MemoWarning**: Demonstrates memo-ignored warning for M-address + memo
- **WithCopyButtons**: Copy button functionality with interaction test
- **ValidationCallback**: Real-time validation callback demo with interaction test
- **CustomStyling**: Custom className and style prop examples
- **DarkMode**: Dark theme variant with custom CSS

#### Gallery Stories
- **ErrorStates**: Comprehensive error state gallery (invalid checksum, contract, too short)
- **AllVariants**: Side-by-side comparison of all address types

### 3. CI Integration

**`.github/workflows/ci-storybook.yml`**:
- Builds Storybook on push/PR
- Runs interaction tests with Playwright
- Performs accessibility checks
- Uploads test results on failure
- Includes commented Chromatic setup for visual regression testing

### 4. Package Updates

**`package.json`** updated with:

#### New Dependencies
```json
"@storybook/addon-a11y": "^8.5.0"
"@storybook/addon-essentials": "^8.5.0"
"@storybook/addon-interactions": "^8.5.0"
"@storybook/react": "^8.5.0"
"@storybook/react-vite": "^8.5.0"
"@storybook/test": "^8.5.0"
"@storybook/test-runner": "^0.21.0"
"axe-playwright": "^2.0.3"
"storybook": "^8.5.0"
"vite": "^6.0.7"
```

#### New Scripts
```json
"storybook": "storybook dev -p 6006"
"build-storybook": "storybook build"
"test-storybook": "test-storybook"
```

### 5. Documentation

- **`.storybook/README.md`**: Complete setup and usage guide
- **`STORYBOOK_SETUP.md`**: This file - implementation summary

### 6. Gitignore Updates

Added Storybook artifacts to `.gitignore`:
- `storybook-static/` - Build output
- `test-results/` - Test artifacts

## Key Features Implemented

### ✅ Storybook 8 with Vite Builder
- Fast HMR (Hot Module Replacement)
- Modern build tooling
- Optimized for React 19

### ✅ Comprehensive Story Coverage
- All address variants (G, M, C)
- All error states (invalid checksum, contract, validation)
- All features (copy buttons, callbacks, styling, dark mode)
- Interactive galleries and comparisons

### ✅ Automated Interaction Testing
Each story includes `play` functions that:
- Simulate user interactions (typing, clicking)
- Assert expected UI behavior
- Verify component state changes
- Test accessibility with axe-core

### ✅ CI Integration Ready
- GitHub Actions workflow configured
- Automated testing on push/PR
- Optional Chromatic visual testing (commented, ready to enable)

## Usage

### Local Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start Storybook dev server
cd packages/bluewhale
pnpm storybook

# View at http://localhost:6006
```

### Run Tests Locally

```bash
# Start Storybook first
pnpm storybook

# In another terminal
pnpm test-storybook
```

### Build for Production

```bash
pnpm build-storybook
# Output in storybook-static/
```

## Next Steps (Optional)

### Enable Chromatic Visual Regression Testing

1. Sign up at https://www.chromatic.com/
2. Install: `pnpm add -D chromatic`
3. Add secret `CHROMATIC_PROJECT_TOKEN` to GitHub
4. Uncomment Chromatic job in `.github/workflows/ci-storybook.yml`
5. Add script: `"chromatic": "chromatic --exit-zero-on-changes"`

### Extend Stories

Add stories for other components:
- `TypeBadge.stories.tsx`
- `WarningList.stories.tsx`
- `MemoField.stories.tsx`

## Migration Notes

### From Ladle to Storybook

The original Ladle stories in `src/stories/AddressInput.stories.tsx` have been converted to Storybook format in `src/AddressInput.stories.tsx`. Key differences:

| Aspect | Ladle | Storybook 8 |
|--------|-------|-------------|
| Import | `@ladle/react` | `@storybook/react` |
| Story type | `Story` | `StoryObj<typeof meta>` |
| Config | Implicit | Explicit `meta` object |
| Interactions | Manual | `play` functions with `@storybook/test` |
| A11y | Manual | Built-in with addon |

The old Ladle setup remains functional if needed. To fully migrate:
- Remove `@ladle/react` from devDependencies
- Delete `src/stories/` directory
- Remove `ladle` script from package.json

## Acceptance Criteria Met

✅ Configure Storybook 8 with Vite builder in `packages/bluewhale`  
✅ Add stories for all address variants (G, M, C) and error states  
✅ Wire test-runner into CI (`.github/workflows/ci-storybook.yml`)  
✅ Files created: `.storybook/main.ts`, `src/AddressInput.stories.tsx`  
✅ Bonus: Interaction tests with `play` functions  
✅ Bonus: Accessibility testing with axe-playwright  
✅ Bonus: Chromatic setup ready (commented in CI)  

## Testing the Implementation

```bash
# 1. Install dependencies
pnpm install

# 2. Start Storybook
cd packages/bluewhale
pnpm storybook

# 3. Verify stories load at http://localhost:6006
# 4. Test interactions in Canvas tab
# 5. Check a11y results in Accessibility panel
# 6. Run tests (in separate terminal)
pnpm test-storybook
```

## File Tree

```
packages/bluewhale/
├── .storybook/
│   ├── main.ts              # Storybook 8 config with Vite
│   ├── preview.ts           # Global styles and parameters
│   ├── test-runner.ts       # A11y test configuration
│   └── README.md            # Setup documentation
├── src/
│   ├── AddressInput.stories.tsx  # Main stories file (NEW)
│   └── stories/             # Old Ladle stories (kept for reference)
│       └── AddressInput.stories.tsx
├── package.json             # Updated with Storybook deps
└── STORYBOOK_SETUP.md       # This file
```

---

**Implementation Date**: November 23, 2026  
**Storybook Version**: 8.5.0  
**Framework**: React 19 + Vite 6
