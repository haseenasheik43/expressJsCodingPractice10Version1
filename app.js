const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, (request, response) => {
      console.log("Server is Running");
    });
  } catch (e) {
    console.log(`Db Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//api 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  let dbUser;

  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;

  dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch) {
      const payload = {
        username: username,
      };

      const jwtToken = jwt.sign(payload, "ramjanHaseena");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//authentication Token

const authenticateToken = (request, response, next) => {
  const autHeader = request.header("authorization");
  let jwtToken;
  if (autHeader !== undefined) {
    jwtToken = autHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ramjanHaseena", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//convert
const convertResObjDBObj = (responseObj) => {
  return {
    stateId: responseObj.state_id,
    stateName: responseObj.state_name,
    population: responseObj.population,
  };
};

//convert district
const convertResObjDBObjDistrict = (eachObj) => {
  return {
    districtId: eachObj.district_id,
    districtName: eachObj.district_name,
    stateId: eachObj.state_id,
    cases: eachObj.cases,
    cured: eachObj.cured,
    active: eachObj.active,
    deaths: eachObj.deaths,
  };
};

//api 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT * FROM state;
    `;

  const states = await db.all(getQuery);
  response.send(states.map((eachState) => convertResObjDBObj(eachState)));
});

//api 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};
    `;

  const state = await db.get(getQuery);
  response.send(convertResObjDBObj(state));
});

//api 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;

  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const addQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES
  (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
  );
  `;

  await db.run(addQuery);
  response.send("District Successfully Added");
});

//api 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};
    `;

    const district = await db.get(getQuery);
    response.send(convertResObjDBObjDistrict(district));
  }
);

//api 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteQuery = `
    DELETE FROM district WHERE district_id = ${districtId};
    `;

    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//api 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};
    `;

    let previousDis = await db.get(getQuery);

    let {
      districtName = previousDis.district_name,
      stateId = previousDis.state_id,
      cases = previousDis.cases,
      cured = previousDis.cured,
      active = previousDis.active,
      deaths = previousDis.deaths,
    } = request.body;

    const addQuery = `
    UPDATE district SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths};
    WHERE district_id = ${districtId};
    `;

    await db.run(addQuery);

    response.send("District Details Updated");
  }
);

//api 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getQuery = `
    SELECT 
     SUM(cases) AS totalCases,
     SUM(cured) AS totalCured,
     SUM(active) AS totalActive,
     SUM(deaths) AS totalDeaths
    FROM state 
    INNER JOIN 
    district 
    ON state.state_id = district.state_id
    WHERE state.state_id = ${stateId};
    `;

    const getStats = await db.all(getQuery);
    response.send(getStats);
  }
);

module.exports = app;
