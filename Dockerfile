FROM node:20-alpine

WORKDIR /app

# Copy package files (optional but good practice)
COPY package*.json ./

# Copy already installed dependencies from Jenkins
COPY node_modules ./node_modules

# Copy built app
COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]