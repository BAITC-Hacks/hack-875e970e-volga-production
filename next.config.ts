import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone', poweredByHeader: false, agentRules: false,
  outputFileTracingRoot: process.cwd(), turbopack: { root: process.cwd() },
};
export default config;
