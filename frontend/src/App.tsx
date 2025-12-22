import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { ExecutePage } from "@/pages/execute-page";
import { InventoryPage } from "@/pages/inventory-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { TasksPage } from "@/pages/tasks-page";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/inventory" replace />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/execute" element={<ExecutePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
