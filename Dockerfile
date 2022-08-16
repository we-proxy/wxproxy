FROM node:16-alpine

WORKDIR /app

### install and cache the dependencies first
# Conditional COPY/ADD in Dockerfile?
# https://stackoverflow.com/questions/31528384/conditional-copy-add-in-dockerfile
COPY package.json ./
RUN yarn install

# start the app
COPY . ./
CMD ["sh", "-c", "yarn start"]

# the default port
EXPOSE 8999
