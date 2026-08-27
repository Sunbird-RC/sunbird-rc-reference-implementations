# One runtime dependency (qrcode-svg, MIT, no transitive deps) for rendering the
# presentation request as a scannable QR. Installed with `npm ci` from the
# committed lockfile so the image is reproducible.
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

USER node

EXPOSE 4300
CMD ["node", "src/server.mjs"]
