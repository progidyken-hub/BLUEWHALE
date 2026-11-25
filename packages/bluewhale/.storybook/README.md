# Storybook Configuration

This directory contains the Storybook 8 configuration for the Bluewhale UI components.

## Configuration Files

- **main.ts**: Main Storybook configuration with Vite builder, addons, and story discovery
- **preview.ts**: Global preview settings, decorators, and default parameters
- **test-runner.ts**: Test runner configuration with accessibility testing via axe-playwright

## Available Scripts

```bash
# Start Storybook dev server on port 6006
npm run storybook

# Build static Storybook for deployment
npm run build-storybook

# Run interaction and accessibility tests
npm run test-storybook
```

## Features

### Addons Included

1. **@storybook/addon-essentials**: Core addons bundle including:
   - Controls: Interactive component props
   - Actions: Event handler spy
   - Docs: Auto-generated documentation
   - Viewport: Responsive testing
   - Backgrounds: Background color switching
   - Toolbars: Custom toolbar items

2. **@storybook/addon-interactions**: Play function testing for user interactions

3. **@storybook/addon-a11y**: Accessibility testing and reporting

### Stories

All stories are located in `../src/**/*.stories.tsx` and cover:

- **Default**: Empty component state
- **GAddress**: Classic G-address with memo field
- **MAddress**: Muxed M-address with encoded routing ID
- **CAddress**: Contract address (error state)
- **MemoWarning**: Memo ignored warning demonstration
- **WithCopyButtons**: Copy button functionality
- **ValidationCallback**: Real-time validation callback
- **CustomStyling**: Custom className and style props
- **DarkMode**: Dark theme variant
- **ErrorStates**: Gallery of all error scenarios
- **AllVariants**: Side-by-side comparison of all variants

### Interaction Tests

Each story includes `play` functions that:
- Test user interactions (typing, clicking)
- Verify component state changes
- Assert expected UI elements appear/disappear
- Validate accessibility with axe-core

## CI Integration

### Test Runner (Current)

The `.github/workflows/ci-storybook.yml` workflow:
- Builds Storybook
- Runs all interaction tests
- Performs accessibility checks
- Uploads test results on failure

### Chromatic (Optional)

To enable visual regression testing with Chromatic:

1. Sign up at https://www.chromatic.com/
2. Add `CHROMATIC_PROJECT_TOKEN` to repository secrets
3. Uncomment the Chromatic job in `ci-storybook.yml`
4. Install chromatic: `npm install --save-dev chromatic`
5. Add script to package.json: `"chromatic": "chromatic --exit-zero-on-changes"`

## Testing Locally

```bash
# Install dependencies
npm install

# Start Storybook
npm run storybook

# In another terminal, run tests
npm run test-storybook
```

## Documentation

Stories are automatically documented using TypeScript types and JSDoc comments. View them at:
- Dev: http://localhost:6006
- Docs tab: Detailed prop tables and descriptions
- Canvas tab: Interactive component playground

## Troubleshooting

### Port already in use
Change the port in package.json: `storybook dev -p 6007`

### Build errors
Ensure all peer dependencies are installed: `npm install`

### Test failures
Run Storybook dev server before tests: `npm run storybook` then `npm run test-storybook`
