# Production Frontend Dockerfile

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy frontend source
COPY . .

# Build production app
RUN yarn build

# Install lightweight static server
RUN yarn global add serve

# Render/VPS dynamic port support
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start production server
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]