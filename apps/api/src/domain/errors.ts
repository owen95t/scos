export class InsufficientStockError extends Error {
  readonly requestId?: string;
  readonly quantity?: number;
  constructor(message: string, context?: { requestId?: string; quantity?: number }) {
    super(message);
    this.name = "InsufficientStockError";
    this.requestId = context?.requestId;
    this.quantity = context?.quantity;
  }
}

export class InvalidOrderError extends Error {
  readonly requestId?: string;
  readonly quantity?: number;
  constructor(message: string, context?: { requestId?: string; quantity?: number }) {
    super(message);
    this.name = "InvalidOrderError";
    this.requestId = context?.requestId;
    this.quantity = context?.quantity;
  }
}
