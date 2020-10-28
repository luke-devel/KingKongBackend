"use strict";
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const user = require("./User");
const userdata = require("./UserData");
const contact = require("./Contact");


const Sequelize = require("sequelize");

let sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: "mysql",
    }
);

const db = {
    user: user(sequelize, Sequelize),
    userdata: userdata(sequelize, Sequelize),
    contact: contact(sequelize, Sequelize),
};

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;