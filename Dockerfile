# Use the official Node.js image
FROM node:18

# Create the directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Open port 3000 for the web app
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
