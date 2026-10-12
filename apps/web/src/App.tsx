import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from '@/components/shell/AppShell';
import { AcceptInvitationPage } from '@/pages/AcceptInvitationPage';
import { AssetDetailPage } from '@/pages/AssetDetailPage';
import { AssetsPage } from '@/pages/AssetsPage';
import { CompaniesPage } from '@/pages/CompaniesPage';
import { FoldersPage } from '@/pages/FoldersPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DesignSystemPage } from '@/pages/DesignSystemPage';
import { EnvironmentStatusPage } from '@/pages/EnvironmentStatusPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AuditPage } from '@/pages/AuditPage';
import { SignInPage } from '@/pages/SignInPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { TasksPage } from '@/pages/TasksPage';
import { TimePage } from '@/pages/TimePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<EnvironmentStatusPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="folders" element={<FoldersPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:assetId" element={<AssetDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="time" element={<TimePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="design-system" element={<DesignSystemPage />} />
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="invite/:token" element={<AcceptInvitationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
