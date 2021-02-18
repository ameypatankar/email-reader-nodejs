const imaps = require("imap-simple");
const fs = require("fs");
const _ = require("lodash");
const path = require("path");
require('dotenv').config();
const cron = require('node-cron');
const nodemailer = require("nodemailer");



const config = {
  imap: {
    user: process.env.LOGIN_EMAIL,
    password: process.env.LOGIN_PASS,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    authTimeout: 3000
  }
};

cron.schedule('*/1 * * * *', () => {
    console.log('running a task 1 minutes');
    imaps.connect(config).then(function(connection) {
        connection
          .openBox("INBOX")
          .then(function() {
            // Fetch emails from the last 24h
            var delay = 24 * 3600 * 1000 * 3;
            var yesterday = new Date();
            yesterday.setTime(Date.now() - delay);
            yesterday = yesterday.toISOString();
            var searchCriteria = ["UNSEEN", ["SINCE", yesterday]];
            var fetchOptions = {
              bodies: ["HEADER", "TEXT"],
              struct: true,
              markSeen: false
            };
      
            // retrieve only the headers of the messages
            return connection.search(searchCriteria, fetchOptions);
          })
          .then(function(messages) {
            var attachments = [];
      
            messages.forEach(function(message) {
              var parts = imaps.getParts(message.attributes.struct);
              //Retrieve Body Content
              var all = _.find(message.parts, { which: "TEXT" });
              const headers = _.find(message.parts, { which: "HEADER" });
              const structure = {
                subject: headers.body.subject,
                from: headers.body.from,
                date: headers.body.date
              };
              console.log(headers.body.from[0]);
              // var html = Buffer.from(all.body, "base64").toString("ascii");
              const folderName = `email-outputs/${headers.body.from[0]}-${message.seqNo}`;
              const dir = folderName;
              if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, {
                      recursive: true
                  });
              }
              // const fileName = `content.txt`;
              var dirname = path.dirname(folderName);
              console.log({ dirname });
      
              fs.writeFile(`${folderName}/contents.txt`, all.body, "binary", function(err) {});
              // console.log(html)
              attachments = attachments.concat(
                parts
                  .filter(function(part) {
                    return (
                      part.disposition &&
                      part.disposition.type.toUpperCase() === "ATTACHMENT"
                    );
                  })
                  .map(function(part) {
                    // retrieve the attachments only of the messages with attachments
                    return connection
                      .getPartData(message, part)
                      .then(function(partData) {
                        return {
                          folderName,
                          from: headers.body.from[0],
                          filename: part.disposition.params.filename,
                          data: partData
                        };
                      });
                  })
              );
            });
      
            return Promise.all(attachments);
          })
          .then(function(attachments) {
            // console.log(attachments.length);
            attachments.forEach(data => {
              console.log({data});
              fs.writeFile(`${data.folderName}/${data.filename}` , data.data, "binary", function(err) {});
            });
            return sendEmail();
            // =>
            //    [ { filename: attachments.filename, data: Buffer() },
            //      { filename: 'pay-stub.pdf', data: Buffer() } ]
          }).catch(err => console.log({err}));
      });
});

async function sendEmail() {
    // let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.LOGIN_EMAIL, // generated ethereal user
        pass: process.env.LOGIN_PASS, // generated ethereal password
      },
    });
  
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: 'swapnil.rajput@blackstraw.ai', // sender address
      to: "kanishk.bansal@blackstraw.ai,amey.patankar@blackstraw.ai", // list of receivers
      subject: "Hello ✔", // Subject line
      text: "Hello world?", // plain text body
      html: "<b>Hello world?</b>", // html body
      attachments: [{
        fileName: 'dog',
        href: 'https://i.picsum.photos/id/237/200/300.jpg?hmac=TmmQSbShHz9CdQm0NkEjx1Dyh_Y984R9LpNrpvH2D_U',
      }],
    });
  
    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
  
    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

}

