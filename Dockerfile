FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install build tools for native modules (bcrypt)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled contracts and server code
COPY contracts/ ./contracts/
COPY onchain/ ./onchain/
COPY server/ ./server/
COPY zk/ ./zk/
COPY hardhat.config.ts tsconfig.json ./

# Copy compiled artifacts from build stage if needed
# (assumes contracts are pre-compiled or will be compiled at runtime)

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "--import", "tsx", "server/index.ts"]
