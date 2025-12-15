import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import PdfParse from 'pdf-parse';

@Injectable()
export class PdfService {
  async extractIppisFromPdf(pdfBuffer: Buffer): Promise<string | null> {
    try {
      const data = await PdfParse(pdfBuffer);
      const text = data.text;

      // Extract IPPIS number - matches formats like:
      // "IPPIS Number: 96426", "IPPIS Number: FTC96426", "IPPIS Number: TI96426", "IPPIS Number: NA96426"
      // Also handles "IPPIS: 96426" or "IPPIS 96426"
      const ippisMatch = text.match(/IPPIS\s*(?:Number)?\s*:?\s*([A-Z0-9]+)/i);
      if (ippisMatch && ippisMatch[1]) {
        return ippisMatch[1].replace('Step', '').trim();
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
  ): Promise<{ ippisNumber: string|null; pdfBuffer: Buffer }[]> {
    try {
      // const data = await pdfParse(pdfBuffer);

      // This is a basic implementation
      // For production, you may need to use more advanced PDF splitting libraries
      // like pdfjs or extract individual pages based on payslip markers

      const result = [
        {
          ippisNumber: await this.extractIppisFromPdf(pdfBuffer),
          pdfBuffer: pdfBuffer,
        },
      ];

      console.log('result',result)
      return result;
      // return result.filter((r) => r.ippisNumber !== null);
    } catch (error) {
      console.error('Error splitting PDF:', error);
      throw new BadRequestException('Failed to split PDF file');
    }
  }

  /**
   * Extract all PDF files from a zip archive buffer. This function will
   * recursively extract nested zip files and return an array of {fileName, buffer}.
   */
  async extractPdfsFromZip(
    zipBuffer: Buffer,
  ): Promise<{ fileName: string; pdfBuffer: Buffer }[]> {
    try {
      const zip = await JSZip.loadAsync(zipBuffer);
      const files: { fileName: string; pdfBuffer: Buffer }[] = [];

      const entries = Object.values(zip.files) as any[];

      for (const entry of entries) {
        if (entry.dir) continue;

        const name = entry.name;
        const lower = name.toLowerCase();

        if (lower.endsWith('.pdf')) {
          const buf = await entry.async('nodebuffer');
          files.push({ fileName: path.basename(name), pdfBuffer: buf });
          continue;
        }

        if (lower.endsWith('.zip')) {
          const nestedBuf = await entry.async('nodebuffer');
          const nestedFiles = await this.extractPdfsFromZip(nestedBuf);
          // Keep original folder name as prefix to avoid collisions
          for (const nf of nestedFiles) {
            files.push({ fileName: `${path.basename(name)}::${nf.fileName}`, pdfBuffer: nf.pdfBuffer });
          }
          continue;
        }

        // ignore other file types
      }

      return files;
    } catch (error) {
      console.error('Error extracting zip:', error);
      throw new BadRequestException('Failed to extract ZIP archive');
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
