import React from "react";
import { createRoot } from "react-dom/client";
import { UsageApp } from "./pages/UsageApp";
import { GlobalConfirmProvider } from "./components/GlobalConfirm";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalConfirmProvider>
      <UsageApp />
    </GlobalConfirmProvider>
  </React.StrictMode>,
);
