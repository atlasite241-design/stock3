import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/**
 * Configuration ESLint (format « flat », le seul que lit ESLint 9).
 *
 * Ce fichier manquait : la commande `next lint` de l'ancien package.json ne
 * trouvait rien à exécuter, et le projet n'avait AUCUNE vérification de style —
 * la compilation Next attrapait les erreurs de type, rien d'autre.
 */
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      // Service worker : du JavaScript volontairement autonome, sans module.
      'public/sw.js',
      // Scripts d'outillage ponctuels, pas du code de l'application.
      'db/**',
      'scripts/**',
      'convert-to-dashboard.js',
    ],
  },
  ...coreWebVitals,
  ...typescript,

  {
    rules: {
      /*
       * Les règles du compilateur React (set-state-in-effect, use-memo,
       * static-components, refs, purity…) arrivent avec Next 16 et jugent un
       * STYLE, pas des bogues. Ce code applique délibérément le motif
       * local-first « hydrater l'état depuis localStorage dans un effet de
       * montage » — le réécrire sur 120 sites pour satisfaire un avis serait
       * un chantier risqué sans gain fonctionnel.
       *
       * AVERTISSEMENT et non erreur : visibles pour le code neuf, sans faire
       * échouer la vérification sur l'existant. Les règles qui attrapent de
       * vrais bogues (rules-of-hooks, exhaustive-deps) restent, elles, au
       * niveau livré par Next.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // La convention du projet : un préfixe _ dit « volontairement inutilisé »
      // (ex. extraire une clé d'un objet pour l'écarter du reste).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },

  {
    // next.config.js est du CommonJS par nature : require() y est le format.
    files: ['next.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]
