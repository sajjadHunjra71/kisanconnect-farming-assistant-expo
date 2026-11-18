import { z } from 'zod';

/** Error values are i18n keys under `auth.errors`. */
export const emailSchema = z.string().trim().min(1, 'emailRequired').email('emailInvalid');
export const passwordSchema = z.string().min(8, 'passwordShort').max(72, 'passwordLong');

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'passwordRequired') });

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'nameRequired').max(80, 'nameLong'),
  email: emailSchema,
  password: passwordSchema,
});

export const resetSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'passwordMismatch', path: ['confirm'] });

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function validate<T extends z.ZodType>(schema: T, values: unknown): { ok: true; data: z.infer<T> } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
