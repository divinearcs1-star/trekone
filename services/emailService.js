const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.APP_PASS
  }
});

const sendMail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_ID,
            to,
            subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);

        console.log("Mail sent:", info.messageId);

    } catch (error) {
        console.log("Mail error:", error);
    }
};

module.exports = { sendMail };