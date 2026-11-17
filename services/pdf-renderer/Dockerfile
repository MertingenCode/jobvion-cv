FROM node:24-bookworm-slim
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
WORKDIR /service
RUN npm install --omit=dev --save-exact playwright-core@1.65.1 \
 && ./node_modules/.bin/playwright-core install --with-deps chromium \
 && chmod -R a+rX /opt/chromium
COPY services/pdf-renderer/server.mjs ./
ENV PDF_BIND_HOST=0.0.0.0 PDF_BIND_PORT=4025
USER node
EXPOSE 4025
CMD ["node", "server.mjs"]
