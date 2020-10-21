import express from "express";
import bcrypt from "bcrypt";
import db from "../models";
import jwt from "jsonwebtoken";

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
      { id: user.dataValues.id, email: user.dataValues.email, loggedIn: 'true' },
      process.env.JWT_PRIVATE_KEY
    );
    res.status(253).json({token}).end();
  } catch (error) {
    console.log('error in register ()');
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
            { id: user.id, email: user.email, loggedIn: 'true' },
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
