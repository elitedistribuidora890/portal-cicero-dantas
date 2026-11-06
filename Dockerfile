FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data TRUST_PROXY=1
RUN mkdir -p /data
VOLUME /data
EXPOSE 3000
CMD ["node", "servidor.js"]
