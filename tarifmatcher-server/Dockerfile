# The grouper is a Java library and Vercel's Node runtime has no JVM, so it
# runs here instead — same pattern as whatsapp-server on Railway.
FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache nodejs

WORKDIR /app
COPY tarifmatcher-1.2.1-standalone.jar ./
COPY tariffs ./tariffs
COPY server.js package.json ./

ENV PORT=8080
EXPOSE 8080
# Fails fast if a tariff file or the jar is missing, rather than 500ing per request.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "server.js"]
