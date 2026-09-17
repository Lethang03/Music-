FROM node:22-alpine

WORKDIR /app/workers/audio-worker

# Install python + ffmpeg dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg

# yt-dlp-exec expects python command
RUN ln -sf python3 /usr/bin/python

COPY workers/audio-worker/package.json workers/audio-worker/package-lock.json ./

RUN npm ci --omit=dev

COPY package.json /app/package.json
COPY src/services/storage /app/src/services/storage
COPY workers/audio-worker/ ./

CMD ["node","worker.js"]
