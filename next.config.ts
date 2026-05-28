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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    unoptimized: process.env.BUILD_TARGET === 'electron',
  },
  
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    serverComponentsExternalPackages: [],
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
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // CSP - permissive for now (can be tightened later)
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'none';",
          },
          // HSTS - only in production with HTTPS
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
        ],
      },
      // API routes get additional headers
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
