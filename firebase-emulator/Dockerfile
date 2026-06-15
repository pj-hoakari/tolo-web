FROM node:24-trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && npm install -g firebase-tools@latest \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

EXPOSE 4000 8080

CMD ["firebase", "emulators:start", "--only", "firestore", "--project", "tolo-signaling"]
