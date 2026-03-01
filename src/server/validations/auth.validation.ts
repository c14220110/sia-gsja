import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email / Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export type LoginInput = z.infer<typeof loginSchema>;
