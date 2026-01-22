/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude Android/iOS build directories from Next.js build to reduce build size
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'android/**/*',
        'ios/**/*',
        'www/**/*',
      ],
    },
  },
  // Optimize for production builds
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
