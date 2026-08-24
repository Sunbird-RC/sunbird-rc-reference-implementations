# Zero-dependency service: plain Node ESM over the built-in http client and
# server. No package install step, so the image builds offline and there is
# nothing to pin beyond the base image itself.
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

# Not root: this service reaches the registry and mints credential offers.
USER node

EXPOSE 4200
CMD ["node", "src/server.mjs"]
