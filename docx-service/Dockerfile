FROM node:18-bullseye

# Install pandoc
RUN apt-get update && \
    apt-get install -y pandoc && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install node dependencies
RUN npm install

# Copy source code
COPY . .

# Start the application
CMD ["npm", "start"]
