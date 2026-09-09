export type Role = 'customer' | 'mechanic' | 'admin';
export const fixtureState = {
  services: [{ id: 'svc-diagnostic', name: 'Mechanical diagnosis', delivery: ['mobile', 'shop'], pricingPath: 'diagnostic' }, { id: 'svc-tire', name: 'Tire replacement', delivery: ['mobile'], pricingPath: 'fixed' }, { id: 'svc-body', name: 'Bodywork and paint consultation', delivery: ['shop'], pricingPath: 'estimate_range' }],
  vehicles: [{ id: 'vehicle-1', customerId: 'customer-demo', year: 2020, make: 'Toyota', model: 'Camry', mileage: 42000 }] as Array<{ id: string; customerId: string; year: number; make: string; model: string; mileage?: number; vin?: string }>,
  requests: [] as Array<Record<string, any>>,
  uploads: [] as Array<Record<string, any>>,
  jobs: [{ id: 'job-1', customerId: 'customer-demo', vehicleId: 'vehicle-1', mechanicId: 'mechanic-demo', quoteId: 'quote-1', status: 'awaiting_approval', version: 2, allowedActions: ['approve_change_order', 'send_message'] }],
  quotes: [{ id: 'quote-1', customerId: 'customer-demo', status: 'issued', version: 1, currency: 'USD', totalMinor: 12900, lines: [{ description: 'Diagnostic appointment', amountMinor: 12900 }] }],
  findings: [] as Array<Record<string, any>>,
  messages: [] as Array<Record<string, any>>,
  history: [] as Array<Record<string, any>>
};
