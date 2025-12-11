import { Injectable, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  async extractIppisFromPdf(pdfBuffer: Buffer): Promise<string | null> {
    try {
      const data = await pdfParse(pdfBuffer);
      const text = data.text;

      // Extract IPPIS number - adjust regex based on your payslip format
      // Example format: "IPPIS Number: IPPIS001" or similar
      const ippisMatch = text.match(/IPPIS\s*:?\s*([A-Z0-9]+)/i);
      if (ippisMatch && ippisMatch[1]) {
        return ippisMatch[1].trim();
      }

      return null;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new BadRequestException('Failed to parse PDF file');
    }
  }

  async splitBulkPdf(
    pdfBuffer: Buffer,
    uploadId: string,
  ): Promise<{ ippisNumber: string; pdfBuffer: Buffer }[]> {
    try {
      const data = await pdfParse(pdfBuffer);

      // This is a basic implementation
      // For production, you may need to use more advanced PDF splitting libraries
      // like pdfjs or extract individual pages based on payslip markers

      const result = [
        {
          ippisNumber: await this.extractIppisFromPdf(pdfBuffer),
          pdfBuffer: pdfBuffer,
        },
      ];

      return result.filter((r) => r.ippisNumber !== null);
    } catch (error) {
      console.error('Error splitting PDF:', error);
      throw new BadRequestException('Failed to split PDF file');
    }
  }

  async savePdfFile(
    pdfBuffer: Buffer,
    fileName: string,
    uploadId: string,
  ): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', uploadId);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }
}
