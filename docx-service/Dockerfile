FROM node:18-bullseye

# Install pandoc
RUN apt-get update && \
    apt-get install -y pandoc && \
    rm -rf /var/lib/apt/lists/*

# 为 Hugging Face Spaces 创建一个非 root 用户 (HF 强制要求)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set working directory
WORKDIR $HOME/app

# Copy package.json and package-lock.json
COPY --chown=user package*.json ./

# Install node dependencies
RUN npm install

# Copy source code
COPY --chown=user . .

# Hugging Face Spaces 默认监听 7860 端口
EXPOSE 7860
ENV PORT=7860

# Start the application
CMD ["npm", "start"]
