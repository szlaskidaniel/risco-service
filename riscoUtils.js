const ROOT_URL = "https://www.riscocloud.com";
const WEBUI_ROOT_URL = `${ROOT_URL}/ELAS/WebUI`;

let riscoCookies;

const setRiscoCookies = (cookies) => {
  riscoCookies = cookies;
};

const createHeaders = () => {
  return {
    Referer: `${WEBUI_ROOT_URL}/MainPage/MainPage`,
    Origin: ROOT_URL,
    Cookie: riscoCookies,
    "Content-Type": "application/json",
  };
};

const validateResponse = (body) => {
  try {
    if (body.error == 3) {
      // Error. Try to login first !
      logger.error("Error: 3. Try to login first. --should never happen");
      throw new Error(body.error);
    }
  } catch (error) {
    logger.error(error);
    throw new Error(error);
  }
};

module.exports = {
  WEBUI_ROOT_URL,
  setRiscoCookies,
  createHeaders,
  validateResponse,
};
