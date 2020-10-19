module.exports = (sequelize, Sequelize) => {
  const UserData = sequelize.define(
    "userdata",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userid: {
        type: Sequelize.INTEGER,
      },
      ftpservers: {
        type: Sequelize.TEXT("long"),
      },
      schedule: {
        type: Sequelize.TEXT("long"),
      },
      backups: {
        type: Sequelize.TEXT("long"),
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

  return UserData;
};
