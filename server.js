'use strict';
const express = require('express'); // Express.js
const server = express();
const bodyParser = require('body-parser'); // Required to parse bodies
const config = require('./config.json');
const logger = require('./logger');
const risco = require('./risco');
const { getDetectors } = require('./riscoGetDetectors');


server.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
server.use(bodyParser.json());

process.env.NODE_ENV = 'production';

//#region Risco Security Login
risco.init(
  config.RISCO_USER,
  config.RISCO_PASS,
  config.RISCO_PIN,
  config.RISCO_SITEID
);

server.get('/alarm/check', async (req, res, next) => {
  logger.info('GET /alarm/check');
  res.status(200).send(risco.getStatus().toString());
});

server.get('/alarm/arm/:state', async (req, res, next) => {
  const { state } = req.params;
  console.log(`Set risco state: ${state}`);
  logger.info(`Set risco state: ${state}`);
  let myState, cmd, newStatus;
  if (state == 'away') {
    myState = true;
    cmd = 'armed';
    newStatus = 1;
  } else {
    myState = false;
    cmd = 'disarmed';
    newStatus = 3;
  }

  if (risco.getStatus() != newStatus) {
    logger.debug('You want ' + myState + ' ' + cmd);
    risco.login().then(function () {
      risco
        .arm(myState, cmd)
        .then(function (resp) {
          logger.debug('command processed');
          risco.getStatus().toString();

          if (state == 'away') risco.setStatus(1);
          else risco.setStatus(3);
        })
        .catch(function (err) {
          logger.error('error during arm/disarm risco module');
          logger.error(err);
        })
        .catch(function (err) {
          logger.error('error during arm/disarm - login state.');
          logger.error(err);
        });
    });
  }

  res.status(200).send({
    value: myState + ' ' + cmd,
  });
});

server.get('/alarm/bypass/:id/:state', async (req, res, next) => {
  const { id, state } = req.params;
  logger.info(`Set risco bypass for ${id} to ${state}`);

  risco
    .setBypass(id, state)
    .then(function (resp) {
      res.status(200).send(resp);
    })
    .catch(function (err) {
      logger.error('error during setBypass cmd');
      logger.error(err);
      res.status(400).send(false);
    });
});

server.get('/alarm/bypass/:id', async (req, res, next) => {
  const { id } = req.params;
  logger.info(`GET risco bypass for ${id}`);

  let status = risco.getBypass(id);
  res.status(200).send(status);
});

server.get('/alarm/detectors', async (req, res, next) => {
  logger.info('GET /alarm/detectors');
  res.status(200).send(await getDetectors());
});

//#endregion /Risco Security Login

// ready for Heroku
server.listen(process.env.PORT || 8889, function () {
  console.log('server is up');
  logger.info('server is up');
});
