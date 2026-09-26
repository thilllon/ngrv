module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  overrides: [{ files: ['**/*.cjs'], rules: { '@typescript-eslint/no-var-requires': 'off' } }],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
  ignorePatterns: [
    'dist',
    '.eslintrc.js',
    'jest.config.*',
    'commitlint.config.*',
    'changelog.config.*',
    '.prettierrc.*',
  ],
};
