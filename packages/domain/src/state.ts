export type Role = 'customer' | 'mechanic' | 'admin';
export const fixtureState = {
  services: [{ id: 'svc-diagnostic', name: 'Mechanical diagnosis', delivery: ['mobile', 'shop'], pricingPath: 'diagnostic' }, { id: 'svc-tire', name: 'Tire replacement', delivery: ['mobile'], pricingPath: 'fixed' }, { id: 'svc-body', name: 'Bodywork and paint consultation', delivery: ['shop'], pricingPath: 'estimate_range' }],
  vehicles: [{ id: 'vehicle-1', customerId: 'customer-demo', year: 2020, make: 'Toyota', model: 'Camry', mileage: 42000 as number | undefined }],
  jobs: [{ id: 'job-1', customerId: 'customer-demo', mechanicId: 'mechanic-demo', status: 'awaiting_approval', version: 2, allowedActions: ['approve_change_order', 'send_message'] }],
  quotes: [{ id: 'quote-1', customerId: 'customer-demo', status: 'issued', version: 1, currency: 'USD', totalMinor: 12900, lines: [{ description: 'Diagnostic appointment', amountMinor: 12900 }] }]
};
