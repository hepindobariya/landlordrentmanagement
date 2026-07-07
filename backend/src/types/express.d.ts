// Augments Express's Request type so we can attach the authenticated
// landlord's id (derived from their Supabase JWT) in middleware.
declare global {
  namespace Express {
    interface Request {
      landlordId?: string
    }
  }
}

export {}
