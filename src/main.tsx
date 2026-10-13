import React from "react";
import { createRoot } from "react-dom/client";
import { ChatApp } from "./pages/ChatApp";
import { GlobalConfirmProvider } from "./components/GlobalConfirm";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalConfirmProvider>
      <ChatApp />
    </GlobalConfirmProvider>
  </React.StrictMode>,
);
