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

  async sendPasswordResetToken(
    to: string,
    token: string,
    userName: string,
  ): Promise<boolean> {
    try {
      const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Password Reset Request',
        html: `
          <p>Dear ${userName},</p>
          <p>You have requested to reset your password. Please click the button below to reset it:</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you did not request this password reset, please ignore this email.</p>
          <p>Best regards,<br>Payslip Mailer Team</p>
        `,
      });
      return true;
    } catch (error) {
      console.error(`Error sending password reset email to ${to}:`, error);
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

  async sendEmailVerification(
    to: string,
    token: string,
    userName: string,
  ): Promise<boolean> {
    try {
      const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Verify Your Email Address',
        html: `
          <p>Dear ${userName},</p>
          <p>Account created. Please verify your email address by clicking the link below:</p>
          <p><a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>Best regards,<br>Payslip Mailer Team</p>
        `,
      });
      return true;
    } catch (error) {
      console.error(`Error sending verification email to ${to}:`, error);
      return false;
    }
  }

  async send2FAToken(
    to: string,
    token: string,
    userName: string,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Your Two-Factor Authentication Code',
        html: `
          <p>Dear ${userName},</p>
          <p>Your two-factor authentication code is:</p>
          <h2 style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #28a745; text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">${token}</h2>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not attempt to log in, please secure your account immediately.</p>
          <p>Best regards,<br>Payslip Mailer Team</p>
        `,
      });
      return true;
    } catch (error) {
      console.error(`Error sending 2FA token email to ${to}:`, error);
      return false;
    }
  }
}
