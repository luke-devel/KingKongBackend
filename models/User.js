module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define(
    "user",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      fullname: {
        type: Sequelize.STRING,
        unique: false,
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
      },
      phone: {
        type: Sequelize.STRING,
        unique: true,
      },
      memberStatus: {
        type: Sequelize.STRING,
        defaultValue: "false",
      },
      memberExpiration: {
        type: Sequelize.STRING,
        defaultValue: "false",
      },
      adminStatus: {
        type: Sequelize.STRING,
        defaultValue: "false",
      },
      created: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      timestamps: false,
    }
  );

  return User;
};
