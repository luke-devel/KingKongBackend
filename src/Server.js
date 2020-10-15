import express from "express";
import bcrypt from "bcrypt";
import db from "../models";

const port = process.env.PORT;
const app = express();

app.listen(port, process.env.HOST, () => {
  console.log(`KingKong Express Backend Listening at: http://${process.env.HOST}:${port}`);
});

app.get("/", (req, res) => {
  res.json("hello world");
});

// Registers user into MySql Database
app.post("/registeruser", async (req, res) => {
  // let user;
  // console.log(req.headers.password);
  // res.send("hello");
  try {
    // adding new user to database, if there is an error we will return false
    await db.user.create({
      fullname: req.headers.fullname,
      email: req.headers.email,
      password: req.headers.password,
      phone: req.headers.phone,
    });
    // Status is returned if row was added into database with no error.
    res.status(253);
    res.end();
  } catch (error) {
    // Error adding row into database, or error with request data.
    console.log("err in src/Server.js: sequelize,", error);
    res.status(400);
    res.end();
  }
});
