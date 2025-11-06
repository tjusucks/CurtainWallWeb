
// sendEmail.js
import nodemailer from "nodemailer"; // 使用 import 引入 nodemailer

export default async function sendEmail(alertMessage) {
  let transporter = nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true, // 使用 SSL
    auth: {
      user: 'smart_care_tongji@163.com', // 你的邮箱地址
      pass: 'NJW7m3FY2JPr2L4J',           // 邮箱密码（或应用专用密码）
    },
  });


  // 邮件的内容
  let mailOptions = {
    from: '"Smart Care" <smart_care_tongji@163.com>', // 发送者信息
    to: '2351041@tongji.educ.cn',                                               // 接收者邮箱
    subject:'警报通知',                                          // 邮件主题
    text:'alertMessage',                
  };



  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("邮件已发送:", info.messageId);
  } catch (error) {
    console.error("邮件发送失败:", error.message);
  }
}
