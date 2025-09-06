import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static optimization where possible - but use export for electron
  output: process.env.BUILD_TARGET === 'electron' ? 'export' : 'standalone',
  
  // Add trailing slash for electron builds
  trailingSlash: process.env.BUILD_TARGET === 'electron',
  
  // Use 'out' directory for electron builds
  distDir: process.env.BUILD_TARGET === 'electron' ? 'out' : '.next',
  
  // Temporarily disable TypeScript checking for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Optimize images
  images: {
    domains: ['firebasestorage.googleapis.com'],
    unoptimized: process.env.BUILD_TARGET === 'electron',
  },
  
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  
  // Environment variables that should be available in the browser
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Webpack configuration for Electron support
  webpack: (config, { isServer }) => {
    // Polyfills for client-side usage
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
      };

      config.plugins.push(
        new (require('webpack')).ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }

    // Handle Electron-specific modules
    if (process.env.BUILD_TARGET === 'electron') {
      config.externals = config.externals || []
      if (!isServer) {
        config.externals.push({
                           'active-win': 'commonjs active-win',
                 'screenshot-desktop': 'commonjs screenshot-desktop',
                 'iohook': 'commonjs iohook',
                 'electron-store': 'commonjs electron-store'
        })
      }
    }

    return config;
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
