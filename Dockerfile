FROM node:16-alpine

USER root

WORKDIR /home/node/code

RUN chown -R node:node /home/node/code

USER node

COPY --chown=node:node . .

RUN npm ci

CMD [ "npm", "start" ]