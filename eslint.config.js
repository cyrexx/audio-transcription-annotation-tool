import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'

export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'server/prisma/generated/**', '**/storage/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  prettier,
)
