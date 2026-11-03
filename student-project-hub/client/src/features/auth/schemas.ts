import { z } from 'zod';

// Mirrors the server's validation so users get instant feedback; the server
// remains the source of truth and re-validates everything.

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
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores');

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100),
    username: usernameSchema,
    email: z.string().trim().email('Enter a valid email address'),
    university: z.string().trim().min(2, 'Enter your university').max(150),
    department: z.string().trim().min(2, 'Enter your department or programme').max(150),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
