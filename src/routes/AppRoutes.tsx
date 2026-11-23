import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../features/auth";
import Sidebar from "../components/layout/Sidebar";
import LookupLayout from "../features/invoice/components/layout/LookupLayout";
import AgentPage from "../pages/AgentPage";
import BeneficiairePage from "../pages/BeneficiairePage";
import DeletionRequestsPage from "../pages/DeletionRequestsPage";
import PrestatairePage from "../pages/PrestatairePage";
import PriseEnChargePage from "../pages/PriseEnChargePage";
import ReferentielsPage from "../pages/ReferentielsPage";
import InvoicePage from "../pages/InvoicePage";
import T6Page from "../pages/T6Page";
import T5ParAnPage from "../pages/T5ParAn";
import T5ParAnParActePage from "../pages/T5ParAnParActe";
import T5ParSeancePage from "../pages/T5ParSeance";
import T5XConfigurationPage from "../pages/T5XConfiguration";
import AssistantGlobalPage from "../pages/AssistantGlobalPage";
import UserManagementPage from "../pages/UserManagementPage";
import RoleManagementPage from "../pages/RoleManagementPage";
import AuditSessionsPage from "../pages/AuditSessionsPage";
import PaiePage from "../pages/PaiePage";
import DashboardPage from "../pages/DashboardPage";
import StatisticsPage from "../pages/StatisticsPage";
import { fetchIdpLookupMock } from "../features/invoice/mocks/idpLookup";
import { ROUTES } from "../constants/routes";

function AppShell({ children }: { children: ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}

const accessibleRoutes = [
  ["/agents", "agents.read"],
  ["/beneficiaires", "beneficiaries.read"],
  ["/prestataires", "providers.read"],
  ["/pec", "attestations.read"],
  ["/factures", "invoices.read"],
  ["/factures/t6", "t6.read"],
  ["/paie", "payroll.read"],
  ["/statistiques", "reporting.read"],
  ["/assistant", "assistant.use"],
  ["/actes-prestations", "reference-data.read"],
  ["/referentiels", "reference-data.read"],
  ["/audit", "audit.read"],
  ["/demandes-suppression", "deletions.manage"],
] as const;

function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (hasPermission(permission)) return children;
  const fallback = accessibleRoutes.find(([, required]) =>
    hasPermission(required),
  );
  return fallback ? (
    <Navigate to={fallback[0]} replace />
  ) : (
    <div className="p-8 text-center text-slate-600">
      Aucun accès applicatif n’est attribué à votre compte.
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path={ROUTES.home}
        element={<Navigate to={ROUTES.dashboard} replace />}
      />
      <Route path={ROUTES.dashboard} element={<RequirePermission permission="reporting.read"><AppShell><DashboardPage /></AppShell></RequirePermission>} />
      <Route
        path={ROUTES.agents}
        element={
          <RequirePermission permission="agents.read">
            <AppShell>
              <AgentPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.beneficiaries}
        element={
          <RequirePermission permission="beneficiaries.read">
            <AppShell>
              <BeneficiairePage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.providers}
        element={
          <RequirePermission permission="providers.read">
            <AppShell>
              <PrestatairePage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.coverage}
        element={
          <RequirePermission permission="attestations.read">
            <AppShell>
              <PriseEnChargePage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.referentials}
        element={
          <RequirePermission permission="reference-data.read">
            <AppShell>
              <ReferentielsPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.users}
        element={
          <RequirePermission permission="admin.manage">
            <AppShell>
              <UserManagementPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.roles}
        element={
          <RequirePermission permission="admin.manage">
            <AppShell>
              <RoleManagementPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.audit}
        element={
          <RequirePermission permission="audit.read">
            <AppShell>
              <AuditSessionsPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.deletionRequests}
        element={
          <RequirePermission permission="deletions.manage">
            <AppShell>
              <DeletionRequestsPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.invoice}
        element={
          <RequirePermission permission="invoices.read">
            <AppShell>
              <InvoicePage></InvoicePage>
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.invoiceT6}
        element={
          <RequirePermission permission="t6.read">
            <AppShell>
              <T6Page />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route path={ROUTES.paie} element={<RequirePermission permission="payroll.read"><AppShell><PaiePage /></AppShell></RequirePermission>} />
      <Route path={ROUTES.statistics} element={<RequirePermission permission="reporting.read"><AppShell><StatisticsPage /></AppShell></RequirePermission>} />
      <Route path={ROUTES.assistant} element={<RequirePermission permission="assistant.use"><AppShell><AssistantGlobalPage /></AppShell></RequirePermission>} />
      <Route
        path={ROUTES.T5X}
        element={
          <RequirePermission permission="reference-data.read">
            <AppShell>
              <T5XConfigurationPage />
            </AppShell>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.T5ParAn}
        element={
          <RequirePermission permission="follow-up.read">
            <LookupLayout onSearchIdp={fetchIdpLookupMock}>
              <T5ParAnPage />
            </LookupLayout>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.T5ParAnParActe}
        element={
          <RequirePermission permission="follow-up.read">
            <LookupLayout onSearchIdp={fetchIdpLookupMock}>
              <T5ParAnParActePage />
            </LookupLayout>
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.T5Parseance}
        element={
          <RequirePermission permission="follow-up.read">
            <LookupLayout onSearchIdp={fetchIdpLookupMock}>
              <T5ParSeancePage />
            </LookupLayout>
          </RequirePermission>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.agents} replace />} />
    </Routes>
  );
}
