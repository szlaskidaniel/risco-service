const fetch = require('node-fetch');
const winston = require('winston');
const logger = winston.loggers.get('risco');
const { WEBUI_ROOT_URL, createHeaders, validateResponse } = require('./riscoUtils');

const getDetectors = async () => {
  logger.info("getDetectors");

  const post_data = {};

  try {
    const response = await fetch(`${WEBUI_ROOT_URL}/Detectors/Get`, {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify(post_data),
    });
    const data = await response.json();

    validateResponse(data);

    logger.debug(JSON.stringify(data));
    const detectorList = data.detectors.parts.flatMap((part) => part.detectors);
    return detectorList;
  } catch (error) {
    logger.error(error);
    return;
  }
};

module.exports = {
  getDetectors,
};
