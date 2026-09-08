module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react', 'react-hooks'],
  extends: ['eslint:recommended'],
  rules: {
    'react/jsx-uses-react': 'error', 'react/jsx-uses-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }]
  },
  ignorePatterns: ['dist', 'node_modules', '.npm-cache', 'playwright-report', 'test-results', 'audit/tmp']
}
