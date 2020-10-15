import axios from "axios";
import express from "express";
const port = process.env.PORT;
const app = express();

app.listen(port, process.env.HOST, () => {
  console.log(`Example app listening at http://${process.env.HOST}:${port}`);
});

app.get("/", (req, res) => {
  res.send("hello");
});
