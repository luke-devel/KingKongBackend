import express from "express";
import bcrypt from "bcrypt";
import db from "../models";
import jwt, { decode } from "jsonwebtoken";
import jwt_decode from "jwt-decode";
import { QueryTypes, Sequelize } from "sequelize";
import bb from "express-busboy";
import nodemailer from "nodemailer";
import moment from "moment";
import { pull_ftp } from "./ftp_utils";

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_FROM,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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
  // db.sequelize.sync().then(function () {
  //   console.log(`done`);
  // });
  res.end();
});

app.get("/testbackup", (req, res) => {
  res.json("Hello World");
  // db.sequelize.sync().then(function () {
  //   console.log(`done`);
  // });
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
        where: {
          email: decodedToken.myPersonEmail,
        },
      });
      if (userInfo && userInfo.id === decodedToken.sub) {
        // Authenticated request
        try {
          const userDataInfo = await db.userdata.findOne({
            where: {
              userid: decodedToken.sub,
            },
          });
          // Todo: add row id into this jsonObj
          res.status(253).json({
            rowId: userDataInfo.id,
            data: userDataInfo.ftpservers,
          });
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

app.get("/api/querybackups/:id*", async (req, res) => {
  // console.log('here we go.', req.params['id']);
  if (!req.body) {
    return res.status(404).json("Opps! Something went wrong.").end();
  } else {
    const decodedToken = jwt_decode(req.body.userToken);
    try {
      const userInfo = await db.user.findOne({
        where: {
          email: decodedToken.myPersonEmail,
        },
      });
      if (userInfo && userInfo.id === decodedToken.sub) {
        // Authenticated request
        try {
          console.log(decodedToken.sub);
          const userDataInfo = await db.userdata.findOne({
            where: {
              userid: decodedToken.sub,
            },
          });
          res.status(253).json({
            rowId: userDataInfo.id,
            data: userDataInfo.backups,
          });
        } catch (error) {
          console.log("error, backups doesnt exist for user");
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
        const claims = {
          sub: user.id,
          myPersonEmail: user.email,
        };
        const token = jwt.sign(claims, process.env.JWT_PRIVATE_KEY, {
          expiresIn: "1hr",
        });
        // Status is returned if row was added into database with no error.
        return res.json({
          authToken: token,
        });
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
            const claims = {
              sub: user.id,
              myPersonEmail: user.email,
            };
            const token = jwt.sign(claims, process.env.JWT_PRIVATE_KEY, {
              expiresIn: "1hr",
            });
            return res.json({
              authToken: token,
            });
          } else {
            res.json({
              message: "Opps! Something went wrong.",
            });
          }
        } else {
          res.json("Opps! Something went wrong.").end();
        }
        1;
      } catch (e) {
        res.json("Opps! Something went wrong.").end();
      }
      break;
    default:
      res.end("You need to post.");
      break;
  }
});

app.post("/api/addsite", async (req, res) => {
  if (
    !req.body.servertype ||
    !req.body.serveraddress ||
    !req.body.serverport ||
    !req.body.serverusername ||
    !req.body.serverpassword ||
    !req.body.serverdescription
  ) {
    return res.json("Oops! An error has occured.");
  }
  switch (req.method) {
    case "POST":
      if (req.body.servertype === "ftp" || req.body.servertype === "sftp") {
        const decodedToken = jwt_decode(req.body.token);
        const userInfo = await db.userdata.findOne({
          where: {
            userid: decodedToken.sub,
          },
        });
        if (userInfo) {
          // user exists
          var serverList = JSON.parse(userInfo.dataValues.ftpservers);
          console.log(req.body.servertype);
          serverList.push({
            servertype: req.body.servertype,
            serverdescription: req.body.serverdescription,
            serveraddress: req.body.serveraddress,
            serverport: req.body.serverport,
            serverusername: req.body.serverusername,
            serverpassword: req.body.serverpassword,
          });
          //* JSON obj is now +1
          try {
            const updateLog = await db.userdata.update(
              {
                ftpservers: JSON.stringify(serverList),
              },
              {
                returning: true,
                where: {
                  userid: decodedToken.sub,
                },
                plain: true,
              }
            );
            res.json({
              message: "Success",
            });
          } catch (error) {
            console.log("Update error in /api/addsite update: ", error);
            res.json({
              message: "Opps! Something went wrong",
            });
          }
        } else {
          try {
            const createLog = await db.userdata.create(
              {
                userid: decodedToken.sub,
                ftpservers: JSON.stringify([
                  {
                    servertype: req.body.servertype,
                    serverdescription: req.body.serverdescription,
                    serveraddress: req.body.serveraddress,
                    serverport: req.body.serverport,
                    serverusername: req.body.serverusername,
                    serverpassword: req.body.serverpassword,
                  },
                ]),
              },
              {
                returning: true,
                where: {
                  userid: decodedToken.id,
                },
                plain: true,
              }
            );
            res.json({
              message: "Success",
            });
          } catch (error) {
            console.log("Update error in /api/addsite create: ");
            res.json({
              message: "Opps! Something went wrong",
            });
          }
        }
      } else {
        return res.json("Oops! An error has occured.");
      }
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
            where: {
              email: decodedToken.myPersonEmail,
            },
          });
          if (userInfo && userInfo.id === decodedToken.sub) {
            // Authenticated request
            return res.json({
              message: "Authenticated",
            });
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

app.post("/api/checkadmin", async (req, res) => {
  switch (req.method) {
    case "POST":
      if (!req.body) {
        return res.status(404).json("Opps! Something went wrong.").end();
      } else {
        const decodedToken = jwt_decode(req.body.userToken);
        try {
          const userInfo = await db.user.findOne({
            where: {
              email: decodedToken.myPersonEmail,
            },
          });
          if (userInfo && userInfo.id === decodedToken.sub) {
            // Authenticated request, now we check if admin
            const userInfo = await db.user.findOne({
              where: {
                id: decodedToken.sub,
              },
            });
            if (userInfo.adminStatus === "true") {
              return res.json({
                message: "Authenticated",
              });
            } else {
              return res.json({
                message: "Oops! An error has occured.",
              });
            }
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

app.post("/api/addpaiduser", async (req, res) => {
  switch (req.method) {
    case "POST":
      console.log("in server");
      if (!req.body) {
        return res.status(404).json("Opps! Something went wrong.").end();
      } else {
        const decodedToken = jwt_decode(req.body.userToken);
        try {
          const userInfo = await db.user.findOne({
            where: {
              email: decodedToken.myPersonEmail,
            },
          });
          if (userInfo && userInfo.id === decodedToken.sub) {
            // Authenticated request
            console.log("Authenticated request");
            try {
              const updateLog = await db.user.update(
                {
                  memberStatus: "true",
                },
                {
                  returning: true,
                  where: {
                    id: userInfo.id,
                  },
                  plain: true,
                }
              );
              console.log(userInfo.id);
              res.json({
                message: "Success",
              });
            } catch (error) {
              console.log("Update error in /api/addpaiduser update: ", error);
              res.json({
                message: "Opps! Something went wrong",
              });
            }
          }
        } catch (seqFindErr) {
          return res.json("Opps! Something went wrong.").end();
        }
      }
      break;

    default:
      res.end("you need to post");
      break;
  }
});

app.post("/api/checkpaiduser", async (req, res) => {
  switch (req.method) {
    case "POST":
      try {
        const decodedToken = jwt_decode(req.body.userToken);
        console.log(decodedToken);
        const userInfo = await db.user.findOne({
          where: {
            id: decodedToken.sub,
          },
        });
        if (userInfo.memberStatus === "true") {
          // Paid member
          return res.json({
            message: "Authenticated Paid Member",
          });
        } else {
          // Not paid memeber
          return res.json({
            message: "Opps! Something went wrong.",
          });
        }
      } catch (error) {
        console.log("the error in /api/checkpaiduser: ", error);
        return res.json({
          message: "Opps! Something went wrong.",
        });
      }
      break;

    default:
      res.end("you need to post");
      break;
  }
});

app.post("/api/addbackup", async (req, res) => {
  switch (req.method) {
    case "POST":
      try {
        const decodedToken = jwt_decode(req.body.userToken);
        const userInfo = await db.user.findOne({
          where: {
            id: decodedToken.sub,
          },
        });
        if (userInfo.memberStatus === "true") {
          // Paid member
          const userDataInfo = await db.userdata.findOne({
            where: {
              userid: decodedToken.sub,
            },
          });
          let backupList = JSON.parse(userDataInfo.backups) ?? [];
          let serverList = JSON.parse(userDataInfo.dataValues.ftpservers);
          backupList.push(serverList[req.body.ftpListCount]);
          let currentBackupIndex = backupList.length;
          backupList.map((list) => {
            if (
              list.backupStatus === "active" ||
              list.backupStatus === "fail"
            ) {
              return;
            } else {
              list.backupStatus = "pending";
            }
          });
          // now add to backup column
          try {
            const updateLog = await db.userdata.update(
              {
                backups: JSON.stringify(backupList),
              },
              {
                returning: true,
                where: {
                  userid: decodedToken.sub,
                },
                plain: true,
              }
            );
            console.log(
              `add backup update success!\nBeginning FTP Pull for: ${userInfo.email}`
            );
            if (serverList[req.body.ftpListCount].servertype === "ftp") {
              // ftp
              pull_ftp(
                serverList[req.body.ftpListCount].serveraddress,
                serverList[req.body.ftpListCount].serverport,
                serverList[req.body.ftpListCount].serverusername,
                serverList[req.body.ftpListCount].serverpassword,
                "/user/luke/ftpbackup",
                decodedToken,
                currentBackupIndex
              )
            } else {
              // sftp
            }
            return res.json({
              message: "Success",
            });
          } catch (error) {
            console.log("error in addbackup try-catch: ", error);
            return res.json({
              message: "Opps! Something went wrong.",
            });
          }
        } else {
          // Not paid memeber
          return res.json({
            message: "Opps! Something went wrong.",
          });
        }
      } catch (error) {
        console.log("the error in /api/checkpaiduser: ", error);
        return res.json({
          message: "Opps! Something went wrong.",
        });
      }
      break;

    default:
      res.end("you need to post");
      break;
  }
});

app.put("/api/contact", async (req, res) => {
  switch (req.method) {
    case "PUT":
      if (!req.body) {
        return res.status(404).json("Opps! Something went wrong.").end();
      } else {
        try {
          try {
            const updateLog = await db.contact.create(
              {
                fullname: req.body.fullname,
                email: req.body.email,
                message: req.body.message,
              },
              {
                returning: true,
                plain: true,
              }
            );
            if (updateLog) {
              // row create success
              var mailOptions = {
                from: process.env.GMAIL_FROM,
                to: process.env.GMAIL_TO,
                subject: `New KingKong Contact Message: ${moment().format(
                  "MMMM Do YYYY, h:mm:ss a"
                )}`,
                text: `From: ${req.body.fullname}, ${req.body.email}\nMessage: ${req.body.message}`,
              };

              transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                  console.log(error);
                } else {
                  console.log("Email sent: " + info.response);
                }
              });
              res.json({
                message: "Success",
              });
            }
          } catch (error) {
            // row create error
            console.log("err here in /api/contact: ", error);
            res.json({
              message: "Opps! An error has occured.",
            });
          }
          res.end();
        } catch (seqFindErr) {
          res.json({
            message: "Opps! An error has occured.",
          });
        }
      }
      break;

    default:
      res.end("you need to put");
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
