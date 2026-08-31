import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "honeychain-dev-secret-change-in-production";
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "esp_key_honeychain_default";

export interface AuthUser {
  userId: string;
  username: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * JWT authentication middleware.
 * Checks Authorization: Bearer <token> header.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Missing or invalid Authorization header. Expected: Bearer <JWT_TOKEN>",
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "Invalid or expired JWT token",
    });
  }
}

/**
 * Device API key authentication middleware.
 * Checks X-Device-API-Key header.
 */
export function requireDeviceKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-device-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: "Missing X-Device-API-Key header",
    });
    return;
  }

  if (apiKey !== DEVICE_API_KEY) {
    res.status(401).json({
      success: false,
      error: "Invalid Device API Key",
    });
    return;
  }

  next();
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}
