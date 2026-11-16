FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY policy.js ./
USER node
EXPOSE 4100
CMD ["npm", "start"]