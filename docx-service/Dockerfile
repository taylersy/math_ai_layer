FROM node:18-bullseye

# Install curl to download pandoc
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Download and install the latest Pandoc (3.x)
# The Debian bullseye repo has Pandoc 2.9, which has known bugs in OMML generation
RUN curl -L https://github.com/jgm/pandoc/releases/download/3.1.13/pandoc-3.1.13-1-amd64.deb -o pandoc.deb && \
    dpkg -i pandoc.deb && \
    rm pandoc.deb

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
