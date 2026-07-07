'use strict';

const { z } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Datos inválidos', details: errors });
    }
    req.validated = result.data;
    next();
  };
}

const schemas = {
  login: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Contraseña requerida')
  }),

  createBudget: z.object({
    provider_id: z.string().uuid({ message: 'provider_id inválido' }).optional().nullable(),
    number: z.string().optional().default(''),
    date: z.string().optional(),
    type: z.enum(['history', 'new']).optional().default('history'),
    notes: z.string().optional().default(''),
    details: z.array(z.object({
      description: z.string().optional().default(''),
      quantity: z.number().positive().optional().default(1),
      unit: z.string().optional().default('u'),
      unit_price: z.number().min(0).optional().default(0),
      total_price: z.number().min(0).optional().default(0),
      notes: z.string().optional().default('')
    })).optional().default([])
  }),

  createProvider: z.object({
    name: z.string().min(1, 'El nombre es requerido').max(255, 'El nombre no puede exceder 255 caracteres'),
    cuit: z.string().optional().default(''),
    address: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    email: z.string().optional().default(''),
    city: z.string().optional().default(''),
    province: z.string().optional().default(''),
    notes: z.string().optional().default('')
  }),

  updateProvider: z.object({
    name: z.string().min(1, 'El nombre es requerido').max(255, 'El nombre no puede exceder 255 caracteres'),
    cuit: z.string().optional().default(''),
    address: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    email: z.string().optional().default(''),
    city: z.string().optional().default(''),
    province: z.string().optional().default(''),
    notes: z.string().optional().default('')
  }),

  createArticle: z.object({
    name: z.string().min(1, 'El nombre es requerido').max(255, 'El nombre no puede exceder 255 caracteres'),
    aliases: z.array(z.string()).optional().default([]),
    category: z.string().optional().default(''),
    unit: z.string().optional().default('unidad'),
    tags: z.array(z.string()).optional().default([]),
    notes: z.string().optional().default('')
  }),

  updateArticle: z.object({
    name: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    is_favorite: z.boolean().optional()
  }),

  createUser: z.object({
    name: z.string().min(1, 'Nombre requerido').max(255, 'El nombre no puede exceder 255 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Contraseña requerida'),
    role: z.enum(['admin', 'purchases', 'readonly'], {
      errorMap: () => ({ message: 'Rol inválido. Debe ser: admin, purchases o readonly' })
    })
  }),

  updateUser: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(['admin', 'purchases', 'readonly']).optional(),
    is_active: z.boolean().optional()
  }),

  changePassword: z.object({
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
  }),

  budgetStatus: z.object({
    status: z.enum(['pending', 'reviewed', 'approved'], {
      errorMap: () => ({ message: 'Estado inválido. Debe ser: pending, reviewed o approved' })
    })
  }),

  createComparison: z.object({
    budget_id: z.string().uuid('budget_id debe ser un UUID válido'),
    name: z.string().optional().default('')
  }),

  createMultiComparison: z.object({
    budget_ids: z.array(z.string().uuid()).min(2, 'Se requieren al menos 2 presupuestos')
  })
};

module.exports = { validate, schemas };
