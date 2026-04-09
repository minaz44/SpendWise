// backend/src/__tests__/smsParser.test.js

const { parseSMS } = require('../utils/smsParser');

describe('📱 SMS Parser', () => {

  describe('UPI Debit Messages', () => {
    it('should parse SBI UPI debit SMS', () => {
      const msg = 'Dear Customer, Rs.500.00 has been debited from your SBI account ending 1234 to UPI ID xyz@okaxis on 29-Mar-26. Ref No. 123456789012.';
      const result = parseSMS(msg);

      expect(result).not.toBeNull();
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(500);
      expect(result.smsData.bankName).toBe('SBI');
      expect(result.paymentMethod).toBe('upi');
    });

    it('should parse HDFC debit SMS', () => {
      const msg = 'Rs.1200 debited from HDFC Bank a/c XX1234 on 01-Apr-26. UPI:abc@paytm. Available balance Rs.8500.';
      const result = parseSMS(msg);

      expect(result).not.toBeNull();
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(1200);
      expect(result.smsData.bankName).toBe('HDFC');
    });

    it('should parse Paytm payment SMS', () => {
      const msg = 'You have paid Rs.350 to Swiggy via Paytm UPI. Transaction ID: TXN123456789.';
      const result = parseSMS(msg);

      expect(result).not.toBeNull();
      expect(result.type).toBe('expense');
      expect(result.amount).toBe(350);
    });
  });

  describe('Credit Messages', () => {
    it('should parse salary credit SMS', () => {
      const msg = 'Rs.50000.00 credited to your SBI account ending 5678 on 01-Apr-26. Available balance: Rs.52000.';
      const result = parseSMS(msg);

      expect(result).not.toBeNull();
      expect(result.type).toBe('income');
      expect(result.amount).toBe(50000);
    });

    it('should parse UPI received SMS', () => {
      const msg = 'Rs.200 received in your account from friend@okicici via UPI. Ref: 987654321098.';
      const result = parseSMS(msg);

      expect(result).not.toBeNull();
      expect(result.type).toBe('income');
      expect(result.amount).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should return null for OTP SMS', () => {
      const msg = 'Your OTP is 123456. Do not share with anyone. Valid for 10 minutes.';
      expect(parseSMS(msg)).toBeNull();
    });

    it('should return null for promotional SMS', () => {
      const msg = 'Congratulations! You have won a lottery prize of Rs.10,00,000. Click here to claim.';
      expect(parseSMS(msg)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseSMS('')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(parseSMS(null)).toBeNull();
    });

    it('should handle amounts with commas', () => {
      const msg = 'Rs.1,500.00 debited from your ICICI account via UPI.';
      const result = parseSMS(msg);
      expect(result?.amount).toBe(1500);
    });

    it('should extract ref number', () => {
      const msg = 'Rs.800 debited. UPI Ref: UTR123456789012. Check app for details.';
      const result = parseSMS(msg);
      expect(result?.smsData.refNumber).toBeDefined();
    });
  });

  describe('Confidence Score', () => {
    it('should give high confidence for complete UPI SMS', () => {
      const msg = 'Rs.500 debited from SBI a/c via UPI to merchant@okaxis. Ref: TXN12345678901.';
      const result = parseSMS(msg);
      expect(result?.confidence).toBeGreaterThanOrEqual(70);
    });

    it('should give lower confidence for minimal SMS', () => {
      const msg = 'Rs.100 debited.';
      const result = parseSMS(msg);
      if (result) {
        expect(result.confidence).toBeLessThan(70);
      }
    });
  });
});