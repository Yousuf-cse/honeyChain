import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { generateToken, requireAuth, type AuthUser } from "../middleware/auth.js";

export const authRouter = Router();

// In-memory user store for demo layer
interface StoredUser {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  role: "admin" | "beekeeper" | "lab" | "buyer";
}

const userStore = new Map<string, StoredUser>();
const emailIndex = new Map<string, string>(); // email -> userId

// Pre-seed a demo user
const demoHash = bcrypt.hashSync("DemoPass123!", 10);
const demoUserId = "usr_demo_honeychain_001";
userStore.set(demoUserId, {
  userId: demoUserId,
  username: "demo_beekeeper",
  email: "demo@honeychain.io",
  passwordHash: demoHash,
  createdAt: new Date().toISOString(),
  role: "beekeeper",
});
emailIndex.set("demo@honeychain.io", demoUserId);

/**
 * POST /api/v1/auth/register
 * Creates a new user account and returns a JWT.
 */
authRouter.post("/register", async (req: Request, res: Response) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: username, email, password",
    });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 8 characters",
    });
  }

  if (emailIndex.has(String(email).toLowerCase())) {
    return res.status(409).json({
      success: false,
      error: "Email already registered",
    });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const userId = `usr_${randomUUID()}`;
  const now = new Date().toISOString();

  const user: StoredUser = {
    userId,
    username: String(username).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    createdAt: now,
    role: role && ["admin", "beekeeper", "lab", "buyer"].includes(role) ? role : "beekeeper",
  };

  userStore.set(userId, user);
  emailIndex.set(user.email, userId);

  const tokenPayload: AuthUser = {
    userId,
    username: user.username,
    email: user.email,
  };
  const token = generateToken(tokenPayload);

  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      userId,
      username: user.username,
      email: user.email,
      role: user.role,
      token,
    },
  });
});

/**
 * POST /api/v1/auth/login
 * Authenticates user and returns JWT token.
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: email, password",
    });
  }

  const userId = emailIndex.get(String(email).toLowerCase());
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Invalid email or password",
    });
  }

  const user = userStore.get(userId)!;
  const valid = await bcrypt.compare(String(password), user.passwordHash);

  if (!valid) {
    return res.status(401).json({
      success: false,
      error: "Invalid email or password",
    });
  }

  const tokenPayload: AuthUser = {
    userId: user.userId,
    username: user.username,
    email: user.email,
  };
  const token = generateToken(tokenPayload);

  return res.status(200).json({
    success: true,
    data: {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      token,
      expiresIn: "7d",
    },
  });
});

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user profile.
 */
authRouter.get("/me", requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = userStore.get(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});
