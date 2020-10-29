module.exports = (sequelize, Sequelize) => {
    const Contact = sequelize.define(
      "contact",
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
          unique: false,
        },
        message: {
            type: Sequelize.TEXT("long"),
            unique: false,
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
    return Contact;
  };
  