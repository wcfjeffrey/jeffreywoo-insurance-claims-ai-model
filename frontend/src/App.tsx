import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { ClaimsListPage } from "./pages/ClaimsList";
import { ClaimDetailPage } from "./pages/ClaimDetail";
import { NewClaimPage } from "./pages/NewClaim";
import { AccountingPage } from "./pages/Accounting";
import { AIPage } from "./pages/AI";
import { CompliancePage } from "./pages/Compliance";
import { AuditPage } from "./pages/Audit";
import { ReportsPage } from "./pages/Reports";
import { HKFRS17Page } from "./pages/HKFRS17Page";
import { HKFRS17Calculator } from './pages/HKFRS17Calculator';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/claims" element={<ClaimsListPage />} />
        <Route path="/claims/:id" element={<ClaimDetailPage />} />
        <Route
          path="/claims/new"
          element={
            <RoleRoute roles={["customer", "manager"]}>
              <NewClaimPage />
            </RoleRoute>
          }
        />
        <Route
          path="/accounting"
          element={
            <RoleRoute roles={["accounting_staff", "manager"]}>
              <AccountingPage />
            </RoleRoute>
          }
        />
        <Route
          path="/ai"
          element={
            <RoleRoute roles={["claim_officer", "manager", "accounting_staff"]}>
              <AIPage />
            </RoleRoute>
          }
        />
        <Route
          path="/compliance"
          element={
            <RoleRoute
              roles={["claim_officer", "manager", "accounting_staff"]}
            >
              <CompliancePage />
            </RoleRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <RoleRoute roles={["manager"]}>
              <AuditPage />
            </RoleRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleRoute roles={["manager", "claim_officer", "accounting_staff"]}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hkfrs17"
          element={
            <RoleRoute roles={["manager", "accounting_staff"]}>
              <HKFRS17Page />
            </RoleRoute>
          }
        />
        <Route
          path="/hkfrs17-calculator"
          element={
            <RoleRoute roles={["manager", "accounting_staff"]}>
              <HKFRS17Calculator />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    
  );
}