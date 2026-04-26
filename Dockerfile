FROM node:20-alpine

WORKDIR /app

# copy already installed deps + build
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
