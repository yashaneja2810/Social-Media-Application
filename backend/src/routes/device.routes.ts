import { Router, Response } from 'express';
import { AuthRequest, verifySupabaseToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { DeviceModel } from '../models/device.model';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createVerificationSchema = Joi.object({
  device_id: Joi.string().required(),
  device_name: Joi.string().required(),
});

const verifyDeviceSchema = Joi.object({
  device_id: Joi.string().required(),
  verification_code: Joi.string().length(6).required(),
});

// Request device verification
router.post('/verify/request', verifySupabaseToken, validate(createVerificationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { device_id, device_name } = req.body;

    const verification = await DeviceModel.createVerification(userId, device_id, device_name);

    if (!verification) {
      res.status(400).json({ error: 'Failed to create verification request' });
      return;
    }

    res.json({
      success: true,
      verification_code: verification.verification_code,
      expires_at: verification.expires_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request verification' });
  }
});

// Verify device with code
router.post('/verify/confirm', verifySupabaseToken, validate(verifyDeviceSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { device_id, verification_code } = req.body;

    const success = await DeviceModel.verifyDevice(userId, device_id, verification_code);

    if (!success) {
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify device' });
  }
});

// Generate QR code for device verification
router.post('/verify/qr', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { device_id } = req.body;

    if (!device_id) {
      res.status(400).json({ error: 'Device ID required' });
      return;
    }

    const qrData = await DeviceModel.generateQRData(userId, device_id);

    if (!qrData) {
      res.status(400).json({ error: 'Failed to generate QR data' });
      return;
    }

    res.json({ qr_data: qrData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Verify device via QR scan
router.post('/verify/qr/scan', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const { qr_data } = req.body;

    if (!qr_data) {
      res.status(400).json({ error: 'QR data required' });
      return;
    }

    const success = await DeviceModel.verifyViaQR(qr_data);

    if (!success) {
      res.status(400).json({ error: 'Invalid QR code' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify QR code' });
  }
});

// Get verified devices
router.get('/', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const devices = await DeviceModel.getVerifiedDevices(userId);
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

// Remove device
router.delete('/:deviceId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const deviceId = req.params.deviceId;

    const success = await DeviceModel.removeDevice(userId, deviceId);

    if (!success) {
      res.status(400).json({ error: 'Failed to remove device' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

export default router;
