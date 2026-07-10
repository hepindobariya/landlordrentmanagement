import { Router } from "express"
import { requireAuth } from "../middleware/auth"
import { expensesRouter } from "../modules/expenses/expenses.routes"
import { leasesRouter } from "../modules/leases/leases.routes"
import { maintenanceTicketsRouter } from "../modules/maintenanceTickets/maintenanceTickets.routes"
import { notificationsRouter } from "../modules/notifications/notifications.routes"
import { paymentsRouter } from "../modules/payments/payments.routes"
import { profileRouter } from "../modules/profile/profile.routes"
import { propertiesRouter } from "../modules/properties/properties.routes"
import { rentChargesRouter } from "../modules/rentCharges/rentCharges.routes"
import { reportsRouter } from "../modules/reports/reports.routes"
import { tenantsRouter } from "../modules/tenants/tenants.routes"
import { unitsRouter } from "../modules/units/units.routes"

// All /api/v1 routes require a valid Supabase access token.
export const apiRouter = Router()

apiRouter.use(requireAuth)

apiRouter.use("/me", profileRouter)
apiRouter.use("/properties", propertiesRouter)
apiRouter.use("/units", unitsRouter)
apiRouter.use("/tenants", tenantsRouter)
apiRouter.use("/leases", leasesRouter)
apiRouter.use("/rent-charges", rentChargesRouter)
apiRouter.use("/payments", paymentsRouter)
apiRouter.use("/maintenance-tickets", maintenanceTicketsRouter)
apiRouter.use("/reports", reportsRouter)
apiRouter.use("/expenses", expensesRouter)
apiRouter.use("/notifications", notificationsRouter)
