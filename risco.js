let request = require('request');
let winston = require('winston');
let logger = winston.loggers.get('risco');
let fs = require('fs');
const { setRiscoCookies } = require('./riscoUtils');

var riscoCookies;
var risco_username;
var risco_password;
var risco_pincode;
var risco_siteId;
var req_counter;

var riscoStatus = 3; // default disarmed
/*
"0": stay armed
"1": away armed
"2": night armed
"3": disarmed
"4": alarm has been triggered
*/

// read last known Risco status from file
fs.readFile('risco-status.dat', { encoding: 'utf-8' }, function (err, data) {
  if (!err) {
    logger.debug('last known risco status: ' + data);
    riscoStatus = data;
  } else {
    logger.error(err);
  }
});

var skipRoomDetector = {
  room_2: false,
};

function getStatus() {
  // localstatus
  //logger.info(`getStatus() -> current: ${riscoStatus} `);
  return riscoStatus;
}

function setStatus(_newStatus) {
  logger.info(`setStatus() internal to ${_newStatus} `);
  riscoStatus = _newStatus;

  // save last known status to file
  fs.writeFile('risco-status.dat', riscoStatus, function (err) {
    if (err) {
      logger.error(err);
    } else logger.debug('new status saved to file');
  });
}

function init(aUser, aPassword, aPIN, aSiteId, context) {
  logger.info('init()');
  risco_username = encodeURIComponent(aUser);
  risco_password = encodeURIComponent(aPassword);
  risco_pincode = aPIN;
  risco_siteId = aSiteId;
  self = context;
  req_counter = 0;
  login()
    .then(function () {
      getState().then().catch();
    })
    .catch(function () {});
}

function extractError(aBody) {
  try {
    let serverInfo_begin = aBody.indexOf('<span class="infoServer">');
    let serverInfo_end = aBody.indexOf('</span>', serverInfo_begin);
    let resp = aBody.substring(serverInfo_begin + 26, serverInfo_end - 7);
    return resp;
  } catch (error) {
    console.error(error);
    return '';
  }
}

function login() {
  return new Promise(function (resolve, reject) {
    logger.info('login() to RiscoCloud');
    var post_data =
      'username=' + risco_username + '&password=' + risco_password;

    var options = {
      url: 'https://www.riscocloud.com/ELAS/WebUI/',
      method: 'POST',
      headers: {
        'Content-Length': post_data.length,
        'Content-type': 'application/x-www-form-urlencoded',
      },
      body: post_data,
    };

    request(options, function (err, res, body) {
      try {
        if (!err && res.statusCode == 302) {
          if (res.statusCode == 302) {
            logger.debug('cookie received, save it.');
            riscoCookies = res.headers['set-cookie'];
            setRiscoCookies(riscoCookies);

            var post_data =
              'SelectedSiteId=' + risco_siteId + '&Pin=' + risco_pincode;
            var options = {
              url: 'https://www.riscocloud.com/ELAS/WebUI/SiteLogin',
              method: 'POST',
              headers: {
                Cookie: riscoCookies,
                Host: 'www.riscocloud.com',
                Origin: 'https://www.riscocloud.com',
                Referer:
                  'https://www.riscocloud.com/ELAS/WebUI/SiteLogin/Index',
                'Content-Length': post_data.length,
                'Content-type': 'application/x-www-form-urlencoded',
              },
              body: post_data,
            };
            request(options, function (err, res, body) {
              try {
                if (!err && res.statusCode == 302) {
                  logger.info('loggedIn !');
                  resolve();
                  return;
                } else {
                  logger.error('Status Code: ' + res.statusCode);
                  logger.error('login [step2] > error:', extractError(body));
                  reject('');
                  return;
                }
              } catch (error) {
                logger.error(error);
                reject('');
                return;
              }
            });
          } else {
            logger.error('Status Code: ' + res.statusCode);
            logger.error('login  error:' + extractError(body));
            reject('');
            return;
          }
        } else {
          logger.error('Status Code: ' + res.statusCode);
          logger.error('login  error:' + extractError(body));
          console.log('login  error:' + extractError(body));
          reject('');
          return;
        }
      } catch (error) {
        logger.error(error);
        reject('');
        return;
      }
    });
  });
}

// Get State only after login, to save initial RISCO State. Then use refresh to update local variable
function getState() {
  logger.info('getState (after login)');
  return new Promise(function (resolve, reject) {
    var post_data = {};

    var options = {
      url: 'https://www.riscocloud.com/ELAS/WebUI/Overview/Get',
      method: 'POST',
      headers: {
        Referer: 'https://www.riscocloud.com/ELAS/WebUI/MainPage/MainPage',
        Origin: 'https://www.riscocloud.com',
        Cookie: riscoCookies,
      },
      json: post_data,
    };

    request(options, function (err, res, body) {
      if (!err) {
        // Check error inside JSON
        try {
          if (body.error == 3) {
            // Error. Try to login first
            logger.error('Error: 3. Try to login first.');
            reject();
            return;
          }
        } catch (error) {
          logger.error(error);
          reject();
          return;
        }

        //logger.debug('RiscoCloud ArmedState:' + body.overview.partInfo.armedStr + " / RiscoCloud OngoingAlarm: " + body.OngoingAlarm );
        var riscoState;
        // 0 -  Characteristic.SecuritySystemTargetState.STAY_ARM:
        // 1 -  Characteristic.SecuritySystemTargetState.AWAY_ARM:
        // 2-   Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        // 3 -  Characteristic.SecuritySystemTargetState.DISARM:
        //logger.debug(body);

        if (body.OngoingAlarm == true) {
          riscoState = 4;
        } else {
          try {
            var armedZones = body.overview.partInfo.armedStr.split(' ');
            var partArmedZones = body.overview.partInfo.partarmedStr.split(' ');

            if (parseInt(armedZones[0]) > 0) {
              riscoState = 1; // Armed
            } else if (parseInt(partArmedZones[0]) > 0) {
              riscoState = 2; // Partially Armed
            } else {
              riscoState = 3; // Disarmed
            }
          } catch (error) {
            logger.error(error);
            reject();
            return;
          }
        }

        logger.debug(`riscoState: ${riscoState}`);
        riscoStatus = riscoState;
        resolve(riscoState);
      } else {
        logger.error(err);
        reject();
        return;
      }
    });
  });
}

function refreshState() {
  return new Promise(function (resolve, reject) {
    var alive_url;

    if (req_counter == 0) {
      alive_url =
        'https://www.riscocloud.com/ELAS/WebUI/Security/GetCPState?userIsAlive=true';
    } else alive_url = 'https://www.riscocloud.com/ELAS/WebUI/Security/GetCPState';

    req_counter++;
    if (req_counter > 10) {
      alive_url =
        'https://www.riscocloud.com/ELAS/WebUI/Security/GetCPState?userIsAlive=true';
      req_counter = 0;
    }

    var post_data = {};

    var options = {
      url: alive_url,
      method: 'POST',
      headers: {
        Referer: 'https://www.riscocloud.com/ELAS/WebUI/MainPage/MainPage',
        Origin: 'https://www.riscocloud.com',
        Cookie: riscoCookies,
      },
      json: post_data,
    };

    request(options, function (err, res, body) {
      if (!err) {
        // Check error inside JSON
        //logger.debug(JSON.stringify(body));

        try {
          if (body.error == 3) {
            // login failed, relogin
            logger.error('body.error == 3, we need to relogin');
            reject(3);
            return;
          }
        } catch (error) {
          logger.error(`Failed during GET GetCPState ${error}`);
          reject();
          return;
        }

        var riscoState;
        // 0 -  Characteristic.SecuritySystemTargetState.STAY_ARM:
        // 1 -  Characteristic.SecuritySystemTargetState.AWAY_ARM:
        // 2-   Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        // 3 -  Characteristic.SecuritySystemTargetState.DISARM:

        if (body.OngoingAlarm == true) {
          riscoState = 4;
        } else {
          // Try different GET Method

          if (body.overview == undefined) {
            //logger.debug('No changes');
            resolve();
            return;
          }

          try {
            var armedZones = body.overview.partInfo.armedStr.split(' ');
            var partArmedZones = body.overview.partInfo.partarmedStr.split(' ');

            logger.debug('armedZones:' + armedZones[0]);

            if (parseInt(armedZones[0]) > 0) {
              riscoState = 1; // Armed
            } else if (parseInt(partArmedZones[0]) > 0) {
              riscoState = 2; // Partially Armed
            } else {
              riscoState = 3; // Disarmed
            }
            logger.debug(`riscoState: ${riscoState}`);
            riscoStatus = riscoState;
            resolve(riscoState);
            return;
          } catch (error) {
            logger.error(`Failed during parse arm / partArmed zones ${error}`);
            reject();
            return;
          }
        }
      } else {
        try {
          logger.error('Error during GetCPState');
          logger.debug(`body.error:  ${body.error}`);
          logger.debug(`body.overview: ${body.overview}`);
        } catch (error) {
          logger.error(error);
        } finally {
          reject();
        }
      }
    });
  });
}

function arm(aState, cmd) {
  logger.info(`func: arm ${aState} , ${cmd}`);

  return new Promise(function (resolve, reject) {
    var targetType = cmd;
    var targetPasscode;

    if (aState) {
      // ARM
      targetPasscode = '';
    } else {
      // DISARM
      targetPasscode = '------';
    }

    var post_data =
      'type=' + targetType + '&passcode=' + targetPasscode + '&bypassZoneId=-1';

    var options = {
      url: 'https://www.riscocloud.com/ELAS/WebUI/Security/ArmDisarm',
      method: 'POST',
      headers: {
        Referer: 'https://www.riscocloud.com/ELAS/WebUI/MainPage/MainPage',
        Origin: 'https://www.riscocloud.com',
        Cookie: riscoCookies,
        'Content-Length': post_data.length,
        'Content-type': 'application/x-www-form-urlencoded',
      },
      body: post_data,
    };

    request(options, function (err, res, body) {
      if (!err) {
        try {
          if (body.error == 3) {
            // Error. Try to login first !
            logger.error('Error: 3. Try to login first.');
            reject(body.error);
            return;
          }
        } catch (error) {
          logger.error(error);
          reject();
          return;
        }
        logger.debug('Risco state updated');
        // UnOmit all Zones / Rooms when Alarm disarmed
        if (!aState) {
          logger.debug('UnOmit all omited detectors, set them to false');
          Object.keys(skipRoomDetector).forEach(function (key) {
            logger.debug(`Skip ${key} set back to false`);
            skipRoomDetector[key] = false;
          });

          logger.debug('Array for Skipped Zones:');
          logger.debug(JSON.stringify(skipRoomDetector));
        }
        resolve();
      } else {
        var errMsg = 'Error ' + res.statusCode;
        logger.error(errMsg);
        reject(errMsg);
      }
    });
  });
}

setInterval(function () {
  refreshState()
    .then()
    .catch(function (err) {
      logger.debug('refreshState() failed');
      if (err == 3) {
        logger.debug('need to relogin');
        relogin();
      }
      logger.debug(err);
    });
}, 15000); // every 30 sec

function relogin() {
  logger.info('relogin()');
  login()
    .then(function () {
      logger.debug('relogin success');
      getState().then().catch();
    })
    .catch(function () {
      logger.error('failed to relogin.');
    });
}

function setBypass(_id, _bypass) {
  logger.info(`setBypass ${_id} , ${_bypass}`);
  return new Promise(function (resolve, reject) {
    login()
      .then(function () {
        logger.debug('login success');

        var post_data = `id=${_id}&bypass=${_bypass}`;

        var options = {
          url: `https://www.riscocloud.com/ELAS/WebUI/Detectors/SetBypass`,
          method: 'POST',
          headers: {
            Referer: 'https://www.riscocloud.com/ELAS/WebUI/MainPage/MainPage',
            Origin: 'https://www.riscocloud.com',
            Cookie: riscoCookies,
            'Content-Length': post_data.length,
            'Content-type': 'application/x-www-form-urlencoded',
          },
          body: post_data,
        };

        request(options, function (err, res, body) {
          if (!err) {
            try {
              if (body.error == 3) {
                // Error. Try to login first !
                logger.error(
                  'Error: 3. Try to login first. --should never happen'
                );
                reject(body.error);
                return;
              }
            } catch (error) {
              logger.error(error);
              reject();
              return;
            }
            logger.debug('Bypass command success');
            skipRoomDetector['room_' + _id] = _bypass;
            resolve(_bypass);
          } else {
            var errMsg = 'Error ' + res.statusCode;
            logger.error(errMsg);
            reject(errMsg);
          }
        });
      })
      .catch(function () {
        logger.error('failed to login.');
      });
  });
}

function getBypass(_id) {
  return skipRoomDetector['room_' + _id];
}

module.exports = {
  init,
  login,
  arm,
  getStatus,
  setStatus,
  setBypass,
  getBypass,
};
