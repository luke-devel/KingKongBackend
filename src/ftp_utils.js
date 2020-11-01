const ftp = require("basic-ftp");
import SftpClient from "ssh2-sftp-client";
import path from "path";
import db from "../models";

const formatBytes = (a, b = 2) => {
  if (0 === a) return "0 Bytes";
  const c = 0 > b ? 0 : b,
    d = Math.floor(Math.log(a) / Math.log(1024));
  return (
    parseFloat((a / Math.pow(1024, d)).toFixed(c)) +
    " " +
    ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d]
  );
};

//Duplicate an sftp server
export const pull_sftp = async (
  hostname,
  portnum,
  uname,
  pwd,
  dest,
  decodedToken,
  currentBackupIndex,
) => {
  console.log('>>>>>>>>>>>>>>>>>', dest);
  const client = new SftpClient("pull-sftp");
  const dst = dest;
  const src = ".";
  const config = {
    host: hostname,
    port: portnum,
    username: uname,
    password: pwd,
  };
  try {
    await client.connect(config);
    client.on("download", (info) => {
      console.log(`Listener: Download ${info.source}`);
    });
    let rslt = await client.downloadDir(src, dst);
    return rslt;
  } catch (err) {
    console.log(err);
    // Err: set backupStatus to 'fail'
    try {
      const userData = await db.userdata.findOne({
        where: {
          userid: decodedToken.sub,
        },
      });
      let backupList = JSON.parse(userData.backups);
      backupList[currentBackupIndex - 1].backupStatus = "fail";
      const updateLog = await db.userdata.update(
        {
          backups: JSON.stringify(backupList),
        },
        {
          returning: true,
          where: {
            id: decodedToken.sub,
          },
          plain: true,
        }
      );
    } catch (error) {
      console.log("err here", error);
    }
  } finally {
    console.log('SFTP download successful for user id: ', decodedToken.sub);
    try {
      const userData = await db.userdata.findOne({
        where: {
          userid: decodedToken.sub,
        },
      });
      let backupList = JSON.parse(userData.backups);
      backupList[currentBackupIndex - 1].backupStatus = "active";
      const updateLog = await db.userdata.update(
        {
          backups: JSON.stringify(backupList),
        },
        {
          returning: true,
          where: {
            id: decodedToken.sub,
          },
          plain: true,
        }
      );
    } catch (error) {
      console.log("err here in success sftp for user id: ", decodedToken.sub);
    }
    await client.end();
  }
};

//Duplicate an ftp server
export const pull_ftp = async (
  hostname,
  portnum,
  uname,
  pwd,
  dest,
  decodedToken,
  currentBackupIndex,
  secure = false
) => {
  console.log('Inside ftp_utils.js, ', decodedToken);
  console.log('destination, ', dest);

  const client = new ftp.Client();

  client.trackProgress((info) => {
    //Called every time a file is added
    console.log("Transferred Overall", formatBytes(info.bytesOverall));
  });

  try {
    try {
      await client.access({
        host: hostname,
        port: portnum,
        user: uname,
        password: pwd,
        secure: secure,
      });
    } catch (err) {
      console.log("ftp_connection_error");
      try {
        const userData = await db.userdata.findOne({
          where: {
            userid: decodedToken.sub,
          },
        });
        let backupList = JSON.parse(userData.backups);
        backupList[currentBackupIndex - 1].backupStatus = "fail";
        const updateLog = await db.userdata.update(
          {
            backups: JSON.stringify(backupList),
          },
          {
            returning: true,
            where: {
              id: decodedToken.sub,
            },
            plain: true,
          }
        );
        // now if the ftp pull failed, then backupStatus will be marked 'fail'
      } catch (error) {
        console.log("err here", error);
      }
    }
    console.log(await client.list());
    await client.downloadToDir(dest, "/");
  } catch (err) {
    console.log("ftp_error", err);
    try {
      const userData = await db.userdata.findOne({
        where: {
          userid: decodedToken.sub,
        },
      });
      let backupList = JSON.parse(userData.backups);
      backupList[currentBackupIndex - 1].backupStatus = "fail";
      const updateLog = await db.userdata.update(
        {
          backups: JSON.stringify(backupList),
        },
        {
          returning: true,
          where: {
            id: decodedToken.sub,
          },
          plain: true,
        }
      );
      // now if the ftp pull failed, then backupStatus will be marked 'fail'
      return;
    } catch (error) {
      console.log("err here", error);
    }
  } finally {
    console.log('>>>>>> FTP download successful for user id: ', decodedToken.sub);
    try {
      const userData = await db.userdata.findOne({
        where: {
          userid: decodedToken.sub,
        },
      });
      let backupList = JSON.parse(userData.backups);
      backupList[currentBackupIndex - 1].backupStatus = "active";
      const updateLog = await db.userdata.update(
        {
          backups: JSON.stringify(backupList),
        },
        {
          returning: true,
          where: {
            id: decodedToken.sub,
          },
          plain: true,
        }
      );
      // now if the ftp pull failed, then backupStatus will be marked 'fail'
    } catch (error) {
      console.log("err here in success ftp for user id: ", decodedToken.sub);
    }
    await client.close();
  }
};

//Upload to ftp server
export const put_ftp = async (
  hostname,
  portnum,
  uname,
  pwd,
  dest,
  obj,
  secure = false
) => {
  const client = new ftp.Client();

  client.trackProgress((info) => {
    //Called every time a file is added
    console.log("File", info.name);
    console.log("Type", info.type);
    console.log("Transferred", formatBytes(info.bytes));
    console.log("Transferred Overall", formatBytes(info.bytesOverall));
  });

  try {
    try {
      await client.access({
        host: hostname,
        port: portnum,
        user: uname,
        password: pwd,
        secure: secure,
      });
    } catch (err) {
      obj.errors.push("ftp_connection_error");
    }
    console.log(await client.list());
    await client.uploadFromDir(dest, "/");
  } catch (err) {
    obj.errors.push("ftp_error");
    console.log(err);
  } finally {
    await client.close();
  }
};

//upload sftp
export const put_sftp = async (
  hostname,
  portnum,
  uname,
  pwd,
  dest,
  obj,
  secure = false
) => {
  const config = {
    host: hostname,
    username: uname,
    password: pwd,
    port: portnum,
  };

  const client = new SftpClient("upload-test");
  const src = path.join(__dirname, "..", "test", "testData", "upload-src");
  const dst = "/home/tim/upload-test";

  try {
    await client.connect(config);
    client.on("upload", (info) => {
      console.log(`Listener: Uploaded ${info.source}`);
    });
    await client.uploadDir(src, dst);
  } finally {
    obj.errors.push("sftp_error");
    await client.end();
  }
};

export default { pull_ftp, pull_sftp, put_ftp, put_sftp };
