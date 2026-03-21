class ForbiddenErrorClass extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class UnauthorizedErrorClass extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// Export as callable functions (sdk.ts uses throw ForbiddenError("msg") without new)
export function ForbiddenError(message?: string): ForbiddenErrorClass {
  return new ForbiddenErrorClass(message);
}

export function UnauthorizedError(message?: string): UnauthorizedErrorClass {
  return new UnauthorizedErrorClass(message);
}
