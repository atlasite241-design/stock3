const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Repère de version visible dans l'app. Sans lui, impossible de distinguer
  // « le correctif ne marche pas » de « l'ancien build est encore chargé » —
  // ce qui a coûté deux allers-retours de diagnostic.
  env: {
    NEXT_PUBLIC_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
  },
  // Fixe la racine du projet (un package-lock.json existe aussi dans le dossier
  // parent, ce qui faisait deviner la mauvaise racine à Next/Turbopack).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
