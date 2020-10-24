import express from "express";
import bcrypt from "bcrypt";
import db from "../models";
import jwt from "jsonwebtoken";
import jwt_decode from "jwt-decode";
import { QueryTypes, Sequelize } from "sequelize";
import bb from "express-busboy";

const port = process.env.PORT;
const app = express();

bb.extend(app);

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

// gets users json ftp server data
app.get("/api/query/:id*", async (req, res) => {
  // console.log('here we go.', req.params['id']);
  if (!req.body) {
    return res.status(404).json("Opps! Something went wrong.").end();
  } else {
    const decodedToken = jwt_decode(req.body.userToken);
    try {
      const userInfo = await db.user.findOne({
        where: { email: decodedToken.myPersonEmail },
      });
      if (userInfo && userInfo.id === decodedToken.sub) {
        // Authenticated request
        try {
          const userDataInfo = await db.userdata.findOne({
            where: { userid: decodedToken.sub },
          });
          // Todo: add row id into this jsonObj
          res
            .status(253)
            .json({ rowId: userDataInfo.id, data: userDataInfo.ftpservers });
        } catch (error) {
          console.log("error, ftptables doesnt exist for user");
          res.status(401).end();
        }
      }
    } catch (seqFindErr) {
      return res.status(404).json("Opps! Something went wrong.").end();
    }
  }
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
    try {
      const user = await db.user.create({
        fullname: req.headers.fullname,
        email: req.headers.email,
        password: req.headers.password,
      });
      if (user) {
        const claims = { sub: user.id, myPersonEmail: user.email };
        const token = jwt.sign(claims, process.env.JWT_PRIVATE_KEY, {
          expiresIn: "1hr",
        });
        // Status is returned if row was added into database with no error.
        return res.json({ authToken: token });
      }
    } catch (seqErr) {
      console.log(seqErr.original.errno);
      ("Duplicate Email or Phone num found, sending 409 res.status(409)");
      if (seqErr.original.errno) {
        console.log("yo");
        seqErr.original.errno === 1062 && res.status(409).end();
      }
    }
  } catch (error) {
    console.log("error in registeruser ()", error);
    // Error adding row into database, or error with request data.
    console.log();
    res.end();
  }
});

app.post("/api/login", async (req, res) => {
  console.log("here at leastr");
  switch (req.method) {
    case "POST":
      try {
        if (!req.body.email || !req.body.password) {
          return res.status(404).json("Opps! Something went wrong.").end();
        }
        const user = await db.user.findOne({
          where: {
            email: req.body.email,
          },
        });
        if (user) {
          const result = await bcrypt.compare(req.body.password, user.password);
          if (result === true) {
            const claims = { sub: user.id, myPersonEmail: user.email };
            const token = jwt.sign(claims, process.env.JWT_PRIVATE_KEY, {
              expiresIn: "1hr",
            });
            return res.json({ authToken: token });
          } else {
            res.json({ message: "Opps! Something went wrong." });
          }
        } else {
          res.status(404).json("Opps! Something went wrong.").end();
        }
        1;
      } catch (e) {
        res.status(404).json("Opps! Something went wrong.").end();
      }
      break;
    default:
      res.end("You need to post.");
      break;
  }
});

app.post("/api/addsite", async (req, res) => {
  switch (req.method) {
    case "POST":
      if (
        !req.headers.serveraddress ||
        !req.headers.serverport ||
        !req.headers.serverusername ||
        !req.headers.serverpassword ||
        !req.headers.serverdescription ||
        !req.headers.token
      ) {
        return res.status(401).end("bad req");
      }
      const decodedToken = jwt_decode(req.headers.token);
      const userInfo = await db.userdata.findOne({
        where: { userid: decodedToken.sub },
      });
      if (userInfo) {
        // user exists
        var serverList = JSON.parse(userInfo.dataValues.ftpservers);
        console.log(serverList.length);
        serverList.push({
          serverdescription: req.headers.serverdescription,
          serveraddress: req.headers.serveraddress,
          serverport: req.headers.serverport,
          serverusername: req.headers.serverusername,
          serverpassword: req.headers.serverpassword,
        });
        //* JSON obj is now +1
        try {
          const updateLog = await db.userdata.update(
            {
              ftpservers: JSON.stringify(serverList),
            },
            {
              returning: true,
              where: { userid: decodedToken.sub },
              plain: true,
            }
          );
          res.json({ message: "Success" });
        } catch (error) {
          console.log("Update error in /api/addsite update: ", error);
          res.json({ message: "Opps! Something went wrong" });
        }
      } else {
        try {
          const createLog = await db.userdata.create(
            {
              userid: decodedToken.sub,
              ftpservers: JSON.stringify([
                {
                  serverdescription: req.headers.serverdescription,
                  serveraddress: req.headers.serveraddress,
                  serverport: req.headers.serverport,
                  serverusername: req.headers.serverusername,
                  serverpassword: req.headers.serverpassword,
                },
              ]),
            },
            {
              returning: true,
              where: { userid: decodedToken.id },
              plain: true,
            }
          );
          res.json({ message: "Success" });
        } catch (error) {
          console.log("Update error in /api/addsite create: ");
          res.json({ message: "Opps! Something went wrong" });
        }
      }
      // const doesUserExist = !userInfo.isNewRecord;
      // if (doesUserExist) {

      // } else {
      //   res.end("user doesnt exist");
      // }
      break;

    default:
      res.end("you need to post");
      break;
  }
});

app.post("/api/checkauth", async (req, res) => {
  switch (req.method) {
    case "POST":
      if (!req.body) {
        return res.status(404).json("Opps! Something went wrong.").end();
      } else {
        const decodedToken = jwt_decode(req.body.userToken);
        try {
          const userInfo = await db.user.findOne({
            where: { email: decodedToken.myPersonEmail },
          });
          if (userInfo && userInfo.id === decodedToken.sub) {
            // Authenticated request
            return res.json({ message: "Authenticated" });
            res.end();
          }
        } catch (seqFindErr) {
          return res.status(404).json("Opps! Something went wrong.").end();
        }
      }
      break;

    default:
      res.end("you need to post");
      break;
  }
});

// app.post("/api/auth-bootstrap", async (req, res) => {
//   switch (req.method) {
//     case "POST":
//       if (!req.body) {
//         return res.status(404).json("Opps! Something went wrong.").end();
//       } else {
//         const decodedToken = jwt_decode(req.body.userToken);
//         console.log(decodedToken);
//         try {
//           const userInfo = await db.user.findOne({
//             where: { email: decodedToken.myPersonEmail },
//           });
//           console.log(userInfo);
//           if (userInfo && userInfo.id === decodedToken.sub) {
//             // Authenticated request
//             console.log('Authenticated request');
//             res.end()
//           }
//         } catch (seqFindErr) {
//           return res.status(404).json("Opps! Something went wrong.").end();
//         }
//       }
//       break;

//     default:
//       res.end("you need to post");
//       break;
//   }
// });
