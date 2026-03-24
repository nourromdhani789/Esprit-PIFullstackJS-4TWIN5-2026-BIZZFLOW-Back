import { Injectable } from '@nestjs/common';

export interface ScanResult {
  amount: number;
  date: string;
  supplier: string;
  confidence: number;
}

@Injectable()
export class AiScannerService {
  /**
   * Mock AI receipt scanner
   * Simulates OCR/AI extraction for expense receipts
   * 
   * NOTE: This is a MOCK implementation for Sprint 4.
   * Replace this with real AI/OCR service in future sprint:
   * - Google Vision API
   * - AWS Textract
   * - Azure Form Recognizer
   * - OpenAI GPT-4 Vision
   */
  async scanReceipt(file: Express.Multer.File): Promise<ScanResult> {
    // Simulate processing time
    await this.delay(1000);

    // Try basic parsing from filename
    const filename = file.originalname.toLowerCase();
    
    // Extract potential amount from filename (if it contains numbers)
    let amount = this.extractAmountFromFilename(filename);
    
    // If no amount found in filename, generate random realistic amount
    if (!amount) {
      amount = this.generateMockAmount();
    }

    // Try to extract supplier from filename
    let supplier = this.extractSupplierFromFilename(filename);

    return {
      amount,
      date: new Date().toISOString().split('T')[0], // Today's date
      supplier,
      confidence: 0.75, // Mock confidence score
    };
  }

  /**
   * Try to extract amount from filename
   * Example: "receipt_25.50_grocery.jpg" → 25.50
   */
  private extractAmountFromFilename(filename: string): number | null {
    // Look for patterns like: amount_50.00, price_100, $25.50, etc.
    const patterns = [
      /[_-](\d+\.\d{2})[_-]/,  // _25.50_ or -25.50-
      /[_-](\d+)[_-]/,         // _100_ or -100-
      /\$(\d+\.?\d{0,2})/,     // $50 or $50.00
      /amount[_-]?(\d+\.?\d{0,2})/i,  // amount50 or amount_50
      /price[_-]?(\d+\.?\d{0,2})/i,   // price25 or price_25
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0 && value < 10000) {
          return value;
        }
      }
    }
    return null;
  }

  /**
   * Try to extract supplier name from filename
   * Example: "walmart_receipt.jpg" → "Walmart"
   */
  private extractSupplierFromFilename(filename: string): string {
    const commonSuppliers = [
      'walmart', 'target', 'amazon', 'costco', 'grocery', 'restaurant',
      'gas', 'pharmacy', 'office', 'staples', 'bestbuy', 'uber', 'lyft',
      'airbnb', 'hotel', 'airline', 'taxi', 'coffee', 'cafe', 'starbucks'
    ];

    // Remove extension and common words
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|gif|pdf)$/i, '');
    const cleanName = nameWithoutExt.replace(/(receipt|invoice|bill|expense|img|image|photo|scan)/gi, '');
    
    // Look for known suppliers
    for (const supplier of commonSuppliers) {
      if (cleanName.includes(supplier)) {
        return this.capitalizeFirst(supplier);
      }
    }

    // Extract first word as potential supplier
    const firstWord = cleanName.split(/[_-\s]/)[0];
    if (firstWord && firstWord.length > 2) {
      return this.capitalizeFirst(firstWord);
    }

    return 'Mock Supplier';
  }

  /**
   * Generate a random realistic expense amount
   */
  private generateMockAmount(): number {
    // Common expense ranges
    const ranges = [
      { min: 5, max: 50, weight: 0.4 },    // Small expenses (coffee, parking)
      { min: 20, max: 150, weight: 0.35 }, // Medium (groceries, meals)
      { min: 100, max: 500, weight: 0.2 }, // Large (supplies, equipment)
      { min: 500, max: 2000, weight: 0.05 }, // Major (travel, events)
    ];

    const random = Math.random();
    let cumulative = 0;
    
    for (const range of ranges) {
      cumulative += range.weight;
      if (random <= cumulative) {
        return parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(2));
      }
    }
    
    return parseFloat((Math.random() * 100 + 10).toFixed(2));
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
