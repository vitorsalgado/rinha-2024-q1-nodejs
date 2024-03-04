FROM node:21.6.2 AS build-env
WORKDIR /app
RUN apt-get update && apt-get -y install libpq-dev g++ make
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["src/index.js"]
