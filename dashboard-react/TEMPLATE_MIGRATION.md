# Template migration

The supplied shadcn-admin template is the source of truth for dashboard UI. Do not replace its components with handwritten lookalikes.

Required integration points:
- AppSidebar / SidebarProvider for the dashboard shell and collapse behavior
- Header / ProfileDropdown for authenticated chrome
- DataTableToolbar + DataTablePagination for all tables
- Profile components for the account page
- User management components for staff/superuser administration
- Dialog/form components for lookup, scanner and user creation

Ricaspa API/auth/data behavior must be wired into these components without changing their visual structure unnecessarily.
