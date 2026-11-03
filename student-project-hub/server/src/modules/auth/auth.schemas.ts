import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores')
  .transform((v) => v.toLowerCase());

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: passwordSchema,
  university: z.string().trim().min(2, 'University is required').max(150),
  department: z.string().trim().min(2, 'Department or programme is required').max(150),
});

export const loginSchema = z.object({
  /** Email address or username. */
  identifier: z.string().trim().toLowerCase().min(1, 'Email or username is required').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
