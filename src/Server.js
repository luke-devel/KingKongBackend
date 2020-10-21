import express from "express";
import bcrypt from "bcrypt";
import db from "../models";
import jwt from "jsonwebtoken";
import jwt_decode from "jwt-decode";
import { QueryTypes, Sequelize } from "sequelize";

const port = process.env.PORT;
const app = express();
let sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    operatorsAliases: false,
  }
);
app.listen(port, process.env.HOST, () => {
  console.log(
    `KingKong Express Backend Listening at: http://${process.env.HOST}:${port}`
  );
});

app.get("/", (req, res) => {
  res.json("Hello World");
  res.end();
});

// Registers user into MySql
app.post("/api/registeruser", async (req, res) => {
  // let user;
  console.log("req.headers.password)");
  !req.headers.fullname ||
    !req.headers.email ||
    (!req.headers.password &&
      res.json("missing reqs") &&
      res.status(401) &&
      res.end());
  try {
    // adding new user to database, if there is an error we will return false
    let user;
    try {
      user = await db.user.create({
        fullname: req.headers.fullname,
        email: req.headers.email,
        password: req.headers.password,
      });
    } catch (seqErr) {
      console.log(seqErr.original.errno);
      ("Duplicate Email or Phone num found, sending 409 res.status(409)");
      seqErr.original.errno === 1062 && res.status(409);
      res.end();
    }
    // Status is returned if row was added into database with no error.
    const token = jwt.sign(
      {
        id: user.dataValues.id,
        email: user.dataValues.email,
        loggedIn: "true",
      },
      process.env.JWT_PRIVATE_KEY
    );
    res.status(253).json({ token }).end();
  } catch (error) {
    console.log("error in register ()");
    // Error adding row into database, or error with request data.
    console.log();
    res.end();
  }
});

app.post("/api/login", async (req, res) => {
  switch (req.method) {
    case "POST":
      let user;
      try {
        user = await db.user.findOne({
          where: {
            email: req.headers.email,
          },
        });
        if (!user) {
          res.status(404).json("no email found!").end();
        }
      } catch (e) {
        console.log("no email found");
        res.status(404).json("no email found!").end();
      }

      if (user) {
        const result = await bcrypt.compare(
          req.headers.password,
          user.password
        );
        if (result) {
          // if password is correct
          const token = jwt.sign(
            { id: user.id, email: user.email, loggedIn: "true" },
            process.env.JWT_PRIVATE_KEY
          );
          res
            .status(253)
            .json({
              id: user.id,
              email: user.email,
              token,
            })
            .end();
        } else {
          console.log("invalid password");
          res.status(405).end("invalid password");
        }
      }
      break;

    default:
      res.end("you need to post");
      break;
  }
});

app.post("/api/addsite", async (req, res) => {
  if (
    !req.headers.serveraddress ||
    !req.headers.serverport ||
    !req.headers.serverusername ||
    !req.headers.serverpassword ||
    !req.headers.serverdescription
  ) {
    res.status(401).json("bad request");
  }

  console.log("hi");
  // console.log(req.heSaders);

  switch (req.method) {
    case "POST":
      const decodedToken = jwt_decode(req.headers.token);
      // this is the id in the db
      // we need to create or  update row in
      // users db with json.stringified ftp server info.
      console.log(decodedToken.id);
      await db.userdata
        .findOne({ where: { userid: decodedToken.id } })
        .then(async (found) => {
          if (found == null) {
            console.log(
              "User ID doesnt exist in the userdata table. adding now."
            );
            await db.userdata.create({
              userid: decodedToken.id,
              ftpservers: JSON.stringify([
                {
                  serverdescription: req.headers.serverdescription,
                  serveraddress: req.headers.serveraddress,
                  serverport: req.headers.serverport,
                  serverusername: req.headers.serverusername,
                  serverpassword: req.headers.serverpassword,
                },
              ]),
            });
            console.log(
              `FTP server object written to db for user: ${decodedToken.id}`
            );
            res.status(250);
          } else {
            console.log(
              `userdata row found for user ${decodedToken.id}, updating row now.`
            );
            res.status(201);
            // were here if they exist. we need to get their json and append to it if unique
            const data = await sequelize.query(
              `SELECT distinct ftpservers
              FROM kingkong.userdata
              WHERE userid = ${decodedToken.id}
              LIMIT 1`,
              {
                raw: true,
                type: QueryTypes.SELECT,
              }
            );
            let jsonObj = JSON.parse(data[0].ftpservers);
            jsonObj.push({
              serverdescription: req.headers.serverdescription,
              serveraddress: req.headers.serveraddress,
              serverport: req.headers.serverport,
              serverusername: req.headers.serverusername,
              serverpassword: req.headers.serverpassword,
            });

            await db.userdata
              .update(
                {
                  ftpservers: JSON.stringify(jsonObj),
                },
                {
                  returning: true,
                  where: { userid: decodedToken.id },
                  plain: true,
                }
              )
              .catch((err) =>
                console.log("err in removing existing userdata row")
              );
          }
        });
      res.status(253).end();
      break;

    default:
      res.end("you need to post");
      break;
  }
});
