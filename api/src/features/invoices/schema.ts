import { z } from 'zod';

const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

function stripHtml(val: string): string {
  return val.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

export const createInvoiceSchema = z.object({
  idSale: z.number().int().positive(),
  customer: z.object({
    legal_name: z.string()
      .min(1, 'El nombre o razón social es requerido')
      .max(300)
      .transform(stripHtml),
    tax_id: z.string()
      .min(12, 'El RFC debe tener al menos 12 caracteres')
      .max(13, 'El RFC no puede tener más de 13 caracteres')
      .transform((val) => val.replace(/[^A-ZÑ&0-9]/gi, '').toUpperCase())
      .pipe(z.string().regex(rfcRegex, 'Formato de RFC inválido')),
    tax_system: z.string().min(2, 'El régimen fiscal es requerido').max(3),
    zip: z.string().length(5, 'El código postal debe tener 5 dígitos').regex(/^\d{5}$/, 'Solo dígitos'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
  }),
  use: z.string().min(2, 'El uso de CFDI es requerido').max(4),
  payment_form: z.string().min(2, 'La forma de pago es requerida').max(2),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const SAT_PRODUCT_KEY_GYM = '93151501';
export const SAT_PRODUCT_KEY_DEFAULT = '93051601'; // Servicios de gimnasios
export const SAT_UNIT_KEY = 'E48';
export const SAT_UNIT_NAME = 'Unidad de servicio';
