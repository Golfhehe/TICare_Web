import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', '.claude'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
      // Capitalized names are JSX components/icons (no eslint-plugin-react to mark them used).
      // Unused function args are tolerated (e.g. shared prop signatures); no behavior change.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', args: 'none', caughtErrors: 'none' }],
      // Intentional best-effort cleanup like try{model.close()}catch{}
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.vitest } },
  },
  {
    files: ['api/**/*.js', 'server/**/*.js', 'scripts/**/*.{js,mjs}', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
];
