FROM node:22-alpine

WORKDIR /app

# Install python + ffmpeg dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg

# yt-dlp-exec expects python command
RUN ln -sf python3 /usr/bin/python

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY . .

CMD ["node","worker.js"]