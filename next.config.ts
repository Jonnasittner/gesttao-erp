import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Maior limite entre os uploads via Server Action: anexos do CRM (10MB).
      bodySizeLimit: "12mb",
    },
  },
  // A rota do PDF lê public/empresa/*.png via fs.readFile em tempo de
  // execução — o rastreador de dependências do Next não enxerga isso
  // sozinho, então sem isso os arquivos ficam de fora do pacote da função
  // serverless (logo/selo somem só em produção, não em `next dev`).
  outputFileTracingIncludes: {
    "/api/pedidos/[id]/pdf": ["./public/empresa/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/clientes",
        destination: "/cadastros",
        permanent: false,
      },
      {
        source: "/clientes/:path*",
        destination: "/cadastros/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
