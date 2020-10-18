import express from "express";
import bcrypt from "bcrypt";
import db from "../models";

const port = process.env.PORT;
const app = express();

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
  // console.log(req.headers.password);
  // res.send("hello");
   !req.headers.fullname && res.json("missing reqs");
   res.end

  try {
    // adding new user to database, if there is an error we will return false
    let dbRes;
    try {

      dbRes = await db.user.create({
        fullname: req.headers.fullname,
        email: req.headers.email,
        password: req.headers.password,
        phone: req.headers.phone,
      });
    } catch (seqErr) {
      console.log(seqErr.original.errno);
      ("Duplicate Email or Phone num found, sending 409 res.status(409)");
      seqErr.original.errno === 1062 && res.status(409);
      res.end();
    }
    // Status is returned if row was added into database with no error.
    res.status(253);
    res.end();
  } catch (error) {1
    console.log(error.original.code);
    // Error adding row into database, or error with request data.
    console.log();
    res.end();
  }
});

app.get("/api/login", async (req, res) => {
  switch (req.method) {
    case "POST":
      let user;
      try {
        try {
          user = await db.user.findOne({
            where: {
              email: req.body.userinput,
            },
          });
          if (!user) {
            throw err;
          }
        } catch (e) {
          user = await db.user.findOne({
            where: {
              username: req.body.userinput,
            },
          });
          if (!user) {
            throw err;
          }
        }
      } catch (e) {
        console.log("caught correct");
        console.log(e);
        res.end("invalid username or email");
      }

      if (user) {
        const result = await bcrypt.compare(req.body.password, user.password);
        if (result) {
          // if password is correct
          const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.secretKey
          );
          res.status(201);
          res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            token,
          });
        } else {
          console.log("invalid password");
          res.end("invalid password");
        }
      }
      break;

    default:
      res.end("you need to post");
      break;
  }
});
