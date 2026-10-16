import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

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
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // ATRAPA EL TDZ QUE ROMPIÓ EL GESTOR DE EQUIPOS.
      // Un useCallback declarado DESPUÉS de un useEffect que lo referencia en
      // su array de dependencias lanza ReferenceError al renderizar: el array
      // se evalúa durante el render, cuando la variable todavía no existe.
      // npm run build no lo ve (compilar no es ejecutar), así que esta regla
      // es la única red antes de que llegue al navegador.
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    },
  },
])
