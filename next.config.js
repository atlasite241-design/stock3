const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fixe la racine du projet (un package-lock.json existe aussi dans le dossier
  // parent, ce qui faisait deviner la mauvaise racine à Next/Turbopack).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
