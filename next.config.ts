import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  output: "standalone",

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/_next/static/media/ort-wasm-simd-threaded.asyncify.mjs",
          destination: "/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs",
        },
        {
          source: "/_next/static/media/ort-wasm-simd-threaded.asyncify.wasm",
          destination: "/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
