# One runtime dependency (qrcode-svg, MIT, no transitive deps) for rendering the
# credential offer as a scannable QR. Installed with `npm ci` from the committed
# lockfile so the image is reproducible.
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

# Not root: this service reaches the registry and mints credential offers.
USER node

EXPOSE 4200
CMD ["node", "src/server.mjs"]
