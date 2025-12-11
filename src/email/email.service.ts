import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPayslip(
    to: string,
    pdfBuffer: Buffer,
    fileName: string,
    employeeName: string,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: `Your Payslip - ${fileName}`,
        html: `
          <p>Dear ${employeeName},</p>
          <p>Please find your payslip attached below.</p>
          <p>Best regards,<br>HR Department</p>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      return true;
    } catch (error) {
      console.error(`Error sending email to ${to}:`, error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}
