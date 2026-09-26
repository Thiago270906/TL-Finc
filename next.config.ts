import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Extratos em PDF exportados pelo celular (compartilhar) costumam vir bem
      // maiores que os baixados pelo navegador; o padrão de 1mb rejeitava esses arquivos.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
