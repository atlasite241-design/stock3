const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fixe la racine du projet (un package-lock.json existe aussi dans le dossier
  // parent, ce qui faisait deviner la mauvaise racine à Next/Turbopack).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),
  // drei est un « barrel » : sans ceci, tout drei (three-mesh-bvh, etc.)
  // part dans le chunk de l'explorateur 3D. On ne garde que les modules utilisés.
  experimental: {
    optimizePackageImports: ['@react-three/drei'],
  },
}

module.exports = nextConfig
