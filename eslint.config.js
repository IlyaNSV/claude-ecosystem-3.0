// ESLint flat config (v9) — runs only после `npm install` в ecosystem root.
// Without npm install, smoke runner (`npm run smoke:hooks`) is the verification floor.
//
// Targets: hooks/ JS files (Node CommonJS). Catches TDZ patterns (DEC-DEV-0023 root cause).

'use strict';

module.exports = [
  // Vendored third-party bundles (marked/minisearch UMD, DEC-DEV-0226) — not lint targets.
  { ignores: ['hooks/**/vendor/**'] },
  {
    files: ['hooks/**/*.js', 'dev/meta-improvement/scripts/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'writable',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // The whole reason eslint exists in this project. DEC-DEV-0023 bg-extractor
      // bug: STOPWORDS const referenced before its declaration line ran. variables=true
      // catches это; functions=false because function declarations hoist legitimately.
      'no-use-before-define': ['error', { variables: true, functions: false, classes: true }],

      // General correctness
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',

      // Style / safety
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
