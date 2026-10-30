import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// toISOString() is the UTC date: wrong near midnight for a calendar day (use src/utils/dates.js)
const LOCAL_DATE_RULE = {
  selector: "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
  message: 'toISOString() gives the UTC date. Use localDateKey / localMonthKey from src/utils/dates.js.',
};

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-syntax': ['error', LOCAL_DATE_RULE],
      // `const { id, ...rest } = row` is how a field is left out of a copy
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // UI standardisation: every field and pop-up comes from the shared kit (src/components/ui)
    files: ['src/**/*.jsx'],
    ignores: ['src/components/ui/**'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "JSXOpeningElement[name.name=/^(input|select|textarea)$/]",
          message: 'Use the UI kit field components from src/components/ui (TextInput, NumberInput, DecimalInput, DateInput, Select, TextArea, Checkbox).',
        },
        {
          selector: "JSXAttribute[name.name='className'] > Literal[value=/\\bfixed inset-0\\b/]",
          message: 'Use BottomSheet or Dialog from src/components/ui for overlays.',
        },
        LOCAL_DATE_RULE,
      ],
    },
  },
  {
    files: ['src/**/*.test.js', 'src/test/**/*.js', 'vitest.config.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['cypress/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.mocha,
        ...globals.node,
        ...globals.cypress,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
