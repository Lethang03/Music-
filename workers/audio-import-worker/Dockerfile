FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && pip3 install --break-system-packages yt-dlp \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/workers/audio-import-worker
COPY workers/audio-import-worker/package.json ./
RUN npm install --omit=dev
COPY package.json /app/package.json
COPY src/services/storage /app/src/services/storage
COPY workers/audio-import-worker/index.js ./
USER node
CMD ["node", "index.js"]
